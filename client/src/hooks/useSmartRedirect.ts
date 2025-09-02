import { useEffect } from "react";
import { useLocation } from "wouter";
import { startTransition } from "react";
import { useHasLeague } from "@/features/leagues/useHasLeague";

export function useSmartRedirect(enabled: boolean) {
  const [location, setLocation] = useLocation();
  const { hasLeague } = useHasLeague();

  useEffect(() => {
    // Only run when explicitly enabled
    if (!enabled || hasLeague === undefined) return;

    const onLanding = 
      location === "/" ||
      location === "/dashboard" ||
      location === "/league" ||
      location.startsWith("/league/");

    // Debug log to confirm redirect state
    console.debug("[SmartRedirect]", { location, hasLeague, onLanding, enabled });

    if (!hasLeague) {
      // New user: only redirect if they're on a landing-ish route
      if (!location.startsWith("/dashboard")) {
        console.log("[SmartRedirect] No leagues, redirecting to dashboard from", location);
        startTransition(() => {
          setLocation("/dashboard");
        });
      }
      return;
    }

    // Users with leagues: only redirect from landing pages, never hijack normal tabs
    if (onLanding && location !== "/") {
      console.log("[SmartRedirect] Has leagues, redirecting to main app from landing page", location);
      startTransition(() => {
        setLocation("/");
      });
    }
  }, [enabled, hasLeague, location, setLocation]);
}