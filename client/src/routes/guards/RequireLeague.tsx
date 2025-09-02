import { Redirect } from "wouter";
import { useHasLeague } from "@/features/leagues/useHasLeague";

export default function RequireLeague({ children }: { children: React.ReactNode }) {
  console.debug("[RequireLeague] entering");
  
  const { hasLeague } = useHasLeague();
  
  console.debug("[RequireLeague]", { hasLeague });

  // While unknown, don't render anything (prevents brief bottom-nav flash)
  if (hasLeague === undefined) {
    console.debug("[RequireLeague] loading state; returning null");
    return null;
  }

  if (!hasLeague) {
    console.debug("[RequireLeague] no league; redirect -> /dashboard");
    return <Redirect to="/dashboard" />;
  }

  console.debug("[RequireLeague] has league; rendering children");
  return <>{children}</>;
}