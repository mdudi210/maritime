#!/bin/bash
# ==============================================================================
# EC2 Deployment Script for Maritime Operations & Compliance System
# This script installs Docker, Docker Compose, sets up the environment,
# pulls the docker-compose file, and starts the application stack.
# ==============================================================================

set -e # Exit immediately if a command exits with a non-zero status

echo "🚀 Starting Maritime EC2 Deployment Script..."

# 1. Update system packages
echo "📦 Updating system packages..."
sudo apt-get update -y
sudo apt-get upgrade -y

# 2. Install dependencies, Docker, and Docker Compose v2
echo "🐳 Installing Docker and Docker Compose..."
sudo apt-get install -y ca-certificates curl gnupg git

# Add Docker's official GPG key
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor --yes -o /etc/apt/keyrings/docker.gpg
sudo chmod a+r /etc/apt/keyrings/docker.gpg

# Set up the repository
echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
  $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | \
  sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

sudo apt-get update -y
sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

# 3. Add current user to docker group (so sudo isn't needed)
echo "👤 Adding current user to docker group..."
sudo usermod -aG docker $USER

# 4. Create application directory
APP_DIR="$HOME/maritime"
echo "📁 Setting up application directory at $APP_DIR..."
mkdir -p "$APP_DIR"
cd "$APP_DIR"

# 5. Fetch the production docker-compose file from GitHub
echo "📥 Downloading docker-compose.prod.yml..."
wget -qO docker-compose.prod.yml https://raw.githubusercontent.com/mdudi210/maritime/main/docker-compose.prod.yml

# 6. Set up Environment Variables
echo "🔐 Generating environment variables (.env)..."
# Get the EC2 instance's public IP dynamically
PUBLIC_IP=$(curl -s http://checkip.amazonaws.com)

cat << EOF > .env
# Application Images
BACKEND_IMAGE=ghcr.io/mdudi210/maritime-backend:main
FRONTEND_IMAGE=ghcr.io/mdudi210/maritime-frontend:main

# Database Settings (Volume is mapped automatically in docker-compose.prod.yml)
POSTGRES_DB=maritime
POSTGRES_USER=maritime
POSTGRES_PASSWORD=$(openssl rand -hex 12)

# Authentication Secrets
JWT_SECRET_KEY=$(openssl rand -hex 32)
JWT_REFRESH_SECRET_KEY=$(openssl rand -hex 32)

# Security and Networking
# We allow localhost (if testing via SSH tunnel) and the public IP of the EC2 instance
CORS_ORIGINS=http://localhost:5173,http://$PUBLIC_IP,http://$PUBLIC_IP:8080

# Note: Secure cookies require HTTPS. Since EC2 IP uses HTTP, we set this to false.
# Change to true when you put this behind a real domain with HTTPS.
AUTH_COOKIE_SECURE=false
EOF

echo "✅ Environment variables configured for IP: $PUBLIC_IP"

# 7. Start the Application Stack
echo "🚢 Pulling images and starting the application..."
# We use sudo here just in case the newgrp hasn't taken effect in the current shell session
sudo docker compose -f docker-compose.prod.yml --env-file .env up -d

echo "=================================================================="
echo "🎉 Deployment Complete!"
echo ""
echo "Please wait ~60 seconds for the database and backend to initialize."
echo "Your application will be live at:"
echo "👉 http://$PUBLIC_IP:8080"
echo ""
echo "Note: Ensure your EC2 Security Group allows inbound TCP traffic on port 8080."
echo "=================================================================="
