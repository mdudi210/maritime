import type {
  ComplianceItems,
  DashboardMetrics,
  DrillAttendanceEntry,
  MaintenanceTask,
  SafetyDrill,
  Ship,
  TaskComment,
  UserSummary
} from "../types/api";
import { apiRequest } from "./client";

function withShip(path: string, shipId?: number | "all") {
  return shipId && shipId !== "all" ? `${path}${path.includes("?") ? "&" : "?"}ship_id=${shipId}` : path;
}

export function getDashboard(shipId?: number | "all") {
  return apiRequest<DashboardMetrics>(withShip("/dashboard/compliance", shipId));
}

export function getComplianceItems(shipId?: number | "all") {
  return apiRequest<ComplianceItems>(withShip("/dashboard/compliance/items", shipId));
}

export function getShips(filters?: { search?: string; status?: string }) {
  const params = new URLSearchParams();
  if (filters?.search) params.set("search", filters.search);
  if (filters?.status && filters.status !== "all") params.set("status", filters.status);
  const query = params.toString();
  return apiRequest<Ship[]>(`/ships${query ? `?${query}` : ""}`);
}

export function getShip(id: number) {
  return apiRequest<Ship>(`/ships/${id}`);
}

export function createShip(payload: { name: string; imo_number?: string; current_port?: string }) {
  return apiRequest<Ship>("/ships", { method: "POST", body: JSON.stringify(payload) }, true);
}

export function getMaintenanceTasks(shipId?: number | "all") {
  return apiRequest<MaintenanceTask[]>(withShip("/maintenance", shipId));
}

export function getMaintenanceTasksFiltered(filters: {
  shipId?: number | "all";
  status?: "pending" | "in_progress" | "completed" | "all";
  due_from?: string;
  due_to?: string;
}) {
  const params = new URLSearchParams();
  if (filters.status && filters.status !== "all") params.set("status_filter", filters.status);
  if (filters.due_from) params.set("due_from", filters.due_from);
  if (filters.due_to) params.set("due_to", filters.due_to);
  const base = withShip("/maintenance", filters.shipId);
  const joined = `${base}${base.includes("?") ? "&" : "?"}${params.toString()}`;
  return apiRequest<MaintenanceTask[]>(params.toString() ? joined : base);
}

export function createMaintenanceTask(payload: {
  title: string;
  description?: string;
  ship_id: number;
  assigned_to_id?: number;
  due_date: string;
}) {
  return apiRequest<MaintenanceTask>("/maintenance", { method: "POST", body: JSON.stringify(payload) }, true);
}

export function updateMaintenanceStatus(id: number, status: MaintenanceTask["status"]) {
  return apiRequest<MaintenanceTask>(`/maintenance/${id}`, {
    method: "PATCH",
    body: JSON.stringify({ status })
  }, true);
}

export function getTaskComments(taskId: number) {
  return apiRequest<TaskComment[]>(`/maintenance/${taskId}/comments`);
}

export function addTaskComment(taskId: number, comment: string) {
  return apiRequest<TaskComment>(
    `/maintenance/${taskId}/comments`,
    { method: "POST", body: JSON.stringify({ comment }) },
    true
  );
}

export function getSafetyDrills(shipId?: number | "all") {
  return apiRequest<SafetyDrill[]>(withShip("/drills", shipId));
}

export function getSafetyDrillsFiltered(filters: {
  shipId?: number | "all";
  status?: "scheduled" | "completed" | "missed" | "all";
  scheduled_from?: string;
  scheduled_to?: string;
}) {
  const params = new URLSearchParams();
  if (filters.status && filters.status !== "all") params.set("status_filter", filters.status);
  if (filters.scheduled_from) params.set("scheduled_from", filters.scheduled_from);
  if (filters.scheduled_to) params.set("scheduled_to", filters.scheduled_to);
  const base = withShip("/drills", filters.shipId);
  const joined = `${base}${base.includes("?") ? "&" : "?"}${params.toString()}`;
  return apiRequest<SafetyDrill[]>(params.toString() ? joined : base);
}

export function createSafetyDrill(payload: { drill_type: string; ship_id: number; scheduled_date: string }) {
  return apiRequest<SafetyDrill>("/drills", { method: "POST", body: JSON.stringify(payload) }, true);
}

export function updateSafetyDrill(
  drillId: number,
  payload: Partial<Pick<SafetyDrill, "drill_type" | "scheduled_date" | "status">>
) {
  return apiRequest<SafetyDrill>(
    `/drills/${drillId}`,
    { method: "PATCH", body: JSON.stringify(payload) },
    true
  );
}

export function getDrillAttendance(drillId: number) {
  return apiRequest<DrillAttendanceEntry[]>(`/drills/${drillId}/attendance`);
}

export function markDrillAttendance(drillId: number, attendance = true) {
  return apiRequest<DrillAttendanceEntry>(
    `/drills/${drillId}/attendance/mark`,
    { method: "POST", body: JSON.stringify({ attendance }) },
    true
  );
}

export function submitDrillCompletion(drillId: number, completed = true) {
  return apiRequest<DrillAttendanceEntry>(
    `/drills/${drillId}/complete`,
    { method: "POST", body: JSON.stringify({ completed }) },
    true
  );
}

export function getUsers(filters?: { role?: "admin" | "crew"; ship_id?: number }) {
  const params = new URLSearchParams();
  if (filters?.role) params.set("role", filters.role);
  if (filters?.ship_id) params.set("ship_id", String(filters.ship_id));
  const query = params.toString();
  return apiRequest<UserSummary[]>(`/users${query ? `?${query}` : ""}`);
}

export function createUser(payload: {
  email: string;
  username: string;
  password: string;
  role: "admin" | "crew";
  ship_id?: number | null;
}) {
  return apiRequest<UserSummary>("/users", { method: "POST", body: JSON.stringify(payload) }, true);
}
