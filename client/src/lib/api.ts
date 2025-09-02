import { AuthToken } from './auth-token';

// Auth store compatible with your specification
export const authStore = {
  getState() {
    return {
      token: AuthToken.get()
    };
  }
};

export async function apiFetch(path: string, init: RequestInit = {}) {
  const token = authStore.getState().token;
  const headers = new Headers(init.headers || {});
  if (init.body && !(init.body instanceof FormData) && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  headers.set('Accept', 'application/json');
  if (token) headers.set('Authorization', `Bearer ${token}`);
  return fetch(path, { ...init, headers, credentials: 'include' });
}