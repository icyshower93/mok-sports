import { Redirect } from "wouter";
import { useHasLeague } from "@/features/leagues/useHasLeague";

export default function RequireLeague({ children }: { children: React.ReactNode }) {
  const { hasLeague } = useHasLeague();

  // While unknown, don't render anything (prevents brief bottom-nav flash)
  if (hasLeague === undefined) return null;

  if (!hasLeague) {
    return <Redirect to="/dashboard" />;
  }

  return <>{children}</>;
}