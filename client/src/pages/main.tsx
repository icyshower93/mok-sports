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
  ChevronDown,
  ChevronUp,
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
  const [showAllWeeklyRankings, setShowAllWeeklyRankings] = useState(false);

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

  // Fetch league standings data (same as league tab)
  const { data: leagueData } = useQuery({
    queryKey: [`/api/leagues/${selectedLeague}/standings`],
    enabled: !!selectedLeague && !!user,
  });

  // Fetch weekly rankings - fixed endpoint  
  const { data: weeklyRankingsData, isLoading: weeklyLoading } = useQuery({
    queryKey: [`/api/scoring/leagues/${selectedLeague}/week-scores/2024/${currentWeek}`],
    enabled: !!selectedLeague,
  });

  // Extract rankings and week-end results with proper fallbacks
  const weeklyRankings = Array.isArray((weeklyRankingsData as any)?.rankings) ? (weeklyRankingsData as any)?.rankings : [];
  const weekEndResults = (weeklyRankingsData as any)?.weekEndResults || null;

  // Fetch teams left to play for current week
  const { data: teamsLeftData } = useQuery({
    queryKey: [`/api/leagues/${selectedLeague}/teams-left-to-play/2024/${currentWeek}`],
    enabled: !!selectedLeague,
  });

  // Extract current user's data from league standings
  const currentUserStanding = (leagueData as any)?.standings?.find((member: any) => member.isCurrentUser);
  const userTotalPoints = currentUserStanding?.points || 0;
  const userRank = currentUserStanding?.rank || 0;
  const userSkinsWon = currentUserStanding?.skinsWon || 0;
  const weeklyPrize = 30; // Static $30 per week as per Mok rules
  const teamsLeftToPlay = Array.isArray((teamsLeftData as any)?.teamsLeftToPlay) ? (teamsLeftData as any)?.teamsLeftToPlay : [];

  // Debug logging
  console.log('Main page debug:', {
    user: user?.name,
    leagues: (leagues as any[])?.length || 0,
    selectedLeague,
    currentWeek,
    leagueData: leagueData ? 'loaded' : 'null',
    currentUserStanding,
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
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20 pb-20">
      <div className="max-w-4xl mx-auto">
        
        {/* Hero Header with Welcome Message */}
        <div className="relative px-6 py-8 bg-gradient-to-r from-primary/10 via-primary/5 to-background">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-foreground">Welcome back, {user.name.split(' ')[0]}!</h1>
              <p className="text-sm text-muted-foreground mt-1">Week {currentWeek} • 2024 NFL Season</p>
            </div>
            <div className="p-3 bg-primary/10 rounded-full">
              <Trophy className="w-6 h-6 text-primary" />
            </div>
          </div>
        </div>

        <div className="px-4 space-y-6 mt-6">
          
          {/* Enhanced Stats Cards with Better Visual Hierarchy */}
          <div className="grid grid-cols-3 gap-4">
            <Card className="bg-gradient-to-br from-blue-50 to-blue-100/50 dark:from-blue-950/30 dark:to-blue-900/20 border-blue-200 dark:border-blue-800">
              <CardContent className="p-5 text-center">
                <div className="text-3xl font-black text-blue-600 dark:text-blue-400 mb-1">{userTotalPoints}</div>
                <div className="text-xs text-blue-700/70 dark:text-blue-300/70 font-semibold uppercase tracking-wide">Total Points</div>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-amber-50 to-yellow-100/50 dark:from-amber-950/30 dark:to-yellow-900/20 border-amber-200 dark:border-amber-800">
              <CardContent className="p-5 text-center">
                <div className="flex items-center justify-center space-x-2 mb-1">
                  <span className="text-3xl font-black text-amber-600 dark:text-amber-400">#{userRank}</span>
                  {userRank === 1 && <Crown className="w-5 h-5 text-amber-600" />}
                </div>
                <div className="text-xs text-amber-700/70 dark:text-amber-300/70 font-semibold uppercase tracking-wide">League Rank</div>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-emerald-50 to-green-100/50 dark:from-emerald-950/30 dark:to-green-900/20 border-emerald-200 dark:border-emerald-800">
              <CardContent className="p-5 text-center">
                <div className="text-3xl font-black text-emerald-600 dark:text-emerald-400 mb-1">${userSkinsWon * 30}</div>
                <div className="text-xs text-emerald-700/70 dark:text-emerald-300/70 font-semibold uppercase tracking-wide">Skins Won</div>
              </CardContent>
            </Card>
          </div>

          {/* Quick Actions Row */}
          <div className="grid grid-cols-2 gap-3">
            <Button 
              variant="outline" 
              className="h-14 bg-gradient-to-r from-primary/5 to-primary/10 border-primary/20 hover:from-primary/10 hover:to-primary/15"
              onClick={() => navigate('/stable')}
            >
              <div className="flex items-center space-x-3">
                <Shield className="w-5 h-5 text-primary" />
                <div className="text-left">
                  <div className="font-semibold text-sm">My Teams</div>
                  <div className="text-xs text-muted-foreground">View Stable</div>
                </div>
              </div>
            </Button>
            
            <Button 
              variant="outline" 
              className="h-14 bg-gradient-to-r from-green-500/5 to-emerald-500/10 border-green-500/20 hover:from-green-500/10 hover:to-emerald-500/15"
              onClick={() => navigate('/scores')}
            >
              <div className="flex items-center space-x-3">
                <Activity className="w-5 h-5 text-green-600" />
                <div className="text-left">
                  <div className="font-semibold text-sm">Live Scores</div>
                  <div className="text-xs text-muted-foreground">NFL Games</div>
                </div>
              </div>
            </Button>
          </div>

          {/* Weekly Leaderboard with Enhanced Design */}
          <Card className="overflow-hidden bg-gradient-to-br from-card to-card/50 border-border/50 shadow-lg">
            <CardHeader className="pb-4 bg-gradient-to-r from-primary/5 to-primary/10">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="p-2 bg-primary/10 rounded-full">
                    <Flame className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <CardTitle className="text-xl font-bold">Week {currentWeek} Leaderboard</CardTitle>
                    <p className="text-sm text-muted-foreground">Live scoring battle</p>
                  </div>
                </div>
                <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-800 px-3 py-1">
                  <DollarSign className="w-3 h-3 mr-1" />
                  ${weeklyPrize} Prize
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {!weeklyRankings || (weeklyRankings as any[]).length === 0 ? (
                <div className="text-center py-12 px-6">
                  <div className="p-4 bg-muted/20 rounded-full w-fit mx-auto mb-4">
                    <Trophy className="w-8 h-8 text-muted-foreground/50" />
                  </div>
                  <h4 className="font-semibold text-lg mb-2">Week {currentWeek} Competition</h4>
                  <p className="text-sm text-muted-foreground">Leaderboard will update as games begin</p>
                </div>
              ) : (
                <div className="space-y-1">
                  {Array.isArray(weeklyRankings) && (weeklyRankings as any[])
                    .slice(0, showAllWeeklyRankings ? (weeklyRankings as any[]).length : 3)
                    .map((member: any, index: number) => (
                    <div 
                      key={member.name || index} 
                      className={`p-4 border-b border-border/50 last:border-b-0 transition-colors hover:bg-muted/20 ${
                        member.isCurrentUser ? 'bg-primary/5 border-primary/20' : ''
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-4 flex-1">
                          <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold shadow-sm ${
                            index === 0 ? 'bg-gradient-to-br from-yellow-400 to-yellow-600 text-white' :
                            index === 1 ? 'bg-gradient-to-br from-gray-300 to-gray-500 text-white' :
                            index === 2 ? 'bg-gradient-to-br from-orange-400 to-orange-600 text-white' :
                            'bg-muted text-muted-foreground'
                          }`}>
                            {index === 0 ? <Crown className="w-4 h-4" /> : index + 1}
                          </div>
                          
                          <div className="flex items-center space-x-3 flex-1">
                            <div>
                              <div className="font-semibold text-base">{member.name}</div>
                              {member.isCurrentUser && (
                                <Badge variant="secondary" className="text-xs px-2 py-0.5 mt-1">You</Badge>
                              )}
                            </div>
                          </div>
                        </div>
                        
                        <div className="flex items-center space-x-6">
                          <div className="text-right">
                            <div className="text-2xl font-bold text-foreground">{member.weeklyPoints || 0}</div>
                            <div className="text-xs text-muted-foreground font-medium">points</div>
                          </div>
                          {member.gamesRemaining > 0 && (
                            <div className="flex items-center space-x-1 text-green-600">
                              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                              <span className="text-xs font-medium">LIVE</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                  {Array.isArray(weeklyRankings) && (weeklyRankings as any[]).length > 3 && (
                    <div className="p-4 bg-muted/10">
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="w-full text-sm"
                        onClick={() => setShowAllWeeklyRankings(!showAllWeeklyRankings)}
                      >
                        {showAllWeeklyRankings ? (
                          <>Show Top 3 <ChevronUp className="w-4 h-4 ml-2" /></>
                        ) : (
                          <>View All 6 Players <ChevronDown className="w-4 h-4 ml-2" /></>
                        )}
                      </Button>
                    </div>
                  )}
                </div>
              )}

              {/* Week-End Results Section */}
              {weekEndResults?.weekComplete && (
                <div className="mt-4 pt-4 border-t border-border">
                  <h4 className="font-semibold text-sm mb-3 flex items-center gap-2">
                    <Target className="w-4 h-4" />
                    Week {currentWeek} Results
                  </h4>
                  
                  <div className="space-y-3">
                    {/* High Score Teams */}
                    {Array.isArray(weekEndResults?.highScoreTeams) && weekEndResults.highScoreTeams.length > 0 && (
                      <div className="bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800 rounded-lg p-3">
                        <div className="flex items-center gap-2 mb-2">
                          <Trophy className="w-4 h-4 text-green-600" />
                          <span className="font-medium text-green-700 dark:text-green-300 text-sm">
                            Week High (+1 bonus)
                          </span>
                        </div>
                        {weekEndResults.highScoreTeams.map((team: any) => (
                          <div key={team.teamId} className="flex items-center gap-3">
                            <img
                              src={`https://a.espncdn.com/i/teamlogos/nfl/500/${team.teamCode.toLowerCase()}.png`}
                              alt={team.teamCode}
                              className="w-6 h-6"
                            />
                            <div>
                              <div className="font-medium text-sm">{team.teamName}</div>
                              <div className="text-xs text-green-600 dark:text-green-400">
                                {team.score} points
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Low Score Teams */}
                    {Array.isArray(weekEndResults?.lowScoreTeams) && weekEndResults.lowScoreTeams.length > 0 && (
                      <div className="bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 rounded-lg p-3">
                        <div className="flex items-center gap-2 mb-2">
                          <Target className="w-4 h-4 text-red-600" />
                          <span className="font-medium text-red-700 dark:text-red-300 text-sm">
                            Week Low (-1 penalty)
                          </span>
                        </div>
                        {weekEndResults.lowScoreTeams.map((team: any) => (
                          <div key={team.teamId} className="flex items-center gap-3">
                            <img
                              src={`https://a.espncdn.com/i/teamlogos/nfl/500/${team.teamCode.toLowerCase()}.png`}
                              alt={team.teamCode}
                              className="w-6 h-6"
                            />
                            <div>
                              <div className="font-medium text-sm">{team.teamName}</div>
                              <div className="text-xs text-red-600 dark:text-red-400">
                                {team.score} points
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Weekly Skins Winner */}
                    {weekEndResults.weeklySkinsWinner && (
                      <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-lg p-3">
                        <div className="flex items-center gap-2 mb-2">
                          <Trophy className="w-4 h-4 text-amber-600" />
                          <span className="font-medium text-amber-700 dark:text-amber-300 text-sm">
                            Weekly Skins Winner
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <div className="font-medium text-sm">{weekEndResults.weeklySkinsWinner.userName}</div>
                          <div className="text-right">
                            <div className="font-bold text-amber-600 text-sm">${weekEndResults.weeklySkinsWinner.prizeAmount}</div>
                            <div className="text-xs text-amber-600">
                              {weekEndResults.weeklySkinsWinner.totalWeeklyPoints} points
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Teams Left to Play */}
          {teamsLeftToPlay && teamsLeftToPlay.length > 0 && (
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