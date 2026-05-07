from fastapi.testclient import TestClient

from app.main import app


def _csrf(client: TestClient) -> dict[str, str]:
    token = client.cookies.get("csrf_token")
    return {"X-CSRF-Token": token} if token else {}


def test_login_me_refresh_logout_flow():
    with TestClient(app) as client:
        login_response = client.post(
            "/api/auth/login",
            json={"email_or_username": "admin@example.com", "password": "Admin@12345"},
        )
        assert login_response.status_code == 200
        assert login_response.json()["user"]["role"] == "admin"
        assert client.cookies.get("access_token")
        assert client.cookies.get("refresh_token")
        assert client.cookies.get("csrf_token")

        me_response = client.get("/api/users/me")
        assert me_response.status_code == 200
        assert me_response.json()["email"] == "admin@example.com"

        refresh_response = client.post("/api/auth/refresh", headers=_csrf(client))
        assert refresh_response.status_code == 200

        logout_response = client.post("/api/auth/logout", headers=_csrf(client))
        assert logout_response.status_code == 200
        assert not client.cookies.get("access_token")
