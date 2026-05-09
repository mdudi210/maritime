import { FormEvent, useEffect, useMemo, useState } from "react";
import AppShell from "../components/AppShell";
import { createSafetyDrill, getDrillAttendance, getSafetyDrillsFiltered, getShips, updateSafetyDrill } from "../api/maritimeApi";
import type { DrillAttendanceEntry, SafetyDrill, Ship } from "../types/api";

export default function DrillManagementPage() {
  const [ships, setShips] = useState<Ship[]>([]);
  const [drills, setDrills] = useState<SafetyDrill[]>([]);
  const [selectedShipId, setSelectedShipId] = useState<number | "all">("all");
  const [drillType, setDrillType] = useState("Fire drill");
  const [scheduledDate, setScheduledDate] = useState("");
  const [shipId, setShipId] = useState<number | "">("");
  const [statusFilter, setStatusFilter] = useState<"all" | SafetyDrill["status"]>("all");
  const [scheduledFrom, setScheduledFrom] = useState("");
  const [scheduledTo, setScheduledTo] = useState("");
  const [attendanceDrill, setAttendanceDrill] = useState<SafetyDrill | null>(null);
  const [attendanceRows, setAttendanceRows] = useState<DrillAttendanceEntry[] | null>(null);
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
    if (!finalShipId) return;
    try {
      setError(null);
      await createSafetyDrill({ drill_type: drillType, ship_id: finalShipId, scheduled_date: scheduledDate });
      setScheduledDate("");
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to schedule drill");
    }
  };

  const missedCount = useMemo(() => drills.filter((d) => d.status === "missed").length, [drills]);

  return (
    <AppShell>
      <main className="workspace">
        <header className="page-header">
          <div>
            <p className="eyebrow">Admin</p>
            <h1>Drill management</h1>
          </div>
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

        <section className="admin-tools" style={{ gridTemplateColumns: "1fr" }}>
          <form className="inline-form" onSubmit={onCreate}>
            <h2>Schedule drill</h2>
            <input value={drillType} onChange={(e) => setDrillType(e.target.value)} required />
            <select value={shipId} onChange={(e) => setShipId(e.target.value ? Number(e.target.value) : "")}>
              <option value="">Ship</option>
              {ships.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
            <input type="date" value={scheduledDate} onChange={(e) => setScheduledDate(e.target.value)} required />
            <button className="icon-button">Schedule</button>
          </form>
        </section>

        <section className="panel">
          <h2>Drills</h2>
          <div className="list">
            {drills.map((drill) => (
              <article className={`row-card ${drill.status === "missed" ? "risk" : ""}`} key={drill.id}>
                <div>
                  <strong>{drill.drill_type}</strong>
                  <span>Ship #{drill.ship_id} · Scheduled {drill.scheduled_date}</span>
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
                  <span>Scheduled {attendanceDrill.scheduled_date} · Ship #{attendanceDrill.ship_id}</span>
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
                      </div>
                      <span className="status-pill">{row.attendance ? "present" : row.completion_status}</span>
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

