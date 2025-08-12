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

  // Fetch weekly rankings
  const { data: weeklyRankings = [] } = useQuery({
    queryKey: [`/api/leagues/${selectedLeague}/week-scores/2024/${currentWeek}`],
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
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/20 pb-20">
      <div className="max-w-lg mx-auto">
        
        {/* Hero Header */}
        <div className="bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 dark:from-slate-950 dark:via-blue-950 dark:to-slate-950 text-white p-6 pt-12">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-2xl font-bold">Welcome back,</h1>
              <p className="text-lg text-blue-200">{user?.name}</p>
            </div>
            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center">
              <Trophy className="w-6 h-6" />
            </div>
          </div>

          {/* Key Stats Row */}
          <div className="grid grid-cols-3 gap-4 mb-4">
            <div className="text-center">
              <div className="text-2xl font-bold">{userTotalPoints}</div>
              <div className="text-xs text-blue-200 uppercase tracking-wide">Total Points</div>
            </div>
            <div className="text-center">
              <div className="flex items-center justify-center space-x-1">
                <span className="text-2xl font-bold">#{userRank}</span>
                {userRank === 1 && <Crown className="w-4 h-4 text-yellow-400" />}
              </div>
              <div className="text-xs text-blue-200 uppercase tracking-wide">League Rank</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-emerald-300">${userSkinsWon * weeklyPrize}</div>
              <div className="text-xs text-blue-200 uppercase tracking-wide">Winnings</div>
            </div>
          </div>

          {/* Week Progress */}
          <div className="bg-white/10 backdrop-blur rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium">Week {currentWeek} Progress</span>
              <span className="text-xs text-blue-200">2024 Season</span>
            </div>
            <div className="h-2 bg-white/20 rounded-full overflow-hidden">
              <div 
                className="h-full bg-gradient-to-r from-blue-400 to-purple-400 transition-all duration-500"
                style={{ width: `${(currentWeek / 18) * 100}%` }}
              />
            </div>
            <div className="text-xs text-blue-200 mt-1">Week {currentWeek} of 18</div>
          </div>
        </div>

        <div className="p-4 space-y-6">
          
          {/* This Week's Battle */}
          <Card className="border-0 shadow-lg bg-gradient-to-br from-white to-gray-50 dark:from-gray-900 dark:to-gray-950">
            <CardHeader className="pb-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Flame className="w-5 h-5 text-orange-500" />
                  <CardTitle className="text-lg">This Week's Battle</CardTitle>
                </div>
                <Badge className="bg-gradient-to-r from-green-500 to-emerald-500 text-white">
                  ${weeklyPrize} Prize
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {(weeklyRankings as any[]).length === 0 ? (
                <div className="text-center py-8">
                  <div className="w-16 h-16 bg-gradient-to-br from-gray-100 to-gray-200 dark:from-gray-800 dark:to-gray-900 rounded-full flex items-center justify-center mx-auto mb-3">
                    <Activity className="w-8 h-8 text-gray-400" />
                  </div>
                  <p className="text-sm text-muted-foreground">Battle begins when games start</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {(weeklyRankings as any[]).slice(0, 4).map((member: any, index: number) => (
                    <div 
                      key={member.name || index} 
                      className={`flex items-center justify-between p-3 rounded-xl transition-all duration-200 ${
                        member.isCurrentUser 
                          ? 'bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/30 ring-2 ring-blue-200 dark:ring-blue-800' 
                          : 'bg-gray-50 dark:bg-gray-800/50'
                      }`}
                    >
                      <div className="flex items-center space-x-3">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                          index === 0 ? 'bg-gradient-to-br from-yellow-400 to-orange-500 text-white' :
                          index === 1 ? 'bg-gradient-to-br from-gray-300 to-gray-500 text-white' :
                          index === 2 ? 'bg-gradient-to-br from-orange-400 to-red-500 text-white' :
                          'bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300'
                        }`}>
                          {index === 0 ? <Crown className="w-4 h-4" /> : index + 1}
                        </div>
                        <div>
                          <div className="font-medium text-sm flex items-center space-x-2">
                            <span>{member.name}</span>
                            {member.isCurrentUser && (
                              <Badge variant="secondary" className="text-xs px-2 py-0.5 bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300">
                                You
                              </Badge>
                            )}
                          </div>
                          {member.gamesRemaining > 0 && (
                            <div className="flex items-center space-x-1 mt-1">
                              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                              <span className="text-xs text-green-600 dark:text-green-400">Live</span>
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-bold text-lg">{member.weeklyPoints || 0}</div>
                        <div className="text-xs text-muted-foreground">points</div>
                      </div>
                    </div>
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

          {/* Teams Still Playing */}
          {teamsLeftToPlay.length > 0 && (
            <Card className="border-0 shadow-lg">
              <CardHeader className="pb-4">
                <CardTitle className="text-lg flex items-center space-x-2">
                  <Clock className="w-5 h-5 text-blue-500" />
                  <span>Teams Still Playing</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {Object.entries(
                    teamsLeftToPlay.reduce((acc: any, team: any) => {
                      const ownerName = team.ownerName || 'Unknown';
                      if (!acc[ownerName]) acc[ownerName] = [];
                      acc[ownerName].push(team);
                      return acc;
                    }, {})
                  ).slice(0, 3).map(([ownerName, teams]: [string, any]) => (
                    <div key={ownerName} className="flex items-center justify-between p-3 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/20 dark:to-indigo-950/20 rounded-lg">
                      <div className="flex items-center space-x-3">
                        <div className="font-medium text-sm">{ownerName}</div>
                        {ownerName === user?.name && (
                          <Badge className="text-xs px-2 py-0.5 bg-blue-500 text-white">You</Badge>
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
                              className="w-7 h-7"
                            />
                            <span className="text-xs text-muted-foreground font-medium">
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

          {/* Quick Actions Grid */}
          <div className="grid grid-cols-2 gap-3">
            <Button 
              className="h-14 bg-gradient-to-br from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white shadow-lg"
              onClick={() => navigate('/stable')}
            >
              <div className="flex flex-col items-center space-y-1">
                <Shield className="w-5 h-5" />
                <span className="text-sm font-medium">My Stable</span>
              </div>
            </Button>
            
            <Button 
              className="h-14 bg-gradient-to-br from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white shadow-lg"
              onClick={() => navigate('/scores')}
            >
              <div className="flex flex-col items-center space-y-1">
                <TrendingUp className="w-5 h-5" />
                <span className="text-sm font-medium">Live Scores</span>
              </div>
            </Button>
          </div>

          {/* Secondary Actions */}
          <div className="grid grid-cols-2 gap-3">
            <Button 
              variant="outline" 
              className="h-12 border-2 hover:bg-gray-50 dark:hover:bg-gray-900"
              onClick={() => navigate('/league')}
            >
              <Users className="w-4 h-4 mr-2" />
              <span>League</span>
            </Button>
            
            <Button 
              variant="outline" 
              className="h-12 border-2 hover:bg-gray-50 dark:hover:bg-gray-900"
              onClick={() => navigate('/more')}
            >
              <Target className="w-4 h-4 mr-2" />
              <span>More</span>
            </Button>
          </div>

        </div>
      </div>
      <BottomNav />
    </div>
  );
}