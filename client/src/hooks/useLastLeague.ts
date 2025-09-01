import { useCallback } from "react";

const KEY = "mok:lastLeagueId";

export function getLastLeagueId(): string | null {
  try { 
    return localStorage.getItem(KEY); 
  } catch { 
    return null; 
  }
}

export function setLastLeagueId(id: string | null) {
  try {
    if (!id) {
      localStorage.removeItem(KEY);
    } else {
      localStorage.setItem(KEY, id);
    }
  } catch {
    // Handle localStorage access issues (e.g., SSR, incognito mode)
  }
}

export function useLastLeague() {
  const rememberLeague = useCallback((leagueId: string) => {
    setLastLeagueId(leagueId);
  }, []);
  
  const clearLeague = useCallback(() => {
    setLastLeagueId(null);
  }, []);
  
  return { 
    getLastLeagueId, 
    rememberLeague, 
    clearLeague 
  };
}