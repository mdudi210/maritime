import { useEffect, useMemo, useState } from "react";
import AppShell from "../components/AppShell";
import { getDrillAttendance, getSafetyDrills, getShips } from "../api/maritimeApi";
import type { DrillAttendanceEntry, SafetyDrill, Ship } from "../types/api";

export default function AttendancePage() {
  const [ships, setShips] = useState<Ship[]>([]);
  const [selectedShipId, setSelectedShipId] = useState<number | "all">("all");
  const [drills, setDrills] = useState<SafetyDrill[]>([]);
  const [selectedDrillId, setSelectedDrillId] = useState<number | null>(null);
  const [attendance, setAttendance] = useState<DrillAttendanceEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        setError(null);
        const [nextShips, nextDrills] = await Promise.all([getShips(), getSafetyDrills(selectedShipId)]);
        setShips(nextShips);
        setDrills(nextDrills);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load attendance data");
      }
    })();
  }, [selectedShipId]);

  const selectedDrill = useMemo(
    () => drills.find((drill) => drill.id === selectedDrillId) ?? null,
    [drills, selectedDrillId]
  );

  useEffect(() => {
    if (!selectedDrillId) {
      setAttendance(null);
      return;
    }
    (async () => {
      try {
        setError(null);
        setAttendance(null);
        const rows = await getDrillAttendance(selectedDrillId);
        setAttendance(rows);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load drill attendance");
      }
    })();
  }, [selectedDrillId]);

  return (
    <AppShell>
      <main className="workspace">
        <header className="page-header">
          <div>
            <p className="eyebrow">Admin</p>
            <h1>Attendance monitor</h1>
          </div>
        </header>

        <section className="filter-bar" style={{ gridTemplateColumns: "1fr 2fr" }}>
          <label>
            Ship
            <select
              value={selectedShipId}
              onChange={(event) => setSelectedShipId(event.target.value === "all" ? "all" : Number(event.target.value))}
            >
              <option value="all">All ships</option>
              {ships.map((ship) => (
                <option key={ship.id} value={ship.id}>
                  {ship.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Drill
            <select value={selectedDrillId ?? ""} onChange={(event) => setSelectedDrillId(event.target.value ? Number(event.target.value) : null)}>
              <option value="">Select a drill</option>
              {drills.map((drill) => (
                <option key={drill.id} value={drill.id}>
                  {drill.drill_type} · Ship #{drill.ship_id} · {drill.scheduled_date}
                </option>
              ))}
            </select>
          </label>
        </section>

        {error ? <p className="error">{error}</p> : null}

        {selectedDrill ? (
          <section className="panel">
            <h2>Attendance</h2>
            <p className="notice">
              {selectedDrill.drill_type} · Ship #{selectedDrill.ship_id} · Scheduled {selectedDrill.scheduled_date}
            </p>
            <div className="list">
              {!attendance ? (
                <p className="notice">Loading attendance…</p>
              ) : attendance.length === 0 ? (
                <p className="notice">No crew assigned to this ship yet.</p>
              ) : (
                attendance.map((row) => (
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
        ) : (
          <section className="panel">
            <h2>Attendance</h2>
            <p className="notice">Pick a drill above to see attendance.</p>
          </section>
        )}
      </main>
    </AppShell>
  );
}

