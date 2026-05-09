import { FormEvent, useEffect, useMemo, useState } from "react";
import { CalendarPlus, Plus } from "lucide-react";
import AppShell from "../components/AppShell";
import {
  createSafetyDrill,
  deleteSafetyDrill,
  getDrillAttendance,
  getSafetyDrillsFiltered,
  getShips,
  updateSafetyDrill
} from "../api/maritimeApi";
import type { DrillAttendanceEntry, SafetyDrill, Ship } from "../types/api";

export default function DrillManagementPage() {
  const [ships, setShips] = useState<Ship[]>([]);
  const [drills, setDrills] = useState<SafetyDrill[]>([]);
  const [selectedShipId, setSelectedShipId] = useState<number | "all">("all");
  const [drillType, setDrillType] = useState("Fire drill");
  const [scheduledDate, setScheduledDate] = useState("");
  const [scheduledTime, setScheduledTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [shipId, setShipId] = useState<number | "">("");
  const [statusFilter, setStatusFilter] = useState<"all" | SafetyDrill["status"]>("all");
  const [scheduledFrom, setScheduledFrom] = useState("");
  const [scheduledTo, setScheduledTo] = useState("");
  const [attendanceDrill, setAttendanceDrill] = useState<SafetyDrill | null>(null);
  const [attendanceRows, setAttendanceRows] = useState<DrillAttendanceEntry[] | null>(null);
  const [deletingDrillId, setDeletingDrillId] = useState<number | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reload = async () => {
    setError(null);
    try {
      const [nextShips, nextDrills] = await Promise.all([
        getShips(),
        getSafetyDrillsFiltered({
          shipId: selectedShipId,
          status: statusFilter,
          scheduled_from: scheduledFrom || undefined,
          scheduled_to: scheduledTo || undefined
        })
      ]);
      setShips(nextShips);
      setDrills(nextDrills);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load drills");
    }
  };

  useEffect(() => {
    reload();
  }, [selectedShipId, statusFilter, scheduledFrom, scheduledTo]);

  const onCreate = async (event: FormEvent) => {
    event.preventDefault();
    const finalShipId = shipId || (selectedShipId !== "all" ? selectedShipId : ships[0]?.id);
    if (!finalShipId) {
      setError("Choose a ship before scheduling a drill");
      return;
    }
    try {
      setError(null);
      await createSafetyDrill({
        drill_type: drillType,
        ship_id: finalShipId,
        scheduled_date: scheduledDate,
        scheduled_time: scheduledTime,
        end_time: endTime
      });
      setScheduledDate("");
      setScheduledTime("");
      setEndTime("");
      setShipId("");
      setCreateOpen(false);
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to schedule drill");
    }
  };

  const missedCount = useMemo(() => drills.filter((d) => d.status === "missed").length, [drills]);
  const shipNameById = useMemo(() => new Map(ships.map((ship) => [ship.id, ship.name])), [ships]);

  return (
    <AppShell>
      <main className="workspace">
        <header className="page-header">
          <div>
            <p className="eyebrow">Admin</p>
            <h1>Drill management</h1>
          </div>
          <button className="icon-button" onClick={() => setCreateOpen(true)}>
            <Plus size={18} /> Create drill
          </button>
        </header>

        {error ? <p className="error">{error}</p> : null}

        <section className="filter-bar">
          <label>
            Ship
            <select value={selectedShipId} onChange={(e) => setSelectedShipId(e.target.value === "all" ? "all" : Number(e.target.value))}>
              <option value="all">All ships</option>
              {ships.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </label>
          <label>
            Status
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as any)}>
              <option value="all">All</option>
              <option value="scheduled">Scheduled</option>
              <option value="active">Active</option>
              <option value="completed">Completed</option>
              <option value="missed">Missed</option>
            </select>
          </label>
          <label>
            Scheduled from
            <input type="date" value={scheduledFrom} onChange={(e) => setScheduledFrom(e.target.value)} />
          </label>
          <label>
            Scheduled to
            <input type="date" value={scheduledTo} onChange={(e) => setScheduledTo(e.target.value)} />
          </label>
        </section>

        <section className="panel">
          <h2>Drills</h2>
          <div className="list">
            {drills.map((drill) => (
              <article className={`row-card ${drill.status === "missed" ? "risk" : ""}`} key={drill.id}>
                <div>
                  <strong>{drill.drill_type}</strong>
                  <span>
                    {shipNameById.get(drill.ship_id) ?? `Ship #${drill.ship_id}`} · Scheduled {drill.scheduled_date}
                    {drill.scheduled_time ? ` · Start ${drill.scheduled_time.slice(0, 5)}` : ""}
                    {drill.end_time ? ` · End ${drill.end_time.slice(0, 5)}` : ""}
                  </span>
                </div>
                <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                  <select
                    value={drill.status}
                    onChange={async (e) => {
                      try {
                        await updateSafetyDrill(drill.id, { status: e.target.value as SafetyDrill["status"] });
                        await reload();
                      } catch (err) {
                        setError(err instanceof Error ? err.message : "Failed to update drill");
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
                      setError(null);
                      try {
                        const rows = await getDrillAttendance(drill.id);
                        setAttendanceRows(rows);
                      } catch (err) {
                        setError(err instanceof Error ? err.message : "Failed to load attendance");
                      }
                    }}
                  >
                    Attendance
                  </button>
                  <button
                    className="ghost-button danger-button"
                    disabled={deletingDrillId === drill.id}
                    onClick={async () => {
                      const confirmed = window.confirm(`Delete ${drill.drill_type} scheduled for ${drill.scheduled_date}?`);
                      if (!confirmed) return;
                      setDeletingDrillId(drill.id);
                      setError(null);
                      try {
                        await deleteSafetyDrill(drill.id);
                        await reload();
                      } catch (err) {
                        setError(err instanceof Error ? err.message : "Failed to delete drill");
                      } finally {
                        setDeletingDrillId(null);
                      }
                    }}
                  >
                    {deletingDrillId === drill.id ? "Deleting..." : "Delete"}
                  </button>
                </div>
              </article>
            ))}
            {drills.length === 0 ? <p className="notice">No drills scheduled.</p> : null}
          </div>
        </section>

        {attendanceDrill ? (
          <div className="modal-overlay" onClick={() => setAttendanceDrill(null)} role="presentation">
            <section className="modal" onClick={(e) => e.stopPropagation()}>
              <header className="modal-header">
                <div>
                  <strong>{attendanceDrill.drill_type}</strong>
                  <span>
                    Scheduled {attendanceDrill.scheduled_date}
                    {attendanceDrill.scheduled_time ? ` · Start ${attendanceDrill.scheduled_time.slice(0, 5)}` : ""}
                    {attendanceDrill.end_time ? ` · End ${attendanceDrill.end_time.slice(0, 5)}` : ""} ·{" "}
                    {shipNameById.get(attendanceDrill.ship_id) ?? `Ship #${attendanceDrill.ship_id}`}
                  </span>
                </div>
                <button className="ghost-button" onClick={() => setAttendanceDrill(null)}>Close</button>
              </header>
              <div className="list">
                {!attendanceRows ? (
                  <p className="notice">Loading attendance…</p>
                ) : attendanceRows.length === 0 ? (
                  <p className="notice">No crew assigned to this ship yet.</p>
                ) : (
                  attendanceRows.map((row) => (
                    <article className="row-card" key={row.id}>
                      <div>
                        <strong>{row.user.username}</strong>
                        <span>{row.user.email}</span>
                        {row.attended_at ? <span>Attended {new Date(row.attended_at).toLocaleString()}</span> : null}
                        {row.completed_at ? <span>Completed {new Date(row.completed_at).toLocaleString()}</span> : null}
                      </div>
                      <span className="status-pill">{row.attendance ? "present" : row.completion_status}</span>
                    </article>
                  ))
                )}
              </div>
            </section>
          </div>
        ) : null}

        {createOpen ? (
          <div className="modal-overlay" onClick={() => setCreateOpen(false)} role="presentation">
            <section className="modal modal-narrow" onClick={(e) => e.stopPropagation()}>
              <header className="modal-header">
                <div>
                  <strong><CalendarPlus size={18} /> Schedule drill</strong>
                  <span>Crew assigned to the selected ship will appear in attendance.</span>
                </div>
                <button className="ghost-button" onClick={() => setCreateOpen(false)}>Close</button>
              </header>
              <form className="form" onSubmit={onCreate}>
                <label>
                  Drill type
                  <input value={drillType} onChange={(e) => setDrillType(e.target.value)} required />
                </label>
                <label>
                  Ship
                  <select
                    value={shipId || (selectedShipId !== "all" ? selectedShipId : "")}
                    onChange={(e) => setShipId(e.target.value ? Number(e.target.value) : "")}
                    required
                  >
                    <option value="">Select ship</option>
                    {ships.map((s) => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </label>
                <label>
                  Scheduled date
                  <input type="date" value={scheduledDate} onChange={(e) => setScheduledDate(e.target.value)} required />
                </label>
                <label>
                  Start time
                  <input type="time" value={scheduledTime} onChange={(e) => setScheduledTime(e.target.value)} required />
                </label>
                <label>
                  End time
                  <input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} required />
                </label>
                <button className="icon-button"><Plus size={18} /> Schedule drill</button>
              </form>
            </section>
          </div>
        ) : null}
      </main>
    </AppShell>
  );
}
