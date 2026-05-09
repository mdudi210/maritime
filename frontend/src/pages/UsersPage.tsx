import { FormEvent, useEffect, useMemo, useState } from "react";
import { KeyRound, UserPlus, Users } from "lucide-react";
import { createUser, getShips, getUsers, resetUserPassword, updateUser } from "../api/maritimeApi";
import { useAuth } from "../auth/AuthContext";
import AppShell from "../components/AppShell";
import type { Role, Ship, UserSummary } from "../types/api";

type ShipAssignment = number | "all" | "";

export default function UsersPage() {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState<UserSummary[]>([]);
  const [ships, setShips] = useState<Ship[]>([]);
  const [roleFilter, setRoleFilter] = useState<Role | "all">("all");
  const [shipFilter, setShipFilter] = useState<number | "all">("all");
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<Role>("crew");
  const [shipId, setShipId] = useState<ShipAssignment>("");
  const [savingUserId, setSavingUserId] = useState<number | null>(null);
  const [resetUser, setResetUser] = useState<UserSummary | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [temporaryPassword, setTemporaryPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const reload = async () => {
    setError(null);
    try {
      const [nextUsers, nextShips] = await Promise.all([getUsers(), getShips()]);
      setUsers(nextUsers);
      setShips(nextShips);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load users");
    }
  };

  useEffect(() => {
    reload();
  }, []);

  const shipNameById = useMemo(() => {
    return new Map(ships.map((ship) => [ship.id, ship.name]));
  }, [ships]);

  const visibleUsers = useMemo(() => {
    return users.filter((member) => {
      const matchesRole = roleFilter === "all" || member.role === roleFilter;
      const matchesShip = shipFilter === "all" || member.ship_id === shipFilter || (member.role === "crew" && member.all_ships);
      return matchesRole && matchesShip;
    });
  }, [users, roleFilter, shipFilter]);

  const counts = useMemo(() => {
    return {
      total: users.length,
      admins: users.filter((member) => member.role === "admin").length,
      crew: users.filter((member) => member.role === "crew").length
    };
  }, [users]);

  const resetForm = () => {
    setEmail("");
    setUsername("");
    setPassword("");
    setRole("crew");
    setShipId("");
  };

  const onCreate = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    setNotice(null);
    if (password.length < 8) {
      setError("Temporary password must be at least 8 characters");
      return;
    }
    try {
      await createUser({
        email: email.trim(),
        username: username.trim(),
        password,
        role,
        ship_id: role === "crew" && typeof shipId === "number" ? shipId : null,
        all_ships: role === "crew" && shipId === "all"
      });
      resetForm();
      setCreateOpen(false);
      setNotice("User created");
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create user");
    }
  };

  const onUpdate = async (member: UserSummary, nextRole: Role, nextShipId: ShipAssignment) => {
    setSavingUserId(member.id);
    setError(null);
    setNotice(null);
    try {
      await updateUser(member.id, {
        role: nextRole,
        ship_id: nextRole === "crew" && typeof nextShipId === "number" ? nextShipId : null,
        all_ships: nextRole === "crew" && nextShipId === "all"
      });
      setNotice("User updated");
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update user");
    } finally {
      setSavingUserId(null);
    }
  };

  const onResetPassword = async (event: FormEvent) => {
    event.preventDefault();
    if (!resetUser) return;
    if (temporaryPassword.length < 8) {
      setError("Temporary password must be at least 8 characters");
      return;
    }
    setSavingUserId(resetUser.id);
    setError(null);
    setNotice(null);
    try {
      await resetUserPassword(resetUser.id, temporaryPassword);
      setNotice(`Temporary password set for ${resetUser.username}`);
      setResetUser(null);
      setTemporaryPassword("");
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to reset password");
    } finally {
      setSavingUserId(null);
    }
  };

  return (
    <AppShell>
      <main className="workspace">
        <header className="page-header">
          <div>
            <p className="eyebrow">Admin</p>
            <h1>User management</h1>
          </div>
          <button className="icon-button" onClick={() => setCreateOpen(true)}>
            <UserPlus size={18} /> Add user
          </button>
        </header>

        {error ? <p className="error">{error}</p> : null}
        {notice ? <p className="notice">{notice}</p> : null}

        <section className="metrics-grid compact-metrics">
          <article className="metric">
            <span>Total users</span>
            <strong>{counts.total}</strong>
          </article>
          <article className="metric">
            <span>Admins</span>
            <strong>{counts.admins}</strong>
          </article>
          <article className="metric">
            <span>Crew</span>
            <strong>{counts.crew}</strong>
          </article>
        </section>

        <section className="filter-bar">
          <label>
            Role
            <select value={roleFilter} onChange={(event) => setRoleFilter(event.target.value as Role | "all")}>
              <option value="all">All roles</option>
              <option value="admin">Admin</option>
              <option value="crew">Crew</option>
            </select>
          </label>
          <label>
            Ship
            <select value={shipFilter} onChange={(event) => setShipFilter(event.target.value === "all" ? "all" : Number(event.target.value))}>
              <option value="all">All ships</option>
              {ships.map((ship) => (
                <option value={ship.id} key={ship.id}>{ship.name}</option>
              ))}
            </select>
          </label>
        </section>

        <section className="panel">
          <h2><Users size={18} /> Users</h2>
          <div className="list">
            {visibleUsers.map((member) => {
              const isCurrentUser = member.id === currentUser?.id;
              return (
                <article className="row-card user-row" key={member.id}>
                  <div>
                    <strong>{member.username}</strong>
                    <span>{member.email}</span>
                    <span>
                      Created {new Date(member.created_at).toLocaleDateString()} · {member.is_active ? "Active" : "Inactive"}
                      {member.password_reset_required ? " · Password reset required" : ""}
                    </span>
                    <span>
                      Last login {member.last_login_at ? new Date(member.last_login_at).toLocaleString() : "Never"} ·
                      {" "}Assigned {member.total_drills_assigned} · Completed {member.total_drills_completed}
                    </span>
                  </div>
                  <div className="user-controls">
                    <span className="status-pill">{member.role}</span>
                    <select
                      value={member.role}
                      disabled={savingUserId === member.id || isCurrentUser}
                      onChange={(event) => onUpdate(member, event.target.value as Role, member.all_ships ? "all" : member.ship_id ?? "")}
                    >
                      <option value="crew">Crew</option>
                      <option value="admin">Admin</option>
                    </select>
                    <select
                      value={member.all_ships ? "all" : member.ship_id ?? ""}
                      disabled={savingUserId === member.id || member.role === "admin"}
                      onChange={(event) => onUpdate(member, member.role, event.target.value === "all" ? "all" : event.target.value ? Number(event.target.value) : "")}
                    >
                      <option value="">No ship</option>
                      <option value="all">All ships</option>
                      {ships.map((ship) => (
                        <option value={ship.id} key={ship.id}>{ship.name}</option>
                      ))}
                    </select>
                    <span>{member.all_ships ? "All ships" : member.ship_id ? shipNameById.get(member.ship_id) ?? `Ship #${member.ship_id}` : "No ship"}</span>
                    <button
                      className="ghost-button"
                      disabled={savingUserId === member.id}
                      onClick={() => {
                        setResetUser(member);
                        setTemporaryPassword("");
                        setError(null);
                        setNotice(null);
                      }}
                    >
                      <KeyRound size={16} /> Reset
                    </button>
                  </div>
                </article>
              );
            })}
            {visibleUsers.length === 0 ? <p className="notice">No users found.</p> : null}
          </div>
        </section>

        {resetUser ? (
          <div className="modal-overlay" onClick={() => setResetUser(null)} role="presentation">
            <section className="modal" onClick={(event) => event.stopPropagation()}>
              <header className="modal-header">
                <div>
                  <strong>Reset password</strong>
                  <span>{resetUser.username} will need to change this password at next login.</span>
                </div>
                <button className="ghost-button" onClick={() => setResetUser(null)}>Close</button>
              </header>
              <form className="form" onSubmit={onResetPassword}>
                <label>
                  Temporary password
                  <input
                    type="password"
                    placeholder="8+ characters"
                    value={temporaryPassword}
                    onChange={(event) => setTemporaryPassword(event.target.value)}
                    minLength={8}
                    required
                  />
                </label>
                <button className="icon-button" disabled={savingUserId === resetUser.id}>
                  <KeyRound size={18} /> Set temporary password
                </button>
              </form>
            </section>
          </div>
        ) : null}

        {createOpen ? (
          <div className="modal-overlay" onClick={() => setCreateOpen(false)} role="presentation">
            <section className="modal modal-narrow" onClick={(event) => event.stopPropagation()}>
              <header className="modal-header">
                <div>
                  <strong><UserPlus size={18} /> Add user</strong>
                  <span>New users must change the temporary password at first login.</span>
                </div>
                <button className="ghost-button" onClick={() => setCreateOpen(false)}>Close</button>
              </header>
              <form className="form" onSubmit={onCreate}>
                <label>
                  Email
                  <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
                </label>
                <label>
                  Display name
                  <input value={username} onChange={(event) => setUsername(event.target.value)} required />
                </label>
                <label>
                  Temporary password
                  <input
                    type="password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    minLength={8}
                    required
                  />
                </label>
                <label>
                  Role
                  <select value={role} onChange={(event) => setRole(event.target.value as Role)}>
                    <option value="crew">Crew</option>
                    <option value="admin">Admin</option>
                  </select>
                </label>
                <label>
                  Ship
                  <select
                    value={shipId}
                    onChange={(event) => setShipId(event.target.value === "all" ? "all" : event.target.value ? Number(event.target.value) : "")}
                  >
                    <option value="">No ship</option>
                    <option value="all">All ships</option>
                    {ships.map((ship) => (
                      <option value={ship.id} key={ship.id}>{ship.name}</option>
                    ))}
                  </select>
                </label>
                <button className="icon-button"><UserPlus size={18} /> Add user</button>
              </form>
            </section>
          </div>
        ) : null}
      </main>
    </AppShell>
  );
}
