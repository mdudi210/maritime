import { FormEvent, useState } from "react";
import { KeyRound, ShieldCheck } from "lucide-react";
import { changePassword } from "../api/authApi";
import { useAuth } from "../auth/AuthContext";
import AppShell from "../components/AppShell";

export default function SecurityPage() {
  const { setUser } = useAuth();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const onChangePassword = async (event: FormEvent) => {
    event.preventDefault();
    setNotice(null);
    setError(null);
    if (newPassword !== confirmPassword) {
      setError("New passwords do not match");
      return;
    }
    try {
      const updatedUser = await changePassword({
        current_password: currentPassword,
        new_password: newPassword
      });
      setUser(updatedUser);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setNotice("Password updated");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update password");
    }
  };

  return (
    <AppShell>
      <main className="workspace">
        <header className="page-header">
          <div>
            <p className="eyebrow">Session security</p>
            <h1>Login and Logout Flow</h1>
          </div>
        </header>
        <section className="security-panel">
          <ShieldCheck size={28} />
          <div>
            <h2>LogOnService-style cookie sessions</h2>
            <p>
              Login issues HTTP-only access and refresh cookies plus a readable CSRF cookie. Refresh and logout
              requests send the CSRF token in a header. Logout revokes the current refresh session, while logout all
              revokes every active session for the user.
            </p>
          </div>
        </section>
        <section className="security-panel password-panel">
          <KeyRound size={28} />
          <div>
            <h2>Change password</h2>
            <form className="form" onSubmit={onChangePassword}>
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
              <button className="primary-button">Update password</button>
            </form>
            {notice ? <p className="notice">{notice}</p> : null}
            {error ? <p className="error">{error}</p> : null}
          </div>
        </section>
      </main>
    </AppShell>
  );
}
