import { Navigate, Route, Routes } from "react-router-dom";
import AuthPage from "./pages/AuthPage";
import AttendancePage from "./pages/AttendancePage";
import CrewDashboardPage from "./pages/CrewDashboardPage";
import DashboardPage from "./pages/DashboardPage";
import DrillManagementPage from "./pages/DrillManagementPage";
import MaintenanceManagementPage from "./pages/MaintenanceManagementPage";
import SecurityPage from "./pages/SecurityPage";
import ProtectedRoute from "./components/ProtectedRoute";

export default function App() {
  return (
    <Routes>
      <Route path="/auth" element={<AuthPage />} />
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <DashboardPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/crew"
        element={
          <ProtectedRoute role="crew">
            <CrewDashboardPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/maintenance"
        element={
          <ProtectedRoute role="admin">
            <MaintenanceManagementPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/drills"
        element={
          <ProtectedRoute role="admin">
            <DrillManagementPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/attendance"
        element={
          <ProtectedRoute role="admin">
            <AttendancePage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/security"
        element={
          <ProtectedRoute>
            <SecurityPage />
          </ProtectedRoute>
        }
      />
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}
