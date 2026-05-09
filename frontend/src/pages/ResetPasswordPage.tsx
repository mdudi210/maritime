import { FormEvent, useState } from "react";
import { KeyRound } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { changePassword } from "../api/authApi";
import { useAuth } from "../auth/AuthContext";

export default function ResetPasswordPage() {
  const navigate = useNavigate();
  const { user, setUser } = useAuth();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    if (newPassword !== confirmPassword) {
      setError("New passwords do not match");
      return;
    }
    setBusy(true);
    try {
      const updatedUser = await changePassword({
        current_password: currentPassword,
        new_password: newPassword
      });
      setUser(updatedUser);
      navigate("/dashboard", { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to reset password");
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="auth-page reset-page">
      <section className="auth-hero">
        <div className="brand-mark">
          <KeyRound size={36} />
          <span>Maritime Operations</span>
        </div>
        <h1>{user?.password_reset_required ? "Reset your password to continue." : "Change your password."}</h1>
        <p>Use your current or temporary password once, then set a private password for future sign-ins.</p>
      </section>
      <section className="auth-panel">
        <div className="panel-title">
          <KeyRound size={18} />
          <h2>Password reset</h2>
        </div>
        <form className="form" onSubmit={onSubmit}>
          <label>
            Current password
            <input type="password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} required />
          </label>
          <label>
            New password
            <input type="password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} minLength={8} required />
          </label>
          <label>
            Confirm new password
            <input type="password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} minLength={8} required />
          </label>
          <button className="primary-button" disabled={busy}>
            {busy ? "Saving..." : "Save password"}
          </button>
        </form>
        {error ? <p className="error">{error}</p> : null}
      </section>
    </main>
  );
}
