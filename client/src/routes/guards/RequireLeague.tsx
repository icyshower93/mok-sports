import { Redirect, useLocation } from "wouter";
import { useHasLeague } from "@/features/leagues/useHasLeague";

export default function RequireLeague({ 
  children 
}: { 
  children: React.ReactNode;
}) {
  console.debug("[RequireLeague] entering");
  
  const { hasLeague } = useHasLeague();
  const [location] = useLocation();
  const isDraftRoute = location.startsWith('/draft/');
  
  console.debug("[RequireLeague]", { hasLeague, isDraftRoute, location });

  // While unknown, show loading spinner instead of blank screen
  if (hasLeague === undefined) {
    console.debug("[RequireLeague] loading state; showing spinner");
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-sm opacity-70">Loading league data…</div>
      </div>
    );
  }

  if (!hasLeague && !isDraftRoute) {
    console.debug("[RequireLeague] no league and not allowed draft route; redirect -> /dashboard");
    return <Redirect to="/dashboard" />;
  }

  console.debug("[RequireLeague] has league; rendering children");
  return <>{children}</>;
}