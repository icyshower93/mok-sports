import { useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { unauthorizedBehaviorToQueryFunction } from "@/features/query/queryClient";

export function QueryProvider({ children }: { children: React.ReactNode }) {
  const [client] = useState(() => new QueryClient({
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
  }));
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}