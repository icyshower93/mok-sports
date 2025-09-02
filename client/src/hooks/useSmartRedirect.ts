import { useEffect } from "react";
import { useLocation } from "wouter";
import { startTransition } from "react";
import { useHasLeague } from "@/features/leagues/useHasLeague";
import { useAuth } from "@/features/auth/useAuth";
import { useQuery } from "@tanstack/react-query";

export function useSmartRedirect(enabled: boolean) {
  const [location, setLocation] = useLocation();
  const { hasLeague, isLoading: leaguesLoading, leagues } = useHasLeague();
  const { isAuthenticated, isLoading: authLoading } = useAuth();

  // SAFETY: don't decide anything until data is ready
  const authReady = !authLoading && (isAuthenticated || !isAuthenticated);
  const dataReady = authReady && !leaguesLoading;

  // Detect draft route patterns
  const isDraftRoute = location.startsWith("/draft/") || location.startsWith("/league/waiting");
  
  // Extract league ID from various route patterns
  const leagueIdFromUrl = (() => {
    if (location.startsWith("/draft/")) {
      return location.split("/draft/")[1]?.split("?")[0];
    }
    if (location.startsWith("/league/waiting")) {
      const params = new URLSearchParams(location.split("?")[1] || "");
      return params.get("id");
    }
    return null;
  })();

  // Get draft info for the current league if we're on a draft route
  const { data: draftInfo } = useQuery({
    queryKey: ["/api/drafts/league", leagueIdFromUrl],
    enabled: !!leagueIdFromUrl && dataReady && isDraftRoute,
    retry: false,
  }) as { data: { draft?: { status: string } } | undefined };

  useEffect(() => {
    // Only run when explicitly enabled and data is ready
    if (!enabled || !dataReady) return;

    // Any of these are NORMAL app tabs. Never hijack them.
    const isNormalTab =
      location === "/" ||
      location === "/scores" ||
      location === "/teams" ||
      location === "/more" ||
      location.startsWith("/trades") ||
      location.startsWith("/profile") ||
      location.startsWith("/agents") ||
      location.startsWith("/admin") ||
      location.startsWith("/database") ||
      location === "/leagues" ||
      location.startsWith("/leagues/");

    if (isNormalTab) {
      // Do not perform any redirect logic on real app tabs.
      return;
    }

    // If we're on a draft page, only leave if draft is completed or not found
    if (isDraftRoute) {
      const draftStatus = draftInfo?.draft?.status;
      
      console.debug("[SmartRedirect] Draft route detected", { 
        location, 
        leagueIdFromUrl, 
        draftStatus, 
        hasDraftInfo: !!draftInfo 
      });

      // If we just created the league/draft but store didn't hydrate yet, be lenient: stay put.
      // Only redirect away if draft is explicitly completed/canceled or confirmed not found
      if (draftInfo === null || draftStatus === "completed" || draftStatus === "canceled") {
        console.log("[SmartRedirect] Draft is done/non-existent, redirecting to main app from", location);
        startTransition(() => {
          setLocation("/");
        });
      }
      // else: pending/waiting/active → stay in draft room
      return;
    }

    const onLanding = 
      location === "/" ||
      location === "/dashboard" ||
      location === "/league";

    // Debug log to confirm redirect state
    console.debug("[SmartRedirect]", { location, hasLeague, onLanding, enabled, dataReady });

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

    // Users with leagues: check if they have an incomplete draft
    if (hasLeague && leagues && leagues.length > 0) {
      // Choose the league the user most recently created/joined, or first one
      const currentLeague = leagues[0]; // Since leagues are sorted by most recent
      
      if (currentLeague.draftId && currentLeague.draftStarted) {
        // There's an active draft - check if user should be in draft room
        if (onLanding && location !== "/") {
          console.log("[SmartRedirect] Has active draft, redirecting to league waiting room from", location);
          startTransition(() => {
            setLocation(`/league/waiting?id=${currentLeague.id}`);
          });
          return;
        }
      } else {
        // No active draft - send to main app from landing pages
        if (onLanding && location !== "/") {
          console.log("[SmartRedirect] Has leagues but no active draft, redirecting to main app from", location);
          startTransition(() => {
            setLocation("/");
          });
        }
      }
    }
  }, [
    enabled,
    dataReady,
    isDraftRoute,
    leagueIdFromUrl,
    draftInfo?.draft?.status,
    hasLeague,
    leagues,
    location,
    setLocation
  ]);
}