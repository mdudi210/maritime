import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, MessageSquarePlus } from "lucide-react";
import {
  addTaskComment,
  getComplianceItems,
  getDashboard,
  getDrillAttendance,
  getMaintenanceTasks,
  getSafetyDrills,
  getShips,
  getTaskComments,
  getUsers,
  updateShip,
  updateSafetyDrill,
  updateMaintenanceStatus
} from "../api/maritimeApi";
import { useAuth } from "../auth/AuthContext";
import AppShell from "../components/AppShell";
import type {
  ComplianceItems,
  DashboardMetrics,
  DrillAttendanceEntry,
  MaintenanceTask,
  SafetyDrill,
  Ship,
  TaskComment
} from "../types/api";

export default function DashboardPage() {
  const { user } = useAuth();
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [complianceItems, setComplianceItems] = useState<ComplianceItems | null>(null);
  const [ships, setShips] = useState<Ship[]>([]);
  const [tasks, setTasks] = useState<MaintenanceTask[]>([]);
  const [drills, setDrills] = useState<SafetyDrill[]>([]);
  const [crew, setCrew] = useState<{ id: number; username: string; email: string; ship_id: number | null; all_ships: boolean }[]>([]);
  const [selectedShipId, setSelectedShipId] = useState<number | "all">("all");
  const [shipSearch, setShipSearch] = useState("");
  const [shipStatus, setShipStatus] = useState("active");
  const [retiringShipId, setRetiringShipId] = useState<number | null>(null);
  const [attendanceDrill, setAttendanceDrill] = useState<SafetyDrill | null>(null);
  const [attendanceRows, setAttendanceRows] = useState<DrillAttendanceEntry[] | null>(null);
  const [attendanceError, setAttendanceError] = useState<string | null>(null);
  const [taskForComments, setTaskForComments] = useState<MaintenanceTask | null>(null);
  const [taskComments, setTaskComments] = useState<TaskComment[] | null>(null);
  const [newTaskComment, setNewTaskComment] = useState("");

  const selectedShip = useMemo(
    () => ships.find((ship) => selectedShipId !== "all" && ship.id === selectedShipId),
    [ships, selectedShipId]
  );
  const filteredShips = useMemo(() => ships, [ships]);
  const shipNameById = useMemo(() => new Map(ships.map((ship) => [ship.id, ship.name])), [ships]);
  const crewNameById = useMemo(() => new Map(crew.map((member) => [member.id, member.username])), [crew]);
  const assignedCrewLabel = (task: MaintenanceTask) => {
    const ids = task.assigned_to_ids?.length ? task.assigned_to_ids : task.assigned_to_id ? [task.assigned_to_id] : [];
    if (ids.length === 0) return "unassigned";
    return ids.map((id) => crewNameById.get(id) ?? `#${id}`).join(", ");
  };

  const reload = async () => {
    const [nextMetrics, nextItems, nextShips, nextTasks, nextDrills, nextCrew] = await Promise.all([
      getDashboard(selectedShipId),
      getComplianceItems(selectedShipId),
      getShips({ search: shipSearch, status: shipStatus }),
      getMaintenanceTasks(selectedShipId),
      getSafetyDrills(selectedShipId),
      user?.role === "admin" ? getUsers({ role: "crew" }) : Promise.resolve([])
    ]);
    setMetrics(nextMetrics);
    setComplianceItems(nextItems);
    setShips(nextShips);
    setTasks(nextTasks);
    setDrills(nextDrills);
    setCrew(nextCrew);
  };

  useEffect(() => {
    reload();
  }, [selectedShipId, shipSearch, shipStatus]);

  const todayIso = new Date().toISOString().slice(0, 10);
  const maintenancePending = (metrics?.maintenance_total ?? 0) - (metrics?.maintenance_completed ?? 0);
  const drillsPending = (metrics?.drills_total ?? 0) - (metrics?.drills_completed ?? 0);

  return (
    <AppShell>
      <main className="workspace">
        <header className="page-header">
          <div>
            <p className="eyebrow">{user?.role === "admin" ? "Fleet command" : "Crew assignments"}</p>
            <h1>{selectedShip ? selectedShip.name : "Fleet Compliance Dashboard"}</h1>
          </div>
        </header>

        {attendanceError ? <p className="error">{attendanceError}</p> : null}

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
              <option value="all">All ships</option>
              <option value="active">Active ships</option>
              <option value="retired">Retired ships</option>
            </select>
          </label>
        </section>

        <section className="metrics-grid">
          <Metric label="Ships" value={metrics?.ships ?? 0} />
          <Metric label="Maintenance compliance" value={`${metrics?.maintenance_compliance_percent ?? 0}%`} />
          <Metric label="Drill participation" value={`${metrics?.drill_participation_percent ?? metrics?.drill_compliance_percent ?? 0}%`} />
          <Metric label="Open risks" value={(metrics?.maintenance_overdue ?? 0) + (metrics?.drills_missed ?? 0)} />
        </section>

        {(metrics?.maintenance_overdue ?? 0) > 0 || (metrics?.drills_missed ?? 0) > 0 ? (
          <section className="panel risk-banner">
            <h2>Notifications</h2>
            {(metrics?.maintenance_overdue ?? 0) > 0 ? (
              <p className="error">You have {metrics?.maintenance_overdue} overdue maintenance task(s).</p>
            ) : null}
            {(metrics?.drills_missed ?? 0) > 0 ? (
              <p className="error">You have {metrics?.drills_missed} missed drill(s).</p>
            ) : null}
          </section>
        ) : null}

        <section className="content-grid" style={{ gridTemplateColumns: "1fr 1fr 1fr" }}>
          <Panel title="Completed vs Pending">
            <article className="row-card">
              <div>
                <strong>Maintenance</strong>
                <span>Completed {metrics?.maintenance_completed ?? 0} · Pending {maintenancePending}</span>
              </div>
              <span className="status-pill">{metrics?.maintenance_overdue ?? 0} overdue</span>
            </article>
            <article className="row-card">
              <div>
                <strong>Safety drills</strong>
                <span>Completed {metrics?.drills_completed ?? 0} · Pending {drillsPending}</span>
              </div>
              <span className="status-pill">{metrics?.drills_missed ?? 0} missed</span>
            </article>
            <article className="row-card">
              <div>
                <strong>Compliance charts</strong>
                <span>Maintenance vs drill participation</span>
              </div>
              <span className="status-pill">Overview</span>
            </article>
            <div className="chart">
              <ChartBar label="Maintenance" percent={metrics?.maintenance_compliance_percent ?? 0} />
              <ChartBar
                label="Drills"
                percent={metrics?.drill_participation_percent ?? metrics?.drill_compliance_percent ?? 0}
              />
            </div>
          </Panel>
          <Panel title="Pending maintenance">
            {(complianceItems?.pending_maintenance ?? []).slice(0, 8).map((task) => (
              <article className={`row-card ${task.due_date < todayIso && task.status !== "completed" ? "risk" : ""}`} key={task.id}>
                <div>
                  <strong>{task.title}</strong>
                  <span>{shipNameById.get(task.ship_id) ?? `Ship #${task.ship_id}`} · Due {task.due_date}{task.due_time ? ` · Start ${task.due_time.slice(0, 5)}` : ""}</span>
                </div>
                <span className="status-pill">{task.status.replace("_", " ")}</span>
              </article>
            ))}
            {complianceItems && complianceItems.pending_maintenance.length === 0 ? (
              <p className="notice">No pending maintenance tasks.</p>
            ) : null}
          </Panel>
          <Panel title="Missed drills">
            {(complianceItems?.missed_drills ?? []).slice(0, 8).map((drill) => (
              <article className="row-card risk" key={drill.id}>
                <div>
                  <strong>{drill.drill_type}</strong>
                  <span>{shipNameById.get(drill.ship_id) ?? `Ship #${drill.ship_id}`} · Scheduled {drill.scheduled_date}{drill.scheduled_time ? ` · Start ${drill.scheduled_time.slice(0, 5)}` : ""}{drill.end_time ? ` · End ${drill.end_time.slice(0, 5)}` : ""}</span>
                </div>
                <span className="status-pill">{drill.status}</span>
              </article>
            ))}
            {complianceItems && complianceItems.missed_drills.length === 0 ? (
              <p className="notice">No missed safety drills.</p>
            ) : null}
          </Panel>
        </section>

        <section className="content-grid">
          <Panel title="Ships">
            {filteredShips.map((ship) => (
              <article className={`row-card ship-row ${selectedShipId === ship.id ? "selected" : ""}`} key={ship.id}>
                <div>
                  <button className="text-button" onClick={() => setSelectedShipId(ship.id)}>{ship.name}</button>
                  <span>{ship.current_port || "Port not set"}</span>
                </div>
                <div className="row-actions">
                  <span className="status-pill">{ship.status}</span>
                  {user?.role === "admin" && ship.status !== "retired" ? (
                    <button
                      className="ghost-button danger-button"
                      disabled={retiringShipId === ship.id}
                      onClick={async () => {
                        const confirmed = window.confirm(`Retire ${ship.name}?`);
                        if (!confirmed) return;
                        setRetiringShipId(ship.id);
                        try {
                          await updateShip(ship.id, { status: "retired" });
                          if (selectedShipId === ship.id) setSelectedShipId("all");
                          await reload();
                        } catch (error) {
                          setAttendanceError(error instanceof Error ? error.message : "Failed to retire ship");
                        } finally {
                          setRetiringShipId(null);
                        }
                      }}
                    >
                      {retiringShipId === ship.id ? "Retiring..." : "Retire"}
                    </button>
                  ) : null}
                </div>
              </article>
            ))}
          </Panel>
          <Panel title="Maintenance">
            {tasks.map((task) => (
              <article className="row-card" key={task.id}>
                <div>
                  <strong>{task.title}</strong>
                  <span>
                    {shipNameById.get(task.ship_id) ?? `Ship #${task.ship_id}`} · Due {task.due_date}
                    {task.due_time ? ` · Start ${task.due_time.slice(0, 5)}` : ""} · Assigned{" "}
                    {assignedCrewLabel(task)}
                  </span>
                  {task.completed_at ? <span>Completed {new Date(task.completed_at).toLocaleString()}</span> : null}
                </div>
                <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                  <button
                    className="ghost-button"
                    onClick={async () => {
                      setTaskForComments(task);
                      setTaskComments(null);
                      setNewTaskComment("");
                      setAttendanceError(null);
                      try {
                        const comments = await getTaskComments(task.id);
                        setTaskComments(comments);
                      } catch (error) {
                        setAttendanceError(error instanceof Error ? error.message : "Failed to load comments");
                      }
                    }}
                  >
                    <MessageSquarePlus size={16} /> Notes
                  </button>
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
                </div>
              </article>
            ))}
          </Panel>
          <Panel title="Safety Drills">
            {drills.map((drill) => (
              <article className="row-card" key={drill.id}>
                <div>
                  <strong>{drill.drill_type}</strong>
                  <span>{shipNameById.get(drill.ship_id) ?? `Ship #${drill.ship_id}`} · Scheduled {drill.scheduled_date}{drill.scheduled_time ? ` · Start ${drill.scheduled_time.slice(0, 5)}` : ""}{drill.end_time ? ` · End ${drill.end_time.slice(0, 5)}` : ""}</span>
                </div>
                <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                  {user?.role === "admin" ? (
                    <>
                      <select
                        value={drill.status}
                        onChange={async (event) => {
                          try {
                            await updateSafetyDrill(drill.id, { status: event.target.value as SafetyDrill["status"] });
                            await reload();
                          } catch (error) {
                            setAttendanceError(error instanceof Error ? error.message : "Failed to update drill");
                          }
                        }}
                      >
                        <option value="scheduled">Scheduled</option>
                        <option value="active">Active</option>
                        <option value="completed">Completed</option>
                        <option value="missed">Missed</option>
                      </select>
                      <button
                        className="ghost-button"
                        onClick={async () => {
                          setAttendanceDrill(drill);
                          setAttendanceRows(null);
                          setAttendanceError(null);
                          try {
                            const rows = await getDrillAttendance(drill.id);
                            setAttendanceRows(rows);
                          } catch (error) {
                            setAttendanceError(error instanceof Error ? error.message : "Failed to load attendance");
                          }
                        }}
                      >
                        View attendance
                      </button>
                    </>
                  ) : null}
                  {user?.role === "admin" ? <span className="status-pill">{drill.status}</span> : null}
                </div>
              </article>
            ))}
          </Panel>
        </section>

        {attendanceDrill ? (
          <div className="modal-overlay" onClick={() => setAttendanceDrill(null)} role="presentation">
            <section className="modal" onClick={(event) => event.stopPropagation()}>
              <header className="modal-header">
                <div>
                  <strong>{attendanceDrill.drill_type}</strong>
                  <span>
                    Scheduled {attendanceDrill.scheduled_date}
                    {attendanceDrill.scheduled_time ? ` · Start ${attendanceDrill.scheduled_time.slice(0, 5)}` : ""} ·{" "}
                    {attendanceDrill.end_time ? ` · End ${attendanceDrill.end_time.slice(0, 5)}` : ""} ·{" "}
                    {shipNameById.get(attendanceDrill.ship_id) ?? `Ship #${attendanceDrill.ship_id}`}
                  </span>
                </div>
                <button className="ghost-button" onClick={() => setAttendanceDrill(null)}>Close</button>
              </header>
              {attendanceError ? <p className="error">{attendanceError}</p> : null}
              <div className="list">
                {(attendanceRows ?? []).map((row) => (
                  <article className="row-card" key={row.id}>
                    <div>
                      <strong>{row.user.username}</strong>
                      <span>{row.user.email}</span>
                      {row.attended_at ? <span>Attended {new Date(row.attended_at).toLocaleString()}</span> : null}
                      {row.completed_at ? <span>Completed {new Date(row.completed_at).toLocaleString()}</span> : null}
                    </div>
                    <span className="status-pill">{row.attendance ? "present" : row.completion_status}</span>
                  </article>
                ))}
                {attendanceRows && attendanceRows.length === 0 ? (
                  <p className="notice">No crew assigned to this ship yet.</p>
                ) : null}
                {!attendanceRows ? <p className="notice">Loading attendance…</p> : null}
              </div>
            </section>
          </div>
        ) : null}

        {taskForComments ? (
          <div className="modal-overlay" onClick={() => setTaskForComments(null)} role="presentation">
            <section className="modal" onClick={(event) => event.stopPropagation()}>
              <header className="modal-header">
                <div>
                  <strong>{taskForComments.title}</strong>
                  <span>
                    {shipNameById.get(taskForComments.ship_id) ?? `Ship #${taskForComments.ship_id}`} · Due {taskForComments.due_date}
                    {taskForComments.due_time ? ` · Start ${taskForComments.due_time.slice(0, 5)}` : ""}
                    {taskForComments.completed_at ? ` · Completed ${new Date(taskForComments.completed_at).toLocaleString()}` : ""}
                  </span>
                </div>
                <button className="ghost-button" onClick={() => setTaskForComments(null)}>Close</button>
              </header>
              {attendanceError ? <p className="error">{attendanceError}</p> : null}
              <form
                className="form"
                onSubmit={async (event) => {
                  event.preventDefault();
                  if (!newTaskComment.trim()) return;
                  try {
                    setAttendanceError(null);
                    await addTaskComment(taskForComments.id, newTaskComment.trim());
                    setNewTaskComment("");
                    const comments = await getTaskComments(taskForComments.id);
                    setTaskComments(comments);
                  } catch (error) {
                    setAttendanceError(error instanceof Error ? error.message : "Failed to add comment");
                  }
                }}
              >
                <label>
                  Add note
                  <input value={newTaskComment} onChange={(event) => setNewTaskComment(event.target.value)} placeholder="What was done / observations" />
                </label>
                <button className="primary-button">Add</button>
              </form>
              <div className="list" style={{ marginTop: 14 }}>
                {!taskComments ? (
                  <p className="notice">Loading notes…</p>
                ) : taskComments.length === 0 ? (
                  <p className="notice">No notes yet.</p>
                ) : (
                  taskComments.map((comment) => (
                    <article className="row-card" key={comment.id}>
                      <div>
                        <strong>{comment.user.username}</strong>
                        <span>{new Date(comment.created_at).toLocaleString()}</span>
                        <span style={{ color: "#17212b" }}>{comment.comment}</span>
                      </div>
                    </article>
                  ))
                )}
              </div>
            </section>
          </div>
        ) : null}
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

function ChartBar({ label, percent }: { label: string; percent: number }) {
  const safe = Math.max(0, Math.min(100, percent));
  return (
    <div className="chart-row">
      <span className="chart-label">{label}</span>
      <div className="chart-track">
        <div className="chart-fill" style={{ width: `${safe}%` }} />
      </div>
      <span className="chart-value">{safe}%</span>
    </div>
  );
}
