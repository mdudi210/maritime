import { FormEvent, useState } from "react";
import { Anchor, LockKeyhole } from "lucide-react";
import { Navigate, useNavigate } from "react-router-dom";
import { login } from "../api/authApi";
import { ApiError } from "../api/client";
import { useAuth } from "../auth/AuthContext";

export default function AuthPage() {
  const navigate = useNavigate();
  const { user, reloadUser } = useAuth();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [emailOrUsername, setEmailOrUsername] = useState("admin@example.com");
  const [password, setPassword] = useState("Admin@12345");

  if (user) {
    return <Navigate to={user.password_reset_required ? "/reset-password" : "/dashboard"} replace />;
  }

  const onSignin = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await login({ email_or_username: emailOrUsername.trim(), password });
      const current = await reloadUser();
      navigate(current?.password_reset_required ? "/reset-password" : "/dashboard", { replace: true });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Sign in failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="auth-page">
      <section className="auth-hero">
        <div className="brand-mark">
          <Anchor size={36} />
          <span>Maritime Operations</span>
        </div>
        <h1>Ship maintenance, drills, and compliance in one secure console.</h1>
        <p>Cookie-based login, refresh, logout, and logout-all follow the LogOnService session pattern.</p>
      </section>
      <section className="auth-panel">
        <div className="panel-title">
          <LockKeyhole size={18} />
          <h2>Sign in</h2>
        </div>
        <form onSubmit={onSignin} className="form">
          <label>
            Email or username
            <input value={emailOrUsername} onChange={(event) => setEmailOrUsername(event.target.value)} required />
          </label>
          <label>
            Password
            <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} required />
          </label>
          <button className="primary-button" disabled={busy}>
            {busy ? "Signing in..." : "Sign in"}
          </button>
        </form>
        {error ? <p className="error">{error}</p> : null}
      </section>
    </main>
  );
}
