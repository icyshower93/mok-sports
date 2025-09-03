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

  // While unknown, don't render anything (prevents brief bottom-nav flash)
  if (hasLeague === undefined) {
    console.debug("[RequireLeague] loading state; returning null");
    return null;
  }

  if (!hasLeague && !isDraftRoute) {
    console.debug("[RequireLeague] no league and not allowed draft route; redirect -> /dashboard");
    return <Redirect to="/dashboard" />;
  }

  console.debug("[RequireLeague] has league; rendering children");
  return <>{children}</>;
}