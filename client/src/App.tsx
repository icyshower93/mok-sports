import { trace } from "@/debug/trace";
trace("App.tsx");
import { QueryClientProvider } from "@tanstack/react-query";
import { getQueryClient } from "@/features/query/queryClient";
import { AuthProvider } from "@/features/auth/AuthProvider";
import { getRouter } from "@/routes/router";
import { Suspense } from "react";

// App.tsx (TEMP) - Testing React Query + Auth + Router
export default function App() {
  return (
    <QueryClientProvider client={getQueryClient()}>
      <AuthProvider>
        <Suspense fallback={<div>Loading...</div>}>
          {getRouter()}
        </Suspense>
      </AuthProvider>
    </QueryClientProvider>
  );
}