import { readCookie } from "../utils/cookies";

export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8000/api";

export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

function buildHeaders(input?: HeadersInit, includeCsrf = false): Headers {
  const headers = new Headers(input || {});
  if (!headers.has("Accept")) {
    headers.set("Accept", "application/json");
  }
  if (!headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  if (includeCsrf) {
    const csrf = readCookie("csrf_token");
    if (csrf) {
      headers.set("X-CSRF-Token", csrf);
    }
  }
  return headers;
}

async function toApiError(response: Response): Promise<ApiError> {
  try {
    const payload = await response.json();
    return new ApiError(String(payload.detail || payload.message || "Request failed"), response.status);
  } catch {
    return new ApiError(`Request failed (${response.status})`, response.status);
  }
}

export async function apiRequest<T>(path: string, init?: RequestInit, withCsrf = false): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    credentials: "include",
    headers: buildHeaders(init?.headers, withCsrf)
  });
  if (!response.ok) {
    throw await toApiError(response);
  }
  return (await response.json()) as T;
}
