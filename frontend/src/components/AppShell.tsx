import { Anchor, LayoutDashboard, LogOut, ShieldCheck } from "lucide-react";
import { NavLink, useNavigate } from "react-router-dom";
import { logout, logoutAll } from "../api/authApi";
import { useAuth } from "../auth/AuthContext";

export default function AppShell({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate();
  const { user, setUser } = useAuth();

  const onLogout = async (all = false) => {
    if (all) {
      await logoutAll();
    } else {
      await logout();
    }
    setUser(null);
    navigate("/auth", { replace: true });
  };

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand">
          <Anchor size={28} />
          <div>
            <strong>Maritime Ops</strong>
            <span>{user?.role === "admin" ? "Admin console" : "Crew workspace"}</span>
          </div>
        </div>
        <nav>
          <NavLink to="/dashboard">
            <LayoutDashboard size={18} /> Dashboard
          </NavLink>
          <NavLink to="/security">
            <ShieldCheck size={18} /> Session
          </NavLink>
        </nav>
        <div className="sidebar-footer">
          <div className="identity">
            <strong>{user?.username}</strong>
            <span>{user?.email}</span>
          </div>
          <button className="icon-button full" onClick={() => onLogout(false)}>
            <LogOut size={18} /> Logout
          </button>
          <button className="ghost-button" onClick={() => onLogout(true)}>
            Logout all sessions
          </button>
        </div>
      </aside>
      {children}
    </div>
  );
}
