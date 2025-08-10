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

  // Fetch dashboard data for selected league
  const { data: dashboardData, isLoading: dashboardLoading } = useQuery({
    queryKey: [`/api/leagues/${selectedLeague}/dashboard/${selectedWeek}`],
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
        {/* Weekly Standings Card */}
        <div className="p-4">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-full">
                    <Trophy className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div>
                    <CardTitle className="text-lg">Weekly Standings</CardTitle>
                    <p className="text-sm text-muted-foreground">Who's winning this week's skin</p>
                  </div>
                </div>
                <Badge variant="outline" className="text-xs">Week {selectedWeek}</Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {/* Real weekly standings */}
              {dashboardLoading ? (
                <div className="flex justify-center py-4">
                  <div className="w-6 h-6 animate-spin rounded-full border border-muted-foreground border-t-transparent" />
                </div>
              ) : weeklyStandings.length === 0 ? (
                <div className="text-center py-4">
                  <p className="text-sm text-muted-foreground">No standings data available</p>
                </div>
              ) : (
                weeklyStandings.map((member: any, index: number) => (
                <div key={member.name} className="flex items-center justify-between py-2.5">
                  <div className="flex items-center space-x-3">
                    {/* Rank Badge */}
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center text-sm font-semibold ${
                      index === 0 ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300' :
                      index === 1 ? 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300' :
                      index === 2 ? 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300' :
                      'bg-muted text-muted-foreground'
                    }`}>
                      {index + 1}
                    </div>
                    
                    {/* Avatar and Name */}
                    <div className="flex items-center space-x-2.5">
                      <Avatar className="w-8 h-8">
                        <AvatarFallback className="text-xs font-medium">{member.avatar}</AvatarFallback>
                      </Avatar>
                      <div className="flex items-center space-x-2">
                        <span className="font-medium text-sm">{member.name}</span>
                        {member.isCurrentUser && <Badge variant="secondary" className="text-xs">You</Badge>}
                      </div>
                    </div>
                  </div>
                  
                  {/* Points */}
                  <div className="text-right">
                    <span className="text-lg font-bold">{member.weekPoints}</span>
                    <span className="text-sm text-muted-foreground ml-1">pts</span>
                  </div>
                </div>
                ))
              )}
              
              {/* Live Update Status */}
              <div className="mt-4 pt-3 border-t border-border/50">
                <div className="flex items-center justify-center space-x-2 text-xs text-muted-foreground">
                  <Clock className="w-3.5 h-3.5" />
                  <span>
                    {gamesInProgress > 0 
                      ? `${gamesInProgress} games in progress • Updates live` 
                      : 'All games complete • Final results'
                    }
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>













      </div>
      <BottomNav />
    </div>
  );
}