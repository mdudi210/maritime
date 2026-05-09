import { useEffect, useMemo, useState } from "react";
import AppShell from "../components/AppShell";
import { getDrillAttendance, getSafetyDrillsFiltered, getShips, getUsers } from "../api/maritimeApi";
import type { DrillAttendanceEntry, SafetyDrill, Ship, UserSummary } from "../types/api";

type AttendanceReportRow = DrillAttendanceEntry & { drill: SafetyDrill };

export default function AttendancePage() {
  const [ships, setShips] = useState<Ship[]>([]);
  const [selectedShipId, setSelectedShipId] = useState<number | "all">("all");
  const [drillType, setDrillType] = useState("all");
  const [crewId, setCrewId] = useState<number | "all">("all");
  const [statusFilter, setStatusFilter] = useState<"all" | "completed" | "pending" | "missed">("all");
  const [scheduledFrom, setScheduledFrom] = useState("");
  const [scheduledTo, setScheduledTo] = useState("");
  const [drills, setDrills] = useState<SafetyDrill[]>([]);
  const [crew, setCrew] = useState<UserSummary[]>([]);
  const [rows, setRows] = useState<AttendanceReportRow[] | null>(null);
  const [visibleCount, setVisibleCount] = useState(50);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        setError(null);
        setRows(null);
        const [nextShips, nextCrew, nextDrills] = await Promise.all([
          getShips(),
          getUsers({ role: "crew" }),
          getSafetyDrillsFiltered({
            shipId: selectedShipId,
            scheduled_from: scheduledFrom || undefined,
            scheduled_to: scheduledTo || undefined
          })
        ]);
        setShips(nextShips);
        setCrew(nextCrew);
        setDrills(nextDrills);
        const attendanceRows = await Promise.all(
          nextDrills.map(async (drill) => {
            const drillRows = await getDrillAttendance(drill.id);
            return drillRows.map((row) => ({ ...row, drill }));
          })
        );
        setRows(attendanceRows.flat());
        setVisibleCount(50);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load attendance data");
      }
    })();
  }, [selectedShipId, scheduledFrom, scheduledTo]);

  const shipNameById = useMemo(() => new Map(ships.map((ship) => [ship.id, ship.name])), [ships]);
  const drillTypes = useMemo(() => Array.from(new Set(drills.map((drill) => drill.drill_type))).sort(), [drills]);

  const filteredRows = useMemo(() => {
    return (rows ?? []).filter((row) => {
      const status = row.attendance ? "completed" : row.drill.status === "completed" ? "missed" : "pending";
      return (
        (drillType === "all" || row.drill.drill_type === drillType) &&
        (crewId === "all" || row.user_id === crewId) &&
        (statusFilter === "all" || status === statusFilter)
      );
    });
  }, [rows, drillType, crewId, statusFilter]);

  const visibleRows = filteredRows.slice(0, visibleCount);

  return (
    <AppShell>
      <main className="workspace">
        <header className="page-header">
          <div>
            <p className="eyebrow">Admin</p>
            <h1>Attendance monitor</h1>
          </div>
        </header>

        <section className="filter-bar attendance-filters">
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
            Drill type
            <select value={drillType} onChange={(event) => setDrillType(event.target.value)}>
              <option value="all">All drill types</option>
              {drillTypes.map((type) => (
                <option key={type} value={type}>{type}</option>
              ))}
            </select>
          </label>
          <label>
            Crew member
            <select value={crewId} onChange={(event) => setCrewId(event.target.value === "all" ? "all" : Number(event.target.value))}>
              <option value="all">All crew</option>
              {crew.map((member) => (
                <option key={member.id} value={member.id}>{member.username}</option>
              ))}
            </select>
          </label>
          <label>
            Status
            <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as typeof statusFilter)}>
              <option value="all">All statuses</option>
              <option value="completed">Completed</option>
              <option value="pending">Pending</option>
              <option value="missed">Missed</option>
            </select>
          </label>
          <label>
            Date from
            <input type="date" value={scheduledFrom} onChange={(event) => setScheduledFrom(event.target.value)} />
          </label>
          <label>
            Date to
            <input type="date" value={scheduledTo} onChange={(event) => setScheduledTo(event.target.value)} />
          </label>
        </section>

        {error ? <p className="error">{error}</p> : null}

        <section className="panel">
          <h2>Attendance report</h2>
          <div className="list">
            {!rows ? (
              <p className="notice">Loading attendance…</p>
            ) : visibleRows.length === 0 ? (
              <p className="notice">No records found.</p>
            ) : (
              visibleRows.map((row) => {
                const status = row.attendance ? "completed" : row.drill.status === "completed" ? "missed" : "pending";
                return (
                  <article className="row-card" key={`${row.drill_id}-${row.user_id}`}>
                    <div>
                      <strong>{row.user.username}</strong>
                      <span>{row.user.email}</span>
                      <span>
                        {row.drill.drill_type} · {shipNameById.get(row.drill.ship_id) ?? `Ship #${row.drill.ship_id}`} · {row.drill.scheduled_date}
                        {row.drill.scheduled_time ? ` · Start ${row.drill.scheduled_time.slice(0, 5)}` : ""}
                        {row.drill.end_time ? ` · End ${row.drill.end_time.slice(0, 5)}` : ""}
                      </span>
                      {row.attended_at ? <span>Attended {new Date(row.attended_at).toLocaleString()}</span> : null}
                      {row.completed_at ? <span>Completed {new Date(row.completed_at).toLocaleString()}</span> : null}
                    </div>
                    <span className="status-pill">{status}</span>
                  </article>
                );
              })
            )}
          </div>
          {visibleRows.length < filteredRows.length ? (
            <button className="ghost-button" style={{ marginTop: 14 }} onClick={() => setVisibleCount((count) => count + 50)}>
              Load more
            </button>
          ) : null}
        </section>
      </main>
    </AppShell>
  );
}
