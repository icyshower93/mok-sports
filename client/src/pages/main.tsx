import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";


import { 
  Shield, 
  TrendingUp, 
  Clock, 
  Trophy, 
  Calendar,
  ChevronRight,
  Crown,
  Users,
  Zap,
  Target,
  Star,
  Flame,
  ArrowUp,
  ArrowDown,
  Minus,
  Activity,
  DollarSign
} from "lucide-react";
import { BottomNav } from "@/components/layout/bottom-nav";
import { TeamLogo } from "@/components/team-logo";
import { useAuth } from "@/hooks/use-auth";

interface League {
  id: string;
  name: string;
}

export default function MainPage() {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const [selectedLeague, setSelectedLeague] = useState<string>("");

  // Fetch user's leagues
  const { data: leagues = [], isLoading: leaguesLoading } = useQuery({
    queryKey: ['/api/user/leagues'],
    enabled: !!user,
  });

  // Get current week from scoring API
  const { data: currentWeekData } = useQuery({
    queryKey: ['/api/scoring/current-week'],
    enabled: !!user,
  });

  // Use current week or fallback to week 1
  const currentWeek = (currentWeekData as any)?.currentWeek || 1;

  // Set first league as default selection
  useEffect(() => {
    if ((leagues as any[]).length > 0 && !selectedLeague) {
      setSelectedLeague((leagues as any[])[0].id);
    }
  }, [leagues, selectedLeague]);

  // Fetch current user's stats for the league
  const { data: userStats } = useQuery({
    queryKey: [`/api/leagues/${selectedLeague}/member-stats/2024/${currentWeek}`],
    enabled: !!selectedLeague && !!user,
  });

  // Fetch weekly rankings - fixed endpoint
  const { data: weeklyRankings = [], isLoading: weeklyLoading } = useQuery({
    queryKey: [`/api/scoring/leagues/${selectedLeague}/week-scores/2024/${currentWeek}`],
    enabled: !!selectedLeague,
  });

  // Fetch teams left to play for current week
  const { data: teamsLeftData } = useQuery({
    queryKey: [`/api/leagues/${selectedLeague}/teams-left-to-play/2024/${currentWeek}`],
    enabled: !!selectedLeague,
  });

  // Extract dynamic data from APIs
  const userTotalPoints = (userStats as any)?.totalPoints || 0;
  const userRank = (userStats as any)?.rank || 0;
  const userSkinsWon = (userStats as any)?.skinsWon || 0;
  const weeklyPrize = 30; // Static $30 per week as per Mok rules
  const teamsLeftToPlay = (teamsLeftData as any)?.teamsLeftToPlay || [];

  // Debug logging
  console.log('Main page debug:', {
    user: user?.name,
    leagues: (leagues as any[])?.length || 0,
    selectedLeague,
    currentWeek,
    userStats: {
      totalPoints: userTotalPoints,
      rank: userRank,
      skinsWon: userSkinsWon
    },
    weeklyRankings: weeklyRankings?.length || 0,
    teamsLeftToPlay: teamsLeftToPlay?.length || 0
  });

  if (!user) {
    return <div className="min-h-screen bg-background pb-20 flex items-center justify-center">
      <div>Loading...</div>
    </div>;
  }

  if (leaguesLoading) {
    return <div className="min-h-screen bg-background pb-20 flex items-center justify-center">
      <div className="w-6 h-6 animate-spin rounded-full border border-muted-foreground border-t-transparent" />
    </div>;
  }

  if (!selectedLeague || !(leagues as any[])?.length) {
    return <div className="min-h-screen bg-background pb-20">
      <div className="max-w-lg mx-auto p-4">
        <div className="text-center py-8">
          <h3 className="text-lg font-semibold mb-2">No Leagues Found</h3>
          <p className="text-sm text-muted-foreground mb-4">Join a league to view your dashboard</p>
          <Button onClick={() => navigate('/league')} size="sm">
            Browse Leagues
          </Button>
        </div>
      </div>
      <BottomNav />
    </div>;
  }

  return (
    <div className="min-h-screen bg-background pb-20">
      <div className="max-w-md mx-auto px-2 sm:max-w-lg sm:px-0">
        
        {/* Simple Header - Matching League Style */}
        <div className="p-4 sm:p-6 pb-4">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-full">
              <Trophy className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">Dashboard</h1>
              <p className="text-sm text-muted-foreground">Week {currentWeek} • 2024 Season</p>
            </div>
          </div>
        </div>

        <div className="px-4 sm:px-6 space-y-6">
          
          {/* User Stats Cards */}
          <div className="grid grid-cols-3 gap-3">
            <Card>
              <CardContent className="p-4 text-center">
                <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">{userTotalPoints}</div>
                <div className="text-xs text-muted-foreground font-medium">Total Points</div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4 text-center">
                <div className="flex items-center justify-center space-x-1">
                  <span className="text-2xl font-bold text-amber-600 dark:text-amber-400">#{userRank}</span>
                  {userRank === 1 && <Crown className="w-4 h-4 text-amber-600" />}
                </div>
                <div className="text-xs text-muted-foreground font-medium">League Rank</div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4 text-center">
                <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{userSkinsWon}</div>
                <div className="text-xs text-muted-foreground font-medium">Skins Won</div>
              </CardContent>
            </Card>
          </div>

          {/* Weekly Rankings */}
          <Card>
            <CardHeader className="pb-4">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">Weekly Race</CardTitle>
                <Badge variant="outline" className="text-emerald-600 border-emerald-200">
                  ${weeklyPrize} Prize
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {(weeklyRankings as any[]).length === 0 ? (
                <div className="text-center py-6 text-muted-foreground">
                  <Trophy className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">Weekly rankings will appear here once games start</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {(weeklyRankings as any[]).slice(0, 4).map((member: any, index: number) => (
                    <Card 
                      key={member.name || index} 
                      className={`${member.isCurrentUser ? 'ring-2 ring-primary/20 bg-primary/5' : ''}`}
                    >
                      <CardContent className="p-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-3 flex-1">
                            <div className={`w-7 h-7 rounded-full flex items-center justify-center text-sm font-bold ${
                              index === 0 ? 'bg-yellow-500 text-white' :
                              index === 1 ? 'bg-gray-400 text-white' :
                              index === 2 ? 'bg-orange-500 text-white' :
                              'bg-muted text-muted-foreground'
                            }`}>
                              {index === 0 ? <Crown className="w-3 h-3" /> : index + 1}
                            </div>
                            
                            <div className="flex items-center space-x-2">
                              <span className="font-medium text-sm">{member.name}</span>
                              {member.isCurrentUser && (
                                <Badge variant="secondary" className="text-xs px-1.5 py-0.5">You</Badge>
                              )}
                            </div>
                          </div>
                          
                          <div className="flex items-center space-x-4 text-sm">
                            <div className="text-center">
                              <div className="font-semibold">{member.weeklyPoints || 0}</div>
                              <div className="text-xs text-muted-foreground">pts</div>
                            </div>
                            {member.gamesRemaining > 0 && (
                              <div className="text-center">
                                <div className="w-2 h-2 bg-green-500 rounded-full mx-auto mb-1"></div>
                                <div className="text-xs text-muted-foreground">Live</div>
                              </div>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                  {(weeklyRankings as any[]).length > 4 && (
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="w-full mt-2"
                      onClick={() => navigate('/league')}
                    >
                      View All Players <ChevronRight className="w-4 h-4 ml-1" />
                    </Button>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Teams Left to Play */}
          {teamsLeftToPlay.length > 0 && (
            <Card>
              <CardHeader className="pb-4">
                <CardTitle className="text-lg flex items-center space-x-2">
                  <Clock className="w-5 h-5" />
                  <span>Teams Left to Play</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="space-y-3">
                  {Object.entries(
                    teamsLeftToPlay.reduce((acc: any, team: any) => {
                      const ownerName = team.ownerName || 'Unknown';
                      if (!acc[ownerName]) acc[ownerName] = [];
                      acc[ownerName].push(team);
                      return acc;
                    }, {})
                  ).slice(0, 3).map(([ownerName, teams]: [string, any]) => (
                    <div key={ownerName} className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                      <div className="flex items-center space-x-3">
                        <div className="font-medium text-sm">{ownerName}</div>
                        {ownerName === user?.name && (
                          <Badge variant="secondary" className="text-xs px-1.5 py-0.5">You</Badge>
                        )}
                      </div>
                      <div className="flex items-center space-x-2">
                        {(teams as any[]).slice(0, 2).map((team: any) => (
                          <div key={team.teamCode} className="flex items-center space-x-1">
                            <TeamLogo 
                              teamCode={team.teamCode} 
                              logoUrl={`/images/nfl/team_logos/${team.teamCode}.png`}
                              teamName={team.teamCode}
                              size="sm" 
                              className="w-6 h-6"
                            />
                            <span className="text-xs text-muted-foreground">
                              {team.opponent}
                            </span>
                          </div>
                        ))}
                        {(teams as any[]).length > 2 && (
                          <Badge variant="outline" className="text-xs">
                            +{(teams as any[]).length - 2}
                          </Badge>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Quick Actions */}
          <div className="grid grid-cols-2 gap-3">
            <Button 
              variant="outline" 
              className="h-12 flex items-center justify-center space-x-2"
              onClick={() => navigate('/stable')}
            >
              <Shield className="w-4 h-4" />
              <span>My Stable</span>
            </Button>
            
            <Button 
              variant="outline" 
              className="h-12 flex items-center justify-center space-x-2"
              onClick={() => navigate('/scores')}
            >
              <TrendingUp className="w-4 h-4" />
              <span>Live Scores</span>
            </Button>
          </div>

        </div>
      </div>
      <BottomNav />
    </div>
  );
}