import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import type { Role } from "../types/api";

export default function ProtectedRoute({ role, children }: { role?: Role; children: React.ReactNode }) {
  const { user, ready } = useAuth();
  const location = useLocation();
  if (!ready) {
    return <main className="loading">Loading...</main>;
  }
  if (!user) {
    return <Navigate to="/auth" replace />;
  }
  if (user.password_reset_required && location.pathname !== "/reset-password") {
    return <Navigate to="/reset-password" replace />;
  }
  if (role && user.role !== role) {
    return <Navigate to="/dashboard" replace />;
  }
  return <>{children}</>;
}
