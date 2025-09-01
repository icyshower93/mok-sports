import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/features/auth/useAuth";

interface League {
  id: string;
  name: string;
  joinCode: string;
  memberCount: number;
  maxTeams: number;
  creatorId: string;
  draftStarted: boolean;
  draftId: string | null;
  updatedAt: string;
  createdAt: string;
}

export function useHasLeague() {
  const { user, isAuthenticated } = useAuth();
  
  const { data: myLeagues, isLoading } = useQuery({
    queryKey: ["/api/user/leagues"],
    enabled: isAuthenticated && !!user,
    staleTime: 10_000,
  }) as { data: League[] | undefined; isLoading: boolean };

  const hasLeague = useMemo(() => {
    if (isLoading) return undefined; // "unknown" while loading
    return Boolean(myLeagues && myLeagues.length > 0);
  }, [isLoading, myLeagues]);

  return { hasLeague, isLoading, leagues: myLeagues };
}