import { useEffect } from "react";
import { useLocation } from "wouter";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import { getLastLeagueId, setLastLeagueId } from "./useLastLeague";
import { startTransition } from "react";

// API adapters using existing endpoints
async function fetchMyLeagues() {
  const res = await fetch("/api/user/leagues", {
    credentials: 'include'
  });
  if (!res.ok) throw new Error("Failed to load leagues");
  return res.json() as Promise<Array<{ id: string; updatedAt: string; name: string }>>;
}

async function fetchActiveDraft(leagueId: string) {
  try {
    const res = await fetch(`/api/leagues/${leagueId}`, {
      credentials: 'include'
    });
    if (!res.ok) return null;
    const data = await res.json();
    
    // Use draftStatus field directly from storage layer
    if (data.draftStatus) {
      const draftStatus = data.draftStatus;
      if (draftStatus === "active") return { status: "active", draftId: data.draftId };
      if (draftStatus === "idle") return { status: "idle", draftId: data.draftId };
      // If completed or any other status, return none (go to dashboard)
      return { status: "none", draftId: data.draftId };
    }
    
    // Fallback for leagues without drafts
    return {
      status: data.draftStarted ? "active" : data.draftId ? "idle" : "none",
      draftId: data.draftId
    } as { status: "idle" | "active" | "none"; draftId?: string };
  } catch { 
    return null; 
  }
}

export function useSmartRedirect(enabled: boolean) {
  const [location, setLocation] = useLocation();
  const queryClient = useQueryClient();

  const urlParams = new URLSearchParams(window.location.search);
  const stay = urlParams.get("stay") === "true";
  
  const { data: leagues, isLoading } = useQuery({
    queryKey: ["/api/user/leagues"],
    queryFn: fetchMyLeagues,
    enabled,
    staleTime: 10_000,
  });

  useEffect(() => {
    if (!enabled || isLoading) return;
    if (stay) return; // explicit stay on dashboard

    // If already on a league/draft page, do nothing
    if (location.startsWith("/league") || location.startsWith("/draft")) return;
    
    // Skip redirection if on specific pages
    if (location === "/leagues" || location === "/dashboard") return;

    const last = getLastLeagueId();
    const hasLast = last && leagues?.some(l => l.id === last);

    const pickLeagueId =
      (hasLast && last) ||
      leagues?.toSorted((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())[0]?.id ||
      null;

    if (!pickLeagueId) {
      // No leagues → go to dashboard (which will show create/join options)
      if (location !== "/dashboard") {
        startTransition(() => {
          setLocation("/dashboard");
        });
      }
      return;
    }

    (async () => {
      try {
        // Check draft state for that league
        const draft = await fetchActiveDraft(pickLeagueId);
        
        // Update last league context
        setLastLeagueId(pickLeagueId);
        
        // Prefer draft if active
        if (draft?.status === "active" && draft.draftId) {
          startTransition(() => {
            setLocation(`/draft/${draft.draftId}`);
          });
        } else if (draft?.status === "idle" && draft.draftId) {
          // Draft exists but not started - go to waiting room
          startTransition(() => {
            setLocation(`/league/waiting?id=${pickLeagueId}`);
          });
        } else {
          // No draft or completed draft - go to main app (scores, teams, etc.)
          console.log('[SmartRedirect] No active/idle draft found, going to main app');
          startTransition(() => {
            setLocation("/");
          });
        }
        
        // Warm caches
        queryClient.prefetchQuery({ 
          queryKey: [`/api/leagues/${pickLeagueId}/standings`] 
        });
      } catch (error) {
        console.log('[SmartRedirect] Error checking draft status:', error);
        // Fallback to league page
        setLastLeagueId(pickLeagueId);
        startTransition(() => {
          setLocation(`/league/waiting?id=${pickLeagueId}`);
        });
      }
    })();
  }, [enabled, isLoading, stay, location, leagues, setLocation, queryClient]);
}