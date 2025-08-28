import { QueryClient, QueryFunction } from "@tanstack/react-query";
import { AuthToken } from './auth-token';

// Maintain backward compatibility while using new AuthToken utility
export const AuthTokenManager = {
  getToken: () => AuthToken.get(),
  setToken: (token: string) => AuthToken.set(token),
  removeToken: () => AuthToken.clear(),
  getAuthHeaders: () => AuthToken.headers()
};

export async function apiRequest(
  method: 'GET'|'POST'|'PUT'|'PATCH'|'DELETE',
  url: string,
  body?: unknown,
  extraHeaders: Record<string,string> = {}
): Promise<Response> {
  const res = await fetch(url, {
    method,
    credentials: 'include',
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
      ...AuthToken.headers(),
      ...extraHeaders,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`HTTP ${res.status} ${res.statusText}${text ? ` - ${text}` : ''}`);
  }
  return res;
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const unauthorizedBehaviorToQueryFunction = (
  unauthorizedBehavior: UnauthorizedBehavior = "throw",
): QueryFunction<any> =>
  async ({ queryKey }) => {
    const res = await fetch(queryKey.join("/") as string, {
      headers: AuthToken.headers(),
      credentials: "include", // Keep cookies as fallback
    });

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      return null;
    }

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`HTTP ${res.status} ${res.statusText}${text ? ` - ${text}` : ''}`);
    }
    return await res.json();
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: unauthorizedBehaviorToQueryFunction("returnNull"),
      refetchOnMount: false,
      refetchOnWindowFocus: false,
      retry: (failureCount, error) => {
        if (error instanceof Error && error.message.includes("401")) {
          return false;
        }
        return failureCount < 2;
      },
      staleTime: 0, // Always stale for live data (draft state)
      gcTime: 5 * 60 * 1000, // 5 minutes
    },
    mutations: {
      retry: 0,
    },
  },
});