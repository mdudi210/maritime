import { FormEvent, useEffect, useMemo, useState } from "react";
import { Plus, Trash2, Wrench } from "lucide-react";
import AppShell from "../components/AppShell";
import {
  addTaskComment,
  createMaintenanceTask,
  deleteMaintenanceTask,
  getMaintenanceTasksFiltered,
  getShips,
  getUsers,
  updateMaintenanceStatus
} from "../api/maritimeApi";
import type { MaintenanceTask, Ship, UserSummary } from "../types/api";

type AssignmentMode = "none" | "one" | "multiple" | "all";

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
  const [dueTime, setDueTime] = useState("");
  const [shipId, setShipId] = useState<number | "">("");
  const [assignedToId, setAssignedToId] = useState<number | "">("");
  const [assignedToIds, setAssignedToIds] = useState<number[]>([]);
  const [assignmentMode, setAssignmentMode] = useState<AssignmentMode>("none");
  const [createOpen, setCreateOpen] = useState(false);
  const [deletingTaskId, setDeletingTaskId] = useState<number | null>(null);
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

  const createShipId = shipId || (selectedShipId !== "all" ? selectedShipId : "");
  const visibleCrew = useMemo(() => {
    if (!createShipId) return [];
    return crew.filter((c) => c.all_ships || c.ship_id === createShipId);
  }, [crew, createShipId]);

  const crewNameById = useMemo(() => new Map(crew.map((member) => [member.id, member.username])), [crew]);
  const shipNameById = useMemo(() => new Map(ships.map((ship) => [ship.id, ship.name])), [ships]);
  const assignedCrewLabel = (task: MaintenanceTask) => {
    const ids = task.assigned_to_ids?.length ? task.assigned_to_ids : task.assigned_to_id ? [task.assigned_to_id] : [];
    if (ids.length === 0) return "unassigned";
    return ids.map((id) => crewNameById.get(id) ?? `#${id}`).join(", ");
  };

  const onCreate = async (event: FormEvent) => {
    event.preventDefault();
    const finalShipId = shipId || (selectedShipId !== "all" ? selectedShipId : ships[0]?.id);
    if (!finalShipId) {
      setError("Choose a ship before creating a maintenance task");
      return;
    }
    try {
      setError(null);
      await createMaintenanceTask({
        title,
        ship_id: finalShipId,
        due_date: dueDate,
        due_time: dueTime,
        assigned_to_ids:
          assignmentMode === "one" && assignedToId
            ? [assignedToId]
            : assignmentMode === "multiple"
              ? assignedToIds
              : undefined,
        assign_all_crew: assignmentMode === "all",
        description: "Created from maintenance management"
      });
      setTitle("");
      setDueDate("");
      setDueTime("");
      setShipId("");
      setAssignedToId("");
      setAssignedToIds([]);
      setAssignmentMode("none");
      setCreateOpen(false);
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
          <button className="icon-button" onClick={() => setCreateOpen(true)}>
            <Plus size={18} /> Create task
          </button>
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

        <section className="panel">
          <h2>Tasks</h2>
          <div className="list">
            {visibleTasks.map((task) => (
              <article className="row-card" key={task.id}>
                <div>
                  <strong>{task.title}</strong>
                  <span>
                    {shipNameById.get(task.ship_id) ?? `Ship #${task.ship_id}`} · Due {task.due_date}{task.due_time ? ` · Start ${task.due_time.slice(0, 5)}` : ""} · Assigned{" "}
                    {assignedCrewLabel(task)}
                  </span>
                  {task.completed_at ? (
                    <span>
                      Completed {new Date(task.completed_at).toLocaleString()} by{" "}
                      {task.completed_by_id ? crewNameById.get(task.completed_by_id) ?? `user #${task.completed_by_id}` : "unknown"}
                    </span>
                  ) : null}
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
                  <button
                    className="ghost-button danger-button"
                    disabled={deletingTaskId === task.id}
                    onClick={async () => {
                      const confirmed = window.confirm(`Delete ${task.title}?`);
                      if (!confirmed) return;
                      setDeletingTaskId(task.id);
                      setError(null);
                      try {
                        await deleteMaintenanceTask(task.id);
                        await reload();
                      } catch (err) {
                        setError(err instanceof Error ? err.message : "Failed to delete task");
                      } finally {
                        setDeletingTaskId(null);
                      }
                    }}
                  >
                    <Trash2 size={16} /> {deletingTaskId === task.id ? "Deleting..." : "Delete"}
                  </button>
                </div>
              </article>
            ))}
            {visibleTasks.length === 0 ? <p className="notice">No tasks found.</p> : null}
          </div>
        </section>

        {createOpen ? (
          <div className="modal-overlay" onClick={() => setCreateOpen(false)} role="presentation">
            <section className="modal modal-narrow" onClick={(e) => e.stopPropagation()}>
              <header className="modal-header">
                <div>
                  <strong><Wrench size={18} /> Create maintenance task</strong>
                  <span>Assign it to crew for the selected ship.</span>
                </div>
                <button className="ghost-button" onClick={() => setCreateOpen(false)}>Close</button>
              </header>
              <form className="form" onSubmit={onCreate}>
                <label>
                  Task title
                  <input placeholder="Task title" value={title} onChange={(e) => setTitle(e.target.value)} required />
                </label>
                <label>
                  Ship
                  <select
                    value={shipId || (selectedShipId !== "all" ? selectedShipId : "")}
                    onChange={(e) => {
                      setShipId(e.target.value ? Number(e.target.value) : "");
                      setAssignedToId("");
                      setAssignedToIds([]);
                    }}
                    required
                  >
                    <option value="">Select ship</option>
                    {ships.map((s) => (
                      <option value={s.id} key={s.id}>{s.name}</option>
                    ))}
                  </select>
                </label>
                <label>
                  Assignment
                  <select
                    value={assignmentMode}
                    onChange={(e) => {
                      setAssignmentMode(e.target.value as AssignmentMode);
                      setAssignedToId("");
                      setAssignedToIds([]);
                    }}
                    disabled={!createShipId}
                  >
                    <option value="none">Unassigned</option>
                    <option value="one">One crew member</option>
                    <option value="multiple">Multiple crew members</option>
                    <option value="all">All eligible crew</option>
                  </select>
                </label>
                {assignmentMode === "one" ? (
                  <label>
                    Crew member
                    <select
                      value={assignedToId}
                      onChange={(e) => setAssignedToId(e.target.value ? Number(e.target.value) : "")}
                      disabled={!createShipId}
                      required
                    >
                      <option value="">Select crew</option>
                      {visibleCrew.map((m) => (
                        <option value={m.id} key={m.id}>
                          {m.username}{m.all_ships ? " (all ships)" : ""}
                        </option>
                      ))}
                    </select>
                  </label>
                ) : null}
                {assignmentMode === "multiple" ? (
                  <label>
                    Crew members
                    <select
                      multiple
                      value={assignedToIds.map(String)}
                      onChange={(e) => {
                        setAssignedToIds(Array.from(e.currentTarget.selectedOptions, (option) => Number(option.value)));
                      }}
                      disabled={!createShipId}
                      required
                    >
                      {visibleCrew.map((m) => (
                        <option value={m.id} key={m.id}>
                          {m.username}{m.all_ships ? " (all ships)" : ""}
                        </option>
                      ))}
                    </select>
                  </label>
                ) : null}
                <label>
                  Due date
                  <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} required />
                </label>
                <label>
                  Start time
                  <input type="time" value={dueTime} onChange={(e) => setDueTime(e.target.value)} required />
                </label>
                <button className="icon-button"><Plus size={18} /> Create task</button>
              </form>
            </section>
          </div>
        ) : null}
      </main>
    </AppShell>
  );
}
