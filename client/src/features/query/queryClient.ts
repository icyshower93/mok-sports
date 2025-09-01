// Debug imports removed
import { QueryClient, QueryFunction } from "@tanstack/react-query";

// NOTE: no top-level import of AuthToken to avoid cycles

export const unauthorizedBehaviorToQueryFunction = (
  unauthorizedBehavior: "returnNull" | "throw" = "throw",
): QueryFunction<any> =>
  async ({ queryKey }) => {
    // 👇 Lazy import to break cycles with auth modules
    const { AuthToken } = await import("@/lib/auth-token");

    const res = await fetch(queryKey.join("/") as string, {
      headers: AuthToken.headers(),
      credentials: "include",
    });

    if (unauthorizedBehavior === "returnNull" && res.status === 401) return null;

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`HTTP ${res.status} ${res.statusText}${text ? ` - ${text}` : ""}`);
    }
    return await res.json();
  };

let _qc: QueryClient | null = null;
export function getQueryClient(): QueryClient {
  const g = globalThis as any;
  if (g.__MOK_QUERY_CLIENT__) return g.__MOK_QUERY_CLIENT__;
  if (_qc) return _qc;
  _qc = new QueryClient({
    defaultOptions: {
      queries: {
        queryFn: unauthorizedBehaviorToQueryFunction("returnNull"),
        refetchOnMount: false,
        refetchOnWindowFocus: false,
        retry: (failureCount, error: any) =>
          error?.message?.includes("401") ? false : failureCount < 2,
        staleTime: 0,
        gcTime: 5 * 60 * 1000,
      },
      mutations: { retry: 0 },
    },
  });
  g.__MOK_QUERY_CLIENT__ = _qc;
  return _qc;
}

// (Optional) keep if other modules expect this helper object:
export const AuthTokenManager = {
  getToken: async () => (await import("@/lib/auth-token")).AuthToken.get(),
  setToken: async (token: string) => (await import("@/lib/auth-token")).AuthToken.set(token),
  removeToken: async () => (await import("@/lib/auth-token")).AuthToken.clear(),
  getAuthHeaders: async () => (await import("@/lib/auth-token")).AuthToken.headers(),
};