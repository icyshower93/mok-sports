import { QueryClient, QueryFunction } from "@tanstack/react-query";
import { AuthToken } from '@/lib/auth-token';

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

// Singleton guard to prevent multiple QueryClient instances in case of import duplication
const g = globalThis as any;
export const queryClient: QueryClient =
  g.__MOK_QUERY_CLIENT__ ?? (g.__MOK_QUERY_CLIENT__ = new QueryClient({
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
  }));

// Maintain backward compatibility while using new AuthToken utility
export const AuthTokenManager = {
  getToken: () => AuthToken.get(),
  setToken: (token: string) => AuthToken.set(token),
  removeToken: () => AuthToken.clear(),
  getAuthHeaders: () => AuthToken.headers()
};