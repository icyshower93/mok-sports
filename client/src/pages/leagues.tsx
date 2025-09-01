import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/features/auth/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Trophy, Crown, Medal, Award, TrendingUp, Zap } from "lucide-react";
import { MainLayout } from "@/components/layout/main-layout";
import { getCurrentSeason } from "@/lib/season";

interface SeasonStandings {
  userId: string;
  userName: string;
  totalMokPoints: number;
  weeklyWins: number;
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
  const { user } = useAuth();
  const [selectedSeason] = useState(getCurrentSeason()); // Current season dynamically determined
  
  // Get user's current league (using first league for now)
  const { data: userLeagues } = useQuery({
    queryKey: ['/api/user/leagues'],
    enabled: !!user,
  });

  const currentLeagueId = Array.isArray(userLeagues) && userLeagues.length > 0 ? userLeagues[0].id : null;

  const { data: standings, isLoading } = useQuery<StandingsResponse>({
    queryKey: [`/api/leagues/${currentLeagueId}/standings/${selectedSeason}`],
    enabled: !!currentLeagueId,
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

  if (!currentLeagueId) {
    return (
      <MainLayout>
        <div className="p-4 max-w-4xl mx-auto">
          <Card>
            <CardContent className="p-8 text-center">
              <Trophy className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
              <h3 className="text-lg font-semibold mb-2">No League Found</h3>
              <p className="text-muted-foreground">
                You need to join a league to view standings.
              </p>
            </CardContent>
          </Card>
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
      <div className="p-4 max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Trophy className="w-6 h-6 text-primary" />
              League Standings
            </h1>
            <p className="text-muted-foreground">
              {standings?.leagueInfo?.name || 'League'} • Season {selectedSeason}
            </p>
          </div>
          <Badge variant="secondary">
            Week {standings?.currentWeek || 1}
          </Badge>
        </div>

        {/* Standings Table */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5" />
              Season Rankings
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-8">
                <div className="w-6 h-6 animate-spin rounded-full border border-muted-foreground border-t-transparent mx-auto" />
                <p className="text-sm text-muted-foreground mt-2">Loading standings...</p>
              </div>
            ) : standings?.standings?.length === 0 ? (
              <div className="text-center py-8">
                <Trophy className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                <h3 className="text-lg font-semibold mb-2">No Standings Yet</h3>
                <p className="text-muted-foreground">
                  Standings will appear once games begin and points are scored.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {standings?.standings?.map((player, index) => (
                  <div
                    key={player.userId}
                    className={`p-4 rounded-lg border transition-colors ${getRankColor(player.rank)} ${
                      player.isCurrentUser ? "ring-2 ring-primary" : ""
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        {getRankIcon(player.rank)}
                        <Avatar className="w-8 h-8">
                          <AvatarFallback className="text-xs">
                            {player.userName?.charAt(0).toUpperCase() || "?"}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <div className="font-medium flex items-center gap-2">
                            {player.userName}
                            {player.isCurrentUser && (
                              <Badge variant="secondary" className="text-xs">You</Badge>
                            )}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {player.weeklyWins} weekly wins
                          </div>
                        </div>
                      </div>
                      
                      <div className="text-right">
                        <div className="font-bold text-lg">
                          {player.totalMokPoints} pts
                        </div>
                        <div className="flex items-center gap-4 text-xs text-muted-foreground">
                          {player.skinsWon > 0 && (
                            <span className="flex items-center gap-1">
                              <Zap className="w-3 h-3" />
                              {player.skinsWon} skins
                            </span>
                          )}
                          {player.lockSuccessRate !== undefined && (
                            <span>
                              {Math.round(player.lockSuccessRate * 100)}% locks
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Season Stats Summary */}
        {standings?.standings && standings.standings.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardContent className="p-4 text-center">
                <Crown className="w-8 h-8 mx-auto mb-2 text-yellow-500" />
                <div className="font-medium">Current Leader</div>
                <div className="text-sm text-muted-foreground">
                  {standings.standings[0]?.userName}
                </div>
                <div className="text-lg font-bold">
                  {standings.standings[0]?.totalMokPoints} pts
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="p-4 text-center">
                <TrendingUp className="w-8 h-8 mx-auto mb-2 text-primary" />
                <div className="font-medium">Total Players</div>
                <div className="text-lg font-bold">
                  {standings.leagueInfo.memberCount}
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="p-4 text-center">
                <Zap className="w-8 h-8 mx-auto mb-2 text-amber-500" />
                <div className="font-medium">Total Skins Won</div>
                <div className="text-lg font-bold">
                  {standings.standings.reduce((sum, p) => sum + (p.skinsWon || 0), 0)}
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </MainLayout>
  );
}