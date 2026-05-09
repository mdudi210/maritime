import { useEffect, useState } from "react";
import AppShell from "../components/AppShell";
import {
  addTaskComment,
  getMaintenanceTasks,
  getSafetyDrills,
  getTaskComments,
  markDrillAttendance,
  submitDrillCompletion,
  updateMaintenanceStatus
} from "../api/maritimeApi";
import type { MaintenanceTask, SafetyDrill, TaskComment } from "../types/api";

export default function CrewDashboardPage() {
  const [tasks, setTasks] = useState<MaintenanceTask[]>([]);
  const [drills, setDrills] = useState<SafetyDrill[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [taskForComments, setTaskForComments] = useState<MaintenanceTask | null>(null);
  const [taskComments, setTaskComments] = useState<TaskComment[] | null>(null);
  const [newTaskComment, setNewTaskComment] = useState("");
  const [busy, setBusy] = useState(false);

  const reload = async () => {
    setError(null);
    try {
      const [nextTasks, nextDrills] = await Promise.all([getMaintenanceTasks(), getSafetyDrills()]);
      setTasks(nextTasks);
      setDrills(nextDrills);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load crew dashboard");
    }
  };

  useEffect(() => {
    reload();
  }, []);

  const todayIso = new Date().toISOString().slice(0, 10);

  return (
    <AppShell>
      <main className="workspace">
        <header className="page-header">
          <div>
            <p className="eyebrow">Crew</p>
            <h1>Crew dashboard</h1>
          </div>
        </header>

        {error ? <p className="error">{error}</p> : null}

        <section className="content-grid">
          <section className="panel">
            <h2>Assigned maintenance tasks</h2>
            <div className="list">
              {tasks.map((task) => (
                <article className="row-card" key={task.id}>
                  <div>
                    <strong>{task.title}</strong>
                    <span>Due {task.due_date}</span>
                  </div>
                  <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                    <button
                      className="ghost-button"
                      onClick={async () => {
                        setTaskForComments(task);
                        setTaskComments(null);
                        setNewTaskComment("");
                        try {
                          const comments = await getTaskComments(task.id);
                          setTaskComments(comments);
                        } catch (err) {
                          setError(err instanceof Error ? err.message : "Failed to load notes");
                        }
                      }}
                    >
                      Notes
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
              {tasks.length === 0 ? <p className="notice">No assigned tasks.</p> : null}
            </div>
          </section>

          <section className="panel">
            <h2>Upcoming drills</h2>
            <div className="list">
              {drills.map((drill) => (
                <article className="row-card" key={drill.id}>
                  <div>
                    <strong>{drill.drill_type}</strong>
                    <span>Scheduled {drill.scheduled_date}</span>
                  </div>
                  <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                    <button
                      className="ghost-button"
                      disabled={drill.scheduled_date !== todayIso || busy}
                      onClick={async () => {
                        try {
                          setBusy(true);
                          await markDrillAttendance(drill.id, true);
                          await reload();
                        } catch (err) {
                          setError(err instanceof Error ? err.message : "Failed to mark attendance");
                        } finally {
                          setBusy(false);
                        }
                      }}
                    >
                      Mark attendance
                    </button>
                    <button
                      className="ghost-button"
                      disabled={drill.scheduled_date !== todayIso || busy}
                      onClick={async () => {
                        try {
                          setBusy(true);
                          await submitDrillCompletion(drill.id, true);
                          await reload();
                        } catch (err) {
                          setError(err instanceof Error ? err.message : "Failed to submit completion");
                        } finally {
                          setBusy(false);
                        }
                      }}
                    >
                      Submit completion
                    </button>
                    <span className="status-pill">{drill.status}</span>
                  </div>
                </article>
              ))}
              {drills.length === 0 ? <p className="notice">No upcoming drills.</p> : null}
            </div>
          </section>
        </section>

        {taskForComments ? (
          <div className="modal-overlay" onClick={() => setTaskForComments(null)} role="presentation">
            <section className="modal" onClick={(e) => e.stopPropagation()}>
              <header className="modal-header">
                <div>
                  <strong>{taskForComments.title}</strong>
                  <span>Due {taskForComments.due_date}</span>
                </div>
                <button className="ghost-button" onClick={() => setTaskForComments(null)}>Close</button>
              </header>
              <form
                className="form"
                onSubmit={async (e) => {
                  e.preventDefault();
                  if (!newTaskComment.trim()) return;
                  try {
                    await addTaskComment(taskForComments.id, newTaskComment.trim());
                    setNewTaskComment("");
                    const comments = await getTaskComments(taskForComments.id);
                    setTaskComments(comments);
                  } catch (err) {
                    setError(err instanceof Error ? err.message : "Failed to add note");
                  }
                }}
              >
                <label>
                  Add note
                  <input value={newTaskComment} onChange={(e) => setNewTaskComment(e.target.value)} />
                </label>
                <button className="primary-button">Add</button>
              </form>
              <div className="list" style={{ marginTop: 14 }}>
                {!taskComments ? (
                  <p className="notice">Loading notes…</p>
                ) : taskComments.length === 0 ? (
                  <p className="notice">No notes yet.</p>
                ) : (
                  taskComments.map((c) => (
                    <article className="row-card" key={c.id}>
                      <div>
                        <strong>{c.user.username}</strong>
                        <span>{new Date(c.created_at).toLocaleString()}</span>
                        <span style={{ color: "#17212b" }}>{c.comment}</span>
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

