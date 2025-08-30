import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "@/features/query/queryClient";

export function QueryProvider({ children }: { children: React.ReactNode }) {
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}