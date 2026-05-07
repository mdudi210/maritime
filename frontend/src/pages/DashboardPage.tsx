import { FormEvent, useEffect, useMemo, useState } from "react";
import { CalendarPlus, CheckCircle2, Plus, ShipWheel, UserPlus, Wrench } from "lucide-react";
import {
  createMaintenanceTask,
  createShip,
  createSafetyDrill,
  createUser,
  getDashboard,
  getMaintenanceTasks,
  getSafetyDrills,
  getShips,
  getUsers,
  updateMaintenanceStatus
} from "../api/maritimeApi";
import { useAuth } from "../auth/AuthContext";
import AppShell from "../components/AppShell";
import type { DashboardMetrics, MaintenanceTask, SafetyDrill, Ship } from "../types/api";

export default function DashboardPage() {
  const { user } = useAuth();
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [ships, setShips] = useState<Ship[]>([]);
  const [tasks, setTasks] = useState<MaintenanceTask[]>([]);
  const [drills, setDrills] = useState<SafetyDrill[]>([]);
  const [crew, setCrew] = useState<{ id: number; username: string; email: string; ship_id: number | null }[]>([]);
  const [selectedShipId, setSelectedShipId] = useState<number | "all">("all");
  const [shipSearch, setShipSearch] = useState("");
  const [shipStatus, setShipStatus] = useState("all");
  const [shipName, setShipName] = useState("");
  const [shipPort, setShipPort] = useState("");
  const [title, setTitle] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [taskShipId, setTaskShipId] = useState<number | "">("");
  const [assignedToId, setAssignedToId] = useState<number | "">("");
  const [drillType, setDrillType] = useState("Fire drill");
  const [scheduledDate, setScheduledDate] = useState("");
  const [drillShipId, setDrillShipId] = useState<number | "">("");
  const [newUserEmail, setNewUserEmail] = useState("");
  const [newUsername, setNewUsername] = useState("");
  const [newUserPassword, setNewUserPassword] = useState("");
  const [newUserRole, setNewUserRole] = useState<"admin" | "crew">("crew");
  const [newUserShipId, setNewUserShipId] = useState<number | "">("");

  const selectedShip = useMemo(
    () => ships.find((ship) => selectedShipId !== "all" && ship.id === selectedShipId),
    [ships, selectedShipId]
  );
  const filteredShips = useMemo(() => ships, [ships]);
  const visibleCrew = useMemo(
    () => crew.filter((member) => selectedShipId === "all" || member.ship_id === selectedShipId),
    [crew, selectedShipId]
  );

  const reload = async () => {
    const [nextMetrics, nextShips, nextTasks, nextDrills, nextCrew] = await Promise.all([
      getDashboard(selectedShipId),
      getShips({ search: shipSearch, status: shipStatus }),
      getMaintenanceTasks(selectedShipId),
      getSafetyDrills(selectedShipId),
      user?.role === "admin" ? getUsers({ role: "crew" }) : Promise.resolve([])
    ]);
    setMetrics(nextMetrics);
    setShips(nextShips);
    setTasks(nextTasks);
    setDrills(nextDrills);
    setCrew(nextCrew);
  };

  useEffect(() => {
    reload();
  }, [selectedShipId, shipSearch, shipStatus]);

  const onCreateTask = async (event: FormEvent) => {
    event.preventDefault();
    const ship_id = taskShipId || (selectedShipId !== "all" ? selectedShipId : ships[0]?.id);
    if (!ship_id) return;
    await createMaintenanceTask({
      title,
      ship_id,
      due_date: dueDate,
      assigned_to_id: assignedToId || undefined,
      description: "Created from dashboard"
    });
    setTitle("");
    setDueDate("");
    setAssignedToId("");
    await reload();
  };

  const onCreateDrill = async (event: FormEvent) => {
    event.preventDefault();
    const ship_id = drillShipId || (selectedShipId !== "all" ? selectedShipId : ships[0]?.id);
    if (!ship_id) return;
    await createSafetyDrill({ drill_type: drillType, ship_id, scheduled_date: scheduledDate });
    setScheduledDate("");
    await reload();
  };

  const onCreateShip = async (event: FormEvent) => {
    event.preventDefault();
    await createShip({ name: shipName, current_port: shipPort || undefined });
    setShipName("");
    setShipPort("");
    await reload();
  };

  const onCreateUser = async (event: FormEvent) => {
    event.preventDefault();
    await createUser({
      email: newUserEmail,
      username: newUsername,
      password: newUserPassword,
      role: newUserRole,
      ship_id: newUserRole === "crew" && newUserShipId ? newUserShipId : null
    });
    setNewUserEmail("");
    setNewUsername("");
    setNewUserPassword("");
    setNewUserShipId("");
    await reload();
  };

  return (
    <AppShell>
      <main className="workspace">
        <header className="page-header">
          <div>
            <p className="eyebrow">{user?.role === "admin" ? "Fleet command" : "Crew assignments"}</p>
            <h1>{selectedShip ? selectedShip.name : "Fleet Compliance Dashboard"}</h1>
          </div>
        </header>

        <section className="filter-bar">
          <label>
            Ship
            <select value={selectedShipId} onChange={(event) => setSelectedShipId(event.target.value === "all" ? "all" : Number(event.target.value))}>
              <option value="all">All ships</option>
              {filteredShips.map((ship) => (
                <option key={ship.id} value={ship.id}>{ship.name}</option>
              ))}
            </select>
          </label>
          <label>
            Search ships
            <input value={shipSearch} onChange={(event) => setShipSearch(event.target.value)} placeholder="Name" />
          </label>
          <label>
            Status
            <select value={shipStatus} onChange={(event) => setShipStatus(event.target.value)}>
              <option value="all">All status</option>
              <option value="operational">Operational</option>
              <option value="maintenance">Maintenance</option>
              <option value="out_of_service">Out of service</option>
            </select>
          </label>
        </section>

        <section className="metrics-grid">
          <Metric label="Ships" value={metrics?.ships ?? 0} />
          <Metric label="Maintenance compliance" value={`${metrics?.maintenance_compliance_percent ?? 0}%`} />
          <Metric label="Drill compliance" value={`${metrics?.drill_compliance_percent ?? 0}%`} />
          <Metric label="Open risks" value={(metrics?.maintenance_overdue ?? 0) + (metrics?.drills_missed ?? 0)} />
        </section>

        {user?.role === "admin" ? (
          <section className="admin-tools">
            <form className="inline-form compact" onSubmit={onCreateShip}>
              <h2><ShipWheel size={18} /> New ship</h2>
              <input placeholder="Ship name" value={shipName} onChange={(event) => setShipName(event.target.value)} required />
              <input placeholder="Current port" value={shipPort} onChange={(event) => setShipPort(event.target.value)} />
              <button className="icon-button"><Plus size={18} /> Add ship</button>
            </form>
            <form className="inline-form compact" onSubmit={onCreateUser}>
              <h2><UserPlus size={18} /> New user</h2>
              <input type="email" placeholder="Email" value={newUserEmail} onChange={(event) => setNewUserEmail(event.target.value)} required />
              <input placeholder="Username" value={newUsername} onChange={(event) => setNewUsername(event.target.value)} required />
              <input type="password" placeholder="Password" value={newUserPassword} onChange={(event) => setNewUserPassword(event.target.value)} required />
              <select value={newUserRole} onChange={(event) => setNewUserRole(event.target.value as "admin" | "crew")}>
                <option value="crew">Crew</option>
                <option value="admin">Admin</option>
              </select>
              <select value={newUserShipId} onChange={(event) => setNewUserShipId(event.target.value ? Number(event.target.value) : "")} disabled={newUserRole === "admin"}>
                <option value="">Assign ship</option>
                {ships.map((ship) => (
                  <option key={ship.id} value={ship.id}>{ship.name}</option>
                ))}
              </select>
              <button className="icon-button"><Plus size={18} /> Add user</button>
            </form>
            <form className="inline-form" onSubmit={onCreateTask}>
              <h2><Wrench size={18} /> New maintenance</h2>
              <input placeholder="Task title" value={title} onChange={(event) => setTitle(event.target.value)} required />
              <select value={taskShipId} onChange={(event) => setTaskShipId(event.target.value ? Number(event.target.value) : "")}>
                <option value="">Ship</option>
                {ships.map((ship) => (
                  <option key={ship.id} value={ship.id}>{ship.name}</option>
                ))}
              </select>
              <select value={assignedToId} onChange={(event) => setAssignedToId(event.target.value ? Number(event.target.value) : "")}>
                <option value="">Crew</option>
                {visibleCrew.map((member) => (
                  <option key={member.id} value={member.id}>{member.username}</option>
                ))}
              </select>
              <input type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} required />
              <button className="icon-button"><Plus size={18} /> Add task</button>
            </form>
            <form className="inline-form" onSubmit={onCreateDrill}>
              <h2><CalendarPlus size={18} /> New drill</h2>
              <input value={drillType} onChange={(event) => setDrillType(event.target.value)} required />
              <select value={drillShipId} onChange={(event) => setDrillShipId(event.target.value ? Number(event.target.value) : "")}>
                <option value="">Ship</option>
                {ships.map((ship) => (
                  <option key={ship.id} value={ship.id}>{ship.name}</option>
                ))}
              </select>
              <input type="date" value={scheduledDate} onChange={(event) => setScheduledDate(event.target.value)} required />
              <button className="icon-button"><Plus size={18} /> Schedule</button>
            </form>
          </section>
        ) : null}

        <section className="content-grid">
          <Panel title="Ships">
            {filteredShips.map((ship) => (
              <button className={`row-card ship-row ${selectedShipId === ship.id ? "selected" : ""}`} key={ship.id} onClick={() => setSelectedShipId(ship.id)}>
                <div>
                  <strong>{ship.name}</strong>
                  <span>{ship.current_port || "Port not set"}</span>
                </div>
                <span className="status-pill">{ship.status}</span>
              </button>
            ))}
          </Panel>
          <Panel title="Maintenance">
            {tasks.map((task) => (
              <article className="row-card" key={task.id}>
                <div>
                  <strong>{task.title}</strong>
                  <span>Ship #{task.ship_id} · Due {task.due_date}</span>
                </div>
                <select
                  value={task.status}
                  onChange={async (event) => {
                    await updateMaintenanceStatus(task.id, event.target.value as MaintenanceTask["status"]);
                    await reload();
                  }}
                >
                  <option value="pending">Pending</option>
                  <option value="in_progress">In progress</option>
                  <option value="completed">Completed</option>
                </select>
              </article>
            ))}
          </Panel>
          <Panel title="Safety Drills">
            {drills.map((drill) => (
              <article className="row-card" key={drill.id}>
                <div>
                  <strong>{drill.drill_type}</strong>
                  <span>Ship #{drill.ship_id} · Scheduled {drill.scheduled_date}</span>
                </div>
                <span className="status-pill">{drill.status}</span>
              </article>
            ))}
          </Panel>
        </section>
      </main>
    </AppShell>
  );
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <article className="metric">
      <span>{label}</span>
      <strong>{value}</strong>
    </article>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="panel">
      <h2><CheckCircle2 size={18} /> {title}</h2>
      <div className="list">{children}</div>
    </section>
  );
}
