import { FormEvent, useEffect, useMemo, useState } from "react";
import AppShell from "../components/AppShell";
import {
  addTaskComment,
  createMaintenanceTask,
  getMaintenanceTasksFiltered,
  getShips,
  getUsers,
  updateMaintenanceStatus
} from "../api/maritimeApi";
import type { MaintenanceTask, Ship, UserSummary } from "../types/api";

export default function MaintenanceManagementPage() {
  const [ships, setShips] = useState<Ship[]>([]);
  const [crew, setCrew] = useState<UserSummary[]>([]);
  const [tasks, setTasks] = useState<MaintenanceTask[]>([]);
  const [selectedShipId, setSelectedShipId] = useState<number | "all">("all");
  const [statusFilter, setStatusFilter] = useState<"all" | MaintenanceTask["status"]>("all");
  const [dueFrom, setDueFrom] = useState("");
  const [dueTo, setDueTo] = useState("");
  const [title, setTitle] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [shipId, setShipId] = useState<number | "">("");
  const [assignedToId, setAssignedToId] = useState<number | "">("");
  const [error, setError] = useState<string | null>(null);

  const reload = async () => {
    setError(null);
    try {
      const [nextShips, nextCrew, nextTasks] = await Promise.all([
        getShips(),
        getUsers({ role: "crew" }),
        getMaintenanceTasksFiltered({
          shipId: selectedShipId,
          status: statusFilter,
          due_from: dueFrom || undefined,
          due_to: dueTo || undefined
        })
      ]);
      setShips(nextShips);
      setCrew(nextCrew);
      setTasks(nextTasks);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load maintenance data");
    }
  };

  useEffect(() => {
    reload();
  }, [selectedShipId, statusFilter, dueFrom, dueTo]);

  const visibleTasks = useMemo(() => {
    if (statusFilter === "all") return tasks;
    return tasks.filter((t) => t.status === statusFilter);
  }, [tasks, statusFilter]);

  const visibleCrew = useMemo(() => {
    if (selectedShipId === "all") return crew;
    return crew.filter((c) => c.ship_id === selectedShipId);
  }, [crew, selectedShipId]);

  const onCreate = async (event: FormEvent) => {
    event.preventDefault();
    const finalShipId = shipId || (selectedShipId !== "all" ? selectedShipId : ships[0]?.id);
    if (!finalShipId) return;
    try {
      setError(null);
      await createMaintenanceTask({
        title,
        ship_id: finalShipId,
        due_date: dueDate,
        assigned_to_id: assignedToId || undefined,
        description: "Created from maintenance management"
      });
      setTitle("");
      setDueDate("");
      setAssignedToId("");
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create task");
    }
  };

  return (
    <AppShell>
      <main className="workspace">
        <header className="page-header">
          <div>
            <p className="eyebrow">Admin</p>
            <h1>Maintenance management</h1>
          </div>
        </header>

        {error ? <p className="error">{error}</p> : null}

        <section className="filter-bar">
          <label>
            Ship
            <select value={selectedShipId} onChange={(e) => setSelectedShipId(e.target.value === "all" ? "all" : Number(e.target.value))}>
              <option value="all">All ships</option>
              {ships.map((s) => (
                <option value={s.id} key={s.id}>{s.name}</option>
              ))}
            </select>
          </label>
          <label>
            Status
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as any)}>
              <option value="all">All</option>
              <option value="pending">Pending</option>
              <option value="in_progress">In progress</option>
              <option value="completed">Completed</option>
            </select>
          </label>
          <label>
            Due from
            <input type="date" value={dueFrom} onChange={(e) => setDueFrom(e.target.value)} />
          </label>
          <label>
            Due to
            <input type="date" value={dueTo} onChange={(e) => setDueTo(e.target.value)} />
          </label>
        </section>

        <section className="admin-tools" style={{ gridTemplateColumns: "1fr" }}>
          <form className="inline-form" onSubmit={onCreate}>
            <h2>Create maintenance task</h2>
            <input placeholder="Task title" value={title} onChange={(e) => setTitle(e.target.value)} required />
            <select value={shipId} onChange={(e) => setShipId(e.target.value ? Number(e.target.value) : "")}>
              <option value="">Ship</option>
              {ships.map((s) => (
                <option value={s.id} key={s.id}>{s.name}</option>
              ))}
            </select>
            <select value={assignedToId} onChange={(e) => setAssignedToId(e.target.value ? Number(e.target.value) : "")}>
              <option value="">Assign crew</option>
              {visibleCrew.map((m) => (
                <option value={m.id} key={m.id}>{m.username}</option>
              ))}
            </select>
            <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} required />
            <button className="icon-button">Create</button>
          </form>
        </section>

        <section className="panel">
          <h2>Tasks</h2>
          <div className="list">
            {visibleTasks.map((task) => (
              <article className="row-card" key={task.id}>
                <div>
                  <strong>{task.title}</strong>
                  <span>Ship #{task.ship_id} · Due {task.due_date} · Assigned {task.assigned_to_id ?? "unassigned"}</span>
                </div>
                <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                  <button
                    className="ghost-button"
                    onClick={async () => {
                      try {
                        await addTaskComment(task.id, "Admin reviewed task");
                      } catch {
                        // ignore
                      }
                    }}
                  >
                    Add note
                  </button>
                  <select
                    value={task.status}
                    onChange={async (e) => {
                      await updateMaintenanceStatus(task.id, e.target.value as MaintenanceTask["status"]);
                      await reload();
                    }}
                  >
                    <option value="pending">Pending</option>
                    <option value="in_progress">In progress</option>
                    <option value="completed">Completed</option>
                  </select>
                </div>
              </article>
            ))}
            {visibleTasks.length === 0 ? <p className="notice">No tasks found.</p> : null}
          </div>
        </section>
      </main>
    </AppShell>
  );
}

