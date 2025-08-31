import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider, useQuery } from "@tanstack/react-query";

// Test 1: Create QueryClient directly (no lazy function)
const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: false, refetchOnWindowFocus: false }
  }
});

function TestComponent() {
  const { data, isLoading } = useQuery({
    queryKey: ['/api/auth/me'],
    queryFn: async () => {
      const res = await fetch('/api/auth/me', { credentials: 'include' });
      if (!res.ok) throw new Error('Failed');
      return res.json();
    }
  });

  if (isLoading) return <div>Loading...</div>;
  return <div>Data: {JSON.stringify(data)}</div>;
}

function MinimalApp() {
  return (
    <QueryClientProvider client={queryClient}>
      <TestComponent />
    </QueryClientProvider>
  );
}

createRoot(document.getElementById("root")!).render(<MinimalApp />);