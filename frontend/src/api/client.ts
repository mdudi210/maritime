import { readCookie } from "../utils/cookies";

export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000/api";

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
    if (Array.isArray(payload.detail)) {
      const message = payload.detail
        .map((item: { loc?: string[]; msg?: string }) => {
          const field = item.loc?.filter((part) => part !== "body").join(".");
          return field ? `${field}: ${item.msg || "Invalid value"}` : item.msg || "Invalid value";
        })
        .join("; ");
      return new ApiError(message || `Request failed (${response.status})`, response.status);
    }
    return new ApiError(String(payload.detail || payload.message || "Request failed"), response.status);
  } catch {
    return new ApiError(`Request failed (${response.status})`, response.status);
  }
}

export async function apiRequest<T>(path: string, init?: RequestInit, withCsrf = false, isRetry = false): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    credentials: "include",
    headers: buildHeaders(init?.headers, withCsrf)
  });
  
  if (!response.ok) {
    // Auto-refresh token on 401 if it's not already a retry and not the auth endpoints themselves
    if (response.status === 401 && !isRetry && path !== "/auth/login" && path !== "/auth/refresh") {
      try {
        const refreshResponse = await fetch(`${API_BASE_URL}/auth/refresh`, {
          method: "POST",
          credentials: "include",
          headers: buildHeaders(undefined, true) // requires CSRF
        });
        
        if (refreshResponse.ok) {
          // Successfully refreshed, retry the original request
          return await apiRequest<T>(path, init, withCsrf, true);
        }
      } catch {
        // If refresh fails, fall through and throw the original 401 error
      }
    }
    
    throw await toApiError(response);
  }
  
  if (response.status === 204) {
    return undefined as T;
  }
  return (await response.json()) as T;
}
