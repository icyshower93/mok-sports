import { AuthToken } from './auth-token';

export async function apiFetch(path: string, init: RequestInit = {}) {
  const token = AuthToken.get();
  const headers = new Headers(init.headers || {});
  
  // Set Content-Type automatically if body is JSON
  if (init.body && !(init.body instanceof FormData) && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  headers.set("Accept", "application/json");
  
  // Always include auth token if available
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const res = await fetch(path, {
    ...init,
    headers,
    credentials: "include", // Always send cookies for session-based auth
  });
  
  return res;
}