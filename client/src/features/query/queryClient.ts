import { QueryClient, QueryFunction } from "@tanstack/react-query";
import { AuthToken } from "@/lib/auth-token";

export const unauthorizedBehaviorToQueryFunction = (
  unauthorizedBehavior: "returnNull" | "throw" = "throw",
): QueryFunction<any> =>
  async ({ queryKey }) => {
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

// Maintain backward compatibility while using new AuthToken utility
export const AuthTokenManager = {
  getToken: () => AuthToken.get(),
  setToken: (token: string) => AuthToken.set(token),
  removeToken: () => AuthToken.clear(),
  getAuthHeaders: () => AuthToken.headers()
};