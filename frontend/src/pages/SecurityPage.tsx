import { ShieldCheck } from "lucide-react";
import AppShell from "../components/AppShell";

export default function SecurityPage() {
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
      </main>
    </AppShell>
  );
}
