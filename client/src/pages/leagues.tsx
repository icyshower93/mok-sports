import React, { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/features/auth/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from "@/components/ui/dialog";
import { Trophy, Crown, Medal, Award, TrendingUp, Zap, Eye, Lock, Shield } from "lucide-react";
import { MainLayout } from "@/components/layout/main-layout";
import { getCurrentSeason } from "@/lib/season";

interface SeasonStandings {
  userId: string;
  userName: string;
  totalMokPoints: number;
  locksCorrect: number;
  lockSuccessRate: number;
  lockAndLoadSuccessRate: number;
  skinsWon: number;
  rank: number;
  isCurrentUser?: boolean;
}

interface StandingsResponse {
  standings: SeasonStandings[];
  season: number;
  currentWeek: number;
  leagueInfo: {
    id: string;
    name: string;
    memberCount: number;
  };
}

export default function LeaguesPage() {
  console.debug("[Leagues] mount");
  const [selectedPlayer, setSelectedPlayer] = useState<string | null>(null);
  
  useEffect(() => {
    return () => console.debug("[Leagues] unmount");
  }, []);
  
  const { user } = useAuth();
  const season = getCurrentSeason();
  
  // Get user's current league (using first league for now)
  const { data: userLeagues } = useQuery({
    queryKey: ['/api/user/leagues'],
    enabled: !!user,
  });

  const leagueId = Array.isArray(userLeagues) && userLeagues.length > 0 ? userLeagues[0].id : null;

  // Get player roster when selected
  const { data: playerRoster } = useQuery({
    queryKey: ["player-roster", selectedPlayer, leagueId],
    enabled: !!selectedPlayer && !!leagueId,
    queryFn: async () => {
      const res = await fetch(`/api/leagues/${leagueId}/roster/${selectedPlayer}`, { credentials: "include" });
      if (!res.ok) throw new Error(`Failed to fetch roster: ${res.status}`);
      return res.json();
    },
  });

  // Helper to normalize server response shape
  function normalizeStandingsPayload(raw: any): StandingsResponse {
    // Server accidentally returned an array: treat it as "standings" with unknown meta
    if (Array.isArray(raw)) {
      console.debug("[Leagues] Server returned array, normalizing...");
      return { 
        standings: raw, 
        season: season,
        currentWeek: 1, 
        leagueInfo: { id: leagueId || '', name: 'League', memberCount: raw.length } 
      };
    }
    // Server returned the expected object shape or nullish
    if (raw && typeof raw === "object") {
      const { standings = [], currentWeek = 1, leagueInfo = { id: leagueId || '', name: 'League', memberCount: 0 } } = raw;
      return { standings, season: raw.season || season, currentWeek, leagueInfo };
    }
    // Anything else: treat as empty
    console.debug("[Leagues] Server returned unexpected format, using empty data");
    return { 
      standings: [], 
      season: season,
      currentWeek: 1, 
      leagueInfo: { id: leagueId || '', name: 'League', memberCount: 0 } 
    };
  }

  const standingsQuery = useQuery<StandingsResponse>({
    queryKey: ["league-standings", leagueId, season],
    enabled: !!leagueId,
    retry: false,
    queryFn: async () => {
      const url = `/api/leagues/${leagueId}/standings/${season}`;
      console.debug("[Leagues] fetching standings:", url);
      const res = await fetch(url, { credentials: "include" });
      const text = await res.text().catch(() => "");
      console.debug("[Leagues] response status:", res.status, "body:", text.slice(0, 200));
      if (!res.ok) throw new Error(`Standings fetch failed: ${res.status}`);
      
      let json: any;
      try {
        json = text ? JSON.parse(text) : null;
      } catch {
        console.debug("[Leagues] Failed to parse JSON response");
        json = null;
      }
      return normalizeStandingsPayload(json);
    },
  });

  if (!user) {
    return (
      <MainLayout>
        <div className="min-h-[70vh] flex items-center justify-center">
          <div>Loading...</div>
        </div>
      </MainLayout>
    );
  }

  if (!leagueId) {
    return (
      <MainLayout>
        <div className="p-3 text-sm">No league selected.</div>
      </MainLayout>
    );
  }

  if (standingsQuery.isLoading) {
    return (
      <MainLayout>
        <div className="p-3 text-sm">Loading standings…</div>
      </MainLayout>
    );
  }

  if (standingsQuery.isError) {
    return (
      <MainLayout>
        <div className="p-3 text-sm text-red-600">Failed to load standings. Check console.</div>
      </MainLayout>
    );
  }

  const { standings, currentWeek, leagueInfo } = standingsQuery.data ?? { standings: [], currentWeek: 1, leagueInfo: { id: '', name: 'League', memberCount: 0 } };

  if (!standings || standings.length === 0) {
    return (
      <MainLayout>
        <div className="p-4 text-sm text-muted-foreground border rounded-xl">
          No season standings yet for {season}. They'll appear once games are recorded.
        </div>
      </MainLayout>
    );
  }

  const getRankIcon = (rank: number) => {
    switch (rank) {
      case 1:
        return <Crown className="w-5 h-5 text-yellow-500" />;
      case 2:
        return <Medal className="w-5 h-5 text-gray-400" />;
      case 3:
        return <Award className="w-5 h-5 text-amber-600" />;
      default:
        return <span className="w-5 h-5 flex items-center justify-center text-sm font-bold text-muted-foreground">#{rank}</span>;
    }
  };

  const getRankColor = (rank: number) => {
    switch (rank) {
      case 1:
        return "bg-yellow-50 border-yellow-200 dark:bg-yellow-900/20 dark:border-yellow-700";
      case 2:
        return "bg-gray-50 border-gray-200 dark:bg-gray-900/20 dark:border-gray-700";
      case 3:
        return "bg-amber-50 border-amber-200 dark:bg-amber-900/20 dark:border-amber-700";
      default:
        return "bg-background border-border";
    }
  };

  return (
    <MainLayout>
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between px-4 pt-2">
          <div>
            <h1 className="text-xl font-bold text-foreground">
              {leagueInfo?.name || 'My League'}
            </h1>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <span>2024 Season</span>
              <span>•</span>
              <span>Week {currentWeek || 1}</span>
            </div>
          </div>
          <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 dark:bg-green-950 dark:text-green-300 dark:border-green-800">
            Active
          </Badge>
        </div>

        {/* Standings Table */}
        <div className="bg-card">
          <div className="px-4 py-3 border-b border-border">
            <h2 className="font-semibold text-foreground">League Standings</h2>
          </div>
          
          <div className="divide-y divide-border">
            {standings.map((player, index) => (
              <div
                key={player.userId}
                className={`px-4 py-4 flex items-center justify-between hover:bg-muted/50 transition-colors ${
                  player.isCurrentUser ? "bg-primary/5 border-l-4 border-l-primary" : ""
                }`}
                data-testid={`standings-row-${player.userId}`}
              >
                <div className="flex items-center gap-4">
                  <div className="w-8 flex justify-center">
                    {player.rank <= 3 ? (
                      <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                        player.rank === 1 ? "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200" :
                        player.rank === 2 ? "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200" :
                        "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200"
                      }`}>
                        {player.rank}
                      </div>
                    ) : (
                      <span className="text-sm font-medium text-muted-foreground">#{player.rank}</span>
                    )}
                  </div>
                  
                  <Avatar className="w-10 h-10">
                    <AvatarFallback className="text-sm font-medium">
                      {player.userName?.split(' ').map(n => n[0]).join('').toUpperCase() || "?"}
                    </AvatarFallback>
                  </Avatar>
                  
                  <div>
                    <div className="font-medium text-foreground flex items-center gap-2">
                      {player.userName}
                      {player.isCurrentUser && (
                        <Badge variant="secondary" className="text-xs px-1.5 py-0.5">YOU</Badge>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground flex items-center gap-1">
                      <Lock className="w-3 h-3" />
                      {player.locksCorrect} locks • {player.skinsWon} skins
                    </div>
                  </div>
                </div>
                
                <div className="flex items-center gap-3">
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={() => setSelectedPlayer(player.userId)}
                    className="h-8 px-2"
                    data-testid={`view-roster-${player.userId}`}
                  >
                    <Eye className="w-4 h-4" />
                  </Button>
                  
                  <div className="text-right">
                    <div className="text-lg font-bold text-foreground">
                      {player.totalMokPoints}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      points
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Quick Stats */}
        {standings && standings.length > 0 && (
          <div className="grid grid-cols-3 gap-3 px-4">
            <div className="text-center py-3 bg-card rounded-lg border">
              <div className="text-lg font-bold text-foreground">
                {standings[0]?.totalMokPoints || 0}
              </div>
              <div className="text-xs text-muted-foreground">Leader Points</div>
            </div>
            
            <div className="text-center py-3 bg-card rounded-lg border">
              <div className="text-lg font-bold text-foreground">
                {standings.length}
              </div>
              <div className="text-xs text-muted-foreground">Players</div>
            </div>
            
            <div className="text-center py-3 bg-card rounded-lg border">
              <div className="text-lg font-bold text-foreground">
                {standings.reduce((sum, p) => sum + (p.skinsWon || 0), 0)}
              </div>
              <div className="text-xs text-muted-foreground">Total Skins</div>
            </div>
          </div>
        )}

        {/* Season Prizes Section */}
        <Card className="overflow-hidden bg-gradient-to-br from-card to-card/50 border-border/50 rounded-2xl mb-6">
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Trophy className="w-5 h-5 text-accent-gold" />
              Payouts
            </CardTitle>
          </CardHeader>
          
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              {/* Lock Leader */}
              <div className="text-center p-4 bg-muted/30 rounded-lg">
                <div className="flex items-center justify-center gap-2 mb-2">
                  <Lock className="w-4 h-4 text-blue-500" />
                  <div className="text-sm font-medium">Lock Leader</div>
                </div>
                <div className="text-lg font-bold text-green-600">$10</div>
                <div className="text-xs text-muted-foreground">Most correct locks</div>
              </div>
              
              {/* Total Points */}
              <div className="text-center p-4 bg-muted/30 rounded-lg">
                <div className="flex items-center justify-center gap-2 mb-2">
                  <TrendingUp className="w-4 h-4 text-green-500" />
                  <div className="text-sm font-medium">Total Points</div>
                </div>
                <div className="text-lg font-bold text-green-600">$50</div>
                <div className="text-xs text-muted-foreground">Most season points</div>
              </div>
              
              {/* Super Bowl Champion */}
              <div className="text-center p-4 bg-muted/30 rounded-lg">
                <div className="flex items-center justify-center gap-2 mb-2">
                  <Trophy className="w-4 h-4 text-yellow-500" />
                  <div className="text-sm font-medium">Super Bowl</div>
                </div>
                <div className="text-lg font-bold text-green-600">$10</div>
                <div className="text-xs text-muted-foreground">Champion team owner</div>
              </div>
              
              {/* Weekly Skins */}
              <div className="text-center p-4 bg-muted/30 rounded-lg">
                <div className="flex items-center justify-center gap-2 mb-2">
                  <Zap className="w-4 h-4 text-purple-500" />
                  <div className="text-sm font-medium">Weekly Skins</div>
                </div>
                <div className="text-lg font-bold text-green-600">$30</div>
                <div className="text-xs text-muted-foreground">Each week high score</div>
              </div>
            </div>
            
            <div className="pt-2 border-t border-border/30">
              <div className="text-center">
                <div className="text-xs text-muted-foreground">Total Prize Pool</div>
                <div className="text-xl font-bold text-green-600">$70 + Weekly Skins</div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Player Roster Dialog */}
        <Dialog 
          open={!!selectedPlayer} 
          onOpenChange={(open) => {
            if (!open) {
              setSelectedPlayer(null);
            }
          }}
        >
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Shield className="w-5 h-5" />
                {selectedPlayer && standings.find(p => p.userId === selectedPlayer)?.userName}'s Teams
              </DialogTitle>
              <DialogDescription>
                View the teams drafted by this player
              </DialogDescription>
            </DialogHeader>
            
            {playerRoster && (
              <div className="space-y-3">
                <div className="grid grid-cols-1 gap-2">
                  {playerRoster.teams?.map((team: any) => (
                    <div key={team.id} className="flex items-center gap-3 p-3 bg-muted/30 rounded-lg">
                      <img 
                        src={team.logoUrl} 
                        alt={`${team.name} logo`}
                        className="w-8 h-8 object-contain"
                        onError={(e) => {
                          const target = e.target as HTMLImageElement;
                          target.style.display = 'none';
                        }}
                      />
                      <div className="flex-1">
                        <div className="font-medium text-sm">{team.name}</div>
                        <div className="text-xs text-muted-foreground">{team.conference}</div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-medium">{team.seasonPoints || 0} pts</div>
                        <div className="text-xs text-muted-foreground">{team.record || "0-0"}</div>
                      </div>
                    </div>
                  ))}
                </div>
                
                {(!playerRoster.teams || playerRoster.teams.length === 0) && (
                  <div className="text-center py-6 text-muted-foreground">
                    No teams drafted yet
                  </div>
                )}
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </MainLayout>
  );
}