import { trace } from "@/debug/trace";
trace("App.tsx");
import { QueryClientProvider } from "@tanstack/react-query";
import { getQueryClient } from "@/features/query/queryClient";
import { AuthProvider } from "@/features/auth/AuthProvider";

// App.tsx (TEMP) - Testing React Query + Auth
export default function App() {
  return (
    <QueryClientProvider client={getQueryClient()}>
      <AuthProvider>
        <div data-probe="with-auth">ok</div>
      </AuthProvider>
    </QueryClientProvider>
  );
}