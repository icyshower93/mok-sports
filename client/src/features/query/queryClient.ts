import { QueryClient, QueryFunction } from "@tanstack/react-query";
import { AuthToken } from '@/lib/auth-token';
import { markModule } from '@/lib/dup-guard';

markModule('features/query/queryClient');

// Query function with auth handling
export const unauthorizedBehaviorToQueryFunction = (
  unauthorizedBehavior: "returnNull" | "throw" = "throw",
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

// LAZY SINGLETON - eliminates TDZ and init-order hazards
let _qc: QueryClient | null = null;
export function getQueryClient(): QueryClient {
  // also survives duplicate module instances
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

// Keep compatibility - will be removed after migration
export const queryClient = getQueryClient();

// Maintain backward compatibility while using new AuthToken utility
export const AuthTokenManager = {
  getToken: () => AuthToken.get(),
  setToken: (token: string) => AuthToken.set(token),
  removeToken: () => AuthToken.clear(),
  getAuthHeaders: () => AuthToken.headers()
};