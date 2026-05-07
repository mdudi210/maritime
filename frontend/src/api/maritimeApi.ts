import type { DashboardMetrics, MaintenanceTask, SafetyDrill, Ship, UserSummary } from "../types/api";
import { apiRequest } from "./client";

function withShip(path: string, shipId?: number | "all") {
  return shipId && shipId !== "all" ? `${path}${path.includes("?") ? "&" : "?"}ship_id=${shipId}` : path;
}

export function getDashboard(shipId?: number | "all") {
  return apiRequest<DashboardMetrics>(withShip("/dashboard/compliance", shipId));
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

export function getSafetyDrills(shipId?: number | "all") {
  return apiRequest<SafetyDrill[]>(withShip("/drills", shipId));
}

export function createSafetyDrill(payload: { drill_type: string; ship_id: number; scheduled_date: string }) {
  return apiRequest<SafetyDrill>("/drills", { method: "POST", body: JSON.stringify(payload) }, true);
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
