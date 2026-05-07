import type { LoginResponse, UserSummary } from "../types/api";
import { apiRequest } from "./client";

export function login(payload: { email_or_username: string; password: string }) {
  return apiRequest<LoginResponse>("/auth/login", {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export function me() {
  return apiRequest<UserSummary>("/users/me", { method: "GET" });
}

export function refresh() {
  return apiRequest<{ message: string }>("/auth/refresh", { method: "POST" }, true);
}

export function logout() {
  return apiRequest<{ message: string }>("/auth/logout", { method: "POST" }, true);
}

export function logoutAll() {
  return apiRequest<{ message: string }>("/auth/logout-all", { method: "POST" }, true);
}
