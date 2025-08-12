import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

import { 
  Shield, 
  Lock, 
  Zap, 
  TrendingUp, 
  Clock, 
  Trophy, 
  Users,
  Target,
  DollarSign,
  Flame,
  Star,
  Calendar,
  X,
  RefreshCw,
  ChevronRight,
  Crown
} from "lucide-react";
import { BottomNav } from "@/components/layout/bottom-nav";
import { TeamLogo } from "@/components/team-logo";
import { useAuth } from "@/hooks/use-auth";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

interface League {
  id: string;
  name: string;
}

interface User {
  id: string;
  name: string;
}

export default function MainPage() {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const [selectedLeague, setSelectedLeague] = useState<string>("");
  const [selectedWeek] = useState(1);

  // Fetch user's leagues
  const { data: leagues = [], isLoading: leaguesLoading } = useQuery({
    queryKey: ['/api/user/leagues'],
    enabled: !!user,
  });

  // Get current week from admin state
  const { data: currentWeekData } = useQuery({
    queryKey: ['/api/admin/current-week'],
    enabled: !!user,
  });

  // Use current week or fallback to week 1
  const currentWeek = currentWeekData?.currentWeek || selectedWeek;

  // Fetch dashboard data for selected league
  const { data: dashboardData, isLoading: dashboardLoading } = useQuery({
    queryKey: [`/api/leagues/${selectedLeague}/dashboard/${currentWeek}`],
    enabled: !!selectedLeague,
  });

  // Set first league as default selection
  useEffect(() => {
    if ((leagues as any[]).length > 0 && !selectedLeague) {
      setSelectedLeague((leagues as any[])[0].id);
    }
  }, [leagues, selectedLeague]);

  // Extract real data from dashboard API
  const userPoints = dashboardData?.userStats?.totalPoints || 0;
  const userRank = dashboardData?.userStats?.rank || 0;
  const weeklyPrize = dashboardData?.weeklyPrize || 0;
  const weeklyStandings = dashboardData?.weeklyStandings || [];
  const gamesInProgress = dashboardData?.gamesInProgress || 0;
  const teamsLeftToPlay = dashboardData?.teamsLeftToPlay || [];
  const memberTeamsData = dashboardData?.memberTeams || {};

  // Debug logging
  console.log('Main page debug:', {
    user: user?.name,
    leagues: (leagues as any[])?.length || 0,
    selectedLeague,
    dashboardData: dashboardData ? {
      userRank: dashboardData.userStats?.rank,
      userPoints: dashboardData.userStats?.totalPoints,
      weeklyStandings: dashboardData.weeklyStandings?.length,
      weeklyPrize: dashboardData.weeklyPrize
    } : null
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

  if (!selectedLeague || (leagues as any[]).length === 0) {
    return <div className="min-h-screen bg-background pb-20">
      <div className="max-w-lg mx-auto p-4">
        <div className="text-center py-8">
          <h3 className="text-lg font-semibold mb-2">No Leagues Found</h3>
          <p className="text-sm text-muted-foreground mb-4">Join a league to view your dashboard</p>
          <Button onClick={() => navigate('/leagues')} size="sm">
            Browse Leagues
          </Button>
        </div>
      </div>
      <BottomNav />
    </div>;
  }

  return (
    <div className="min-h-screen bg-background pb-20">
      <div className="max-w-lg mx-auto">
        
        {/* Header - Clean and Simple */}
        <div className="p-4 border-b border-border/50 bg-card">
          <div className="text-center">
            <h1 className="text-2xl font-bold">Mok Sports</h1>
            <p className="text-sm text-muted-foreground mt-1">Week {selectedWeek}</p>
          </div>
        </div>

        {/* Performance Stats - Above Lock Container */}
        <div className="p-4">
          <div className="grid grid-cols-2 gap-4 mb-4">
            {/* Current Rank */}
            <Card>
              <CardContent className="p-4 text-center">
                <div className="flex items-center justify-center mb-2">
                  <Trophy className="w-5 h-5 text-yellow-500 mr-2" />
                  <span className="text-2xl font-bold">#{userRank}</span>
                </div>
                <div className="text-sm text-muted-foreground">
                  League Rank
                </div>
              </CardContent>
            </Card>

            {/* Points */}
            <Card>
              <CardContent className="p-4 text-center">
                <div className="text-2xl font-bold mb-2">
                  {userPoints}
                </div>
                <div className="text-sm text-muted-foreground">
                  Total Points
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Weekly Prize */}
          <Card className="bg-gradient-to-r from-emerald-50 to-green-50 dark:from-emerald-950/20 dark:to-green-950/20 border-emerald-200 dark:border-emerald-800">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="p-2 bg-emerald-100 dark:bg-emerald-900/30 rounded-full">
                    <DollarSign className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                  </div>
                  <div>
                    <div className="font-semibold text-emerald-800 dark:text-emerald-200">
                      Skins Game
                    </div>
                    <div className="text-sm text-emerald-600 dark:text-emerald-400">
                      This week's prize
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-bold text-emerald-700 dark:text-emerald-300">
                    ${weeklyPrize}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
        {/* Teams Left to Play Section */}
        <div className="p-4">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-full">
                    <Calendar className="w-5 h-5 text-green-600 dark:text-green-400" />
                  </div>
                  <div>
                    <CardTitle className="text-lg">Teams Left to Play</CardTitle>
                    <p className="text-sm text-muted-foreground">Week {currentWeek} remaining games</p>
                  </div>
                </div>
                <Badge variant="outline" className="text-xs">
                  {teamsLeftToPlay.length} teams
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              {dashboardLoading ? (
                <div className="flex justify-center py-6">
                  <div className="w-6 h-6 animate-spin rounded-full border-2 border-muted-foreground border-t-transparent" />
                </div>
              ) : (
                <div className="space-y-4">
                  {Object.entries(memberTeamsData).map(([userId, memberData]: [string, any]) => {
                    const remainingTeams = memberData.teams.filter((team: any) => 
                      teamsLeftToPlay.some((remaining: any) => remaining.code === team.code)
                    );
                    
                    if (remainingTeams.length === 0) return null;
                    
                    return (
                      <div key={userId} className="space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-2">
                            <Avatar className="w-7 h-7">
                              <AvatarFallback className="text-xs">
                                {memberData.userName.split(' ').map((n: string) => n[0]).join('').slice(0, 2)}
                              </AvatarFallback>
                            </Avatar>
                            <span className="font-medium text-sm text-slate-600 dark:text-slate-400">
                              {memberData.userName}
                            </span>
                            {memberData.userId === user?.id && (
                              <Badge variant="secondary" className="text-xs">You</Badge>
                            )}
                          </div>
                          <span className="text-xs text-muted-foreground">
                            {remainingTeams.length} left
                          </span>
                        </div>
                        
                        <div className="flex flex-wrap gap-2 ml-9">
                          {remainingTeams.map((team: any) => (
                            <div 
                              key={team.code} 
                              className="flex items-center space-x-1.5 bg-muted/50 hover:bg-muted/80 transition-colors rounded-lg px-2.5 py-1.5"
                            >
                              <TeamLogo team={team.code} size="sm" />
                              <span className="text-xs font-medium">{team.code}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                  
                  {Object.values(memberTeamsData).every((memberData: any) => 
                    memberData.teams.filter((team: any) => 
                      teamsLeftToPlay.some((remaining: any) => remaining.code === team.code)
                    ).length === 0
                  ) && (
                    <div className="text-center py-6">
                      <Trophy className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                      <p className="text-sm text-muted-foreground">All teams have played this week!</p>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Weekly Standings Card - Redesigned */}
        <div className="p-4">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="p-2 bg-amber-100 dark:bg-amber-900/30 rounded-full">
                    <Trophy className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                  </div>
                  <div>
                    <CardTitle className="text-lg">Weekly Race</CardTitle>
                    <p className="text-sm text-muted-foreground">Who's winning the ${weeklyPrize} skin</p>
                  </div>
                </div>
                <div className="text-right">
                  <Badge variant="outline" className="text-xs mb-1">Week {currentWeek}</Badge>
                  <div className="text-xs text-muted-foreground">
                    {gamesInProgress > 0 ? 'Live' : 'Final'}
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-2">
              {dashboardLoading ? (
                <div className="flex justify-center py-6">
                  <div className="w-6 h-6 animate-spin rounded-full border-2 border-muted-foreground border-t-transparent" />
                </div>
              ) : weeklyStandings.length === 0 ? (
                <div className="text-center py-6">
                  <Clock className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">Week hasn't started yet</p>
                </div>
              ) : (
                weeklyStandings.slice(0, 6).map((member: any, index: number) => (
                  <div key={member.name} className={`flex items-center justify-between py-3 px-3 rounded-lg transition-colors ${
                    member.isCurrentUser ? 'bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800' : 'hover:bg-muted/50'
                  }`}>
                    <div className="flex items-center space-x-3">
                      {/* Enhanced Rank Badge */}
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                        index === 0 ? 'bg-gradient-to-br from-yellow-400 to-yellow-600 text-white shadow-sm' :
                        index === 1 ? 'bg-gradient-to-br from-slate-300 to-slate-500 text-white' :
                        index === 2 ? 'bg-gradient-to-br from-orange-400 to-orange-600 text-white' :
                        'bg-muted text-muted-foreground border border-border'
                      }`}>
                        {index === 0 ? '👑' : index + 1}
                      </div>
                      
                      {/* Avatar and Info */}
                      <div className="flex items-center space-x-2.5">
                        <Avatar className="w-9 h-9">
                          <AvatarFallback className="text-xs font-semibold">
                            {member.avatar}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <div className="flex items-center space-x-2">
                            <span className="font-semibold text-sm text-slate-600 dark:text-slate-400">
                              {member.name}
                            </span>
                            {member.isCurrentUser && (
                              <Badge variant="secondary" className="text-xs font-medium">You</Badge>
                            )}
                          </div>
                          {gamesInProgress > 0 && (
                            <div className="flex items-center space-x-1 mt-0.5">
                              <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse"></div>
                              <span className="text-xs text-green-600 dark:text-green-400">Live</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                    
                    {/* Points with trend */}
                    <div className="text-right">
                      <div className="text-xl font-bold">{member.weekPoints}</div>
                      <div className="text-xs text-muted-foreground">
                        {member.weekPoints === 1 ? 'point' : 'points'}
                      </div>
                    </div>
                  </div>
                ))
              )}
              
              {/* Status Footer */}
              {weeklyStandings.length > 0 && (
                <div className="mt-4 pt-3 border-t border-border/50">
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center space-x-2 text-muted-foreground">
                      {gamesInProgress > 0 ? (
                        <>
                          <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                          <span>{gamesInProgress} games in progress</span>
                        </>
                      ) : (
                        <>
                          <Trophy className="w-3 h-3" />
                          <span>Week {currentWeek} complete</span>
                        </>
                      )}
                    </div>
                    <Button variant="ghost" size="sm" className="h-6 px-2 text-xs">
                      View All <ChevronRight className="w-3 h-3 ml-1" />
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>













      </div>
      <BottomNav />
    </div>
  );
}