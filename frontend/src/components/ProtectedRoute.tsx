import { Navigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import type { Role } from "../types/api";

export default function ProtectedRoute({ role, children }: { role?: Role; children: React.ReactNode }) {
  const { user, ready } = useAuth();
  if (!ready) {
    return <main className="loading">Loading...</main>;
  }
  if (!user) {
    return <Navigate to="/auth" replace />;
  }
  if (role && user.role !== role) {
    return <Navigate to="/dashboard" replace />;
  }
  return <>{children}</>;
}
