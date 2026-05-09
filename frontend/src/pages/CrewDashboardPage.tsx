import { useEffect, useState } from "react";
import AppShell from "../components/AppShell";
import {
  addTaskComment,
  getMaintenanceTasks,
  getSafetyDrills,
  getTaskComments,
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
                    <span>Due {task.due_date}{task.due_time ? ` · Start ${task.due_time.slice(0, 5)}` : ""}</span>
                    {task.completed_at ? (
                      <span>Completed {new Date(task.completed_at).toLocaleString()}</span>
                    ) : null}
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
            <h2>Scheduled drills</h2>
            <div className="list">
              {drills.map((drill) => (
                <article className="row-card" key={drill.id}>
                  <div>
                    <strong>{drill.drill_type}</strong>
                    <span>Scheduled {drill.scheduled_date}{drill.scheduled_time ? ` · Start ${drill.scheduled_time.slice(0, 5)}` : ""}{drill.end_time ? ` · End ${drill.end_time.slice(0, 5)}` : ""}</span>
                  </div>
                </article>
              ))}
              {drills.length === 0 ? <p className="notice">No scheduled drills.</p> : null}
            </div>
          </section>
        </section>

        {taskForComments ? (
          <div className="modal-overlay" onClick={() => setTaskForComments(null)} role="presentation">
            <section className="modal" onClick={(e) => e.stopPropagation()}>
              <header className="modal-header">
                <div>
                  <strong>{taskForComments.title}</strong>
                  <span>
                    Due {taskForComments.due_date}
                    {taskForComments.due_time ? ` · Start ${taskForComments.due_time.slice(0, 5)}` : ""}
                    {taskForComments.completed_at ? ` · Completed ${new Date(taskForComments.completed_at).toLocaleString()}` : ""}
                  </span>
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
