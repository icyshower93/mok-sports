import { QueryClientProvider } from "@tanstack/react-query";
import { getQueryClient } from "@/features/query/queryClient";
import { AuthProvider } from "@/features/auth/AuthProvider";
import { ThemeProvider } from "@/providers/ThemeProvider";
import { getRouter } from "@/routes/router";
import { Suspense } from "react";

export default function App() {
  return (
    <ThemeProvider defaultTheme="dark">
      <QueryClientProvider client={getQueryClient()}>
        <AuthProvider>
          <Suspense fallback={<div className="flex items-center justify-center min-h-screen">Loading...</div>}>
            {getRouter()}
          </Suspense>
        </AuthProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}