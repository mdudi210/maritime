import { FormEvent, useState } from "react";
import { KeyRound, UserCircle } from "lucide-react";
import { changePassword } from "../api/authApi";
import { updateProfile } from "../api/maritimeApi";
import { useAuth } from "../auth/AuthContext";
import AppShell from "../components/AppShell";

export default function ProfilePage() {
  const { user, setUser } = useAuth();
  const [displayName, setDisplayName] = useState(user?.username ?? "");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const onProfileSave = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    setNotice(null);
    try {
      const updated = await updateProfile({ username: displayName.trim() });
      setUser(updated);
      setNotice("Profile updated");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update profile");
    }
  };

  const onPasswordSave = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    setNotice(null);
    try {
      const updated = await changePassword({ current_password: currentPassword, new_password: newPassword });
      setUser(updated);
      setCurrentPassword("");
      setNewPassword("");
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
            <p className="eyebrow">Account</p>
            <h1>Profile</h1>
          </div>
        </header>

        {error ? <p className="error">{error}</p> : null}
        {notice ? <p className="notice">{notice}</p> : null}

        <section className="content-grid profile-grid">
          <section className="panel">
            <h2><UserCircle size={18} /> Details</h2>
            <div className="list">
              <article className="row-card">
                <div>
                  <strong>{user?.username}</strong>
                  <span>{user?.email}</span>
                  <span>Role {user?.role} · Ship {user?.all_ships ? "All ships" : user?.ship_id ?? "No ship"}</span>
                  <span>Created {user?.created_at ? new Date(user.created_at).toLocaleString() : "Unknown"}</span>
                  <span>Last login {user?.last_login_at ? new Date(user.last_login_at).toLocaleString() : "Never"}</span>
                </div>
              </article>
            </div>
          </section>

          <form className="panel form" onSubmit={onProfileSave}>
            <h2><UserCircle size={18} /> Display name</h2>
            <label>
              Display name
              <input value={displayName} onChange={(event) => setDisplayName(event.target.value)} minLength={2} required />
            </label>
            <button className="icon-button"><UserCircle size={18} /> Save profile</button>
          </form>

          <form className="panel form" onSubmit={onPasswordSave}>
            <h2><KeyRound size={18} /> Password</h2>
            <label>
              Current password
              <input type="password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} required />
            </label>
            <label>
              New password
              <input type="password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} minLength={8} required />
            </label>
            <button className="icon-button"><KeyRound size={18} /> Change password</button>
          </form>
        </section>
      </main>
    </AppShell>
  );
}
