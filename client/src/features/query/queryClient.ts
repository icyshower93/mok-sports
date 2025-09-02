// Debug imports removed
import { QueryClient, QueryFunction } from "@tanstack/react-query";

// NOTE: no top-level import of AuthToken to avoid cycles

export const unauthorizedBehaviorToQueryFunction = (
  unauthorizedBehavior: "returnNull" | "throw" = "throw",
): QueryFunction<any> =>
  async ({ queryKey, signal }) => {
    try {
      // 👇 Lazy import to break cycles with auth modules
      const { AuthToken } = await import("@/lib/auth-token");

      const res = await fetch(queryKey.join("/") as string, {
        headers: AuthToken.headers(),
        credentials: "include",
        signal, // ✅ Add signal for proper cancellation
      });

      if (unauthorizedBehavior === "returnNull" && res.status === 401) return null;

      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(`HTTP ${res.status} ${res.statusText}${text ? ` - ${text}` : ""}`);
      }
      return await res.json();
    } catch (error: any) {
      // ✅ Don't throw AbortError - let React Query handle cancellation silently
      if (error?.name === "AbortError" || error?.message?.includes("signal is aborted")) {
        return; // React Query will handle this gracefully
      }
      throw error;
    }
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
        retry: (failureCount, error: any) => {
          // ✅ Don't retry AbortErrors
          if (error?.name === "AbortError" || error?.message?.includes("signal is aborted")) {
            return false;
          }
          return error?.message?.includes("401") ? false : failureCount < 2;
        },
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