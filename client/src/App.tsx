import { trace } from "@/debug/trace";
trace("App.tsx");
import { QueryClientProvider } from "@tanstack/react-query";
import { getQueryClient } from "@/features/query/queryClient";

// App.tsx (TEMP) - Testing React Query
export default function App() {
  return (
    <QueryClientProvider client={getQueryClient()}>
      <div data-probe="rq-only">ok</div>
    </QueryClientProvider>
  );
}