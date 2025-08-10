import React, { useState } from "react";
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
  ChevronRight
} from "lucide-react";
import { BottomNav } from "@/components/layout/bottom-nav";
import { TeamLogo } from "@/components/team-logo";
import { useAuth } from "@/hooks/use-auth";

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

  // Fetch stable teams for selected league
  const { data: stableTeams = [] } = useQuery({
    queryKey: [`/api/user/stable/${selectedLeague}`],
    enabled: !!selectedLeague,
  });

  // Set first league as default selection
  React.useEffect(() => {
    if ((leagues as any[]).length > 0 && !selectedLeague) {
      setSelectedLeague((leagues as any[])[0].id);
    }
  }, [leagues, selectedLeague]);

  const currentLeague = (leagues as any[]).find((l: League) => l.id === selectedLeague);
  const lockDeadline = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000);
  const isLockWindowOpen = true;

  // Transform stable data into user teams with lock/load state
  const userTeams = (stableTeams as any[]).map((stable: any, index: number) => {
    // Sample spread data - would come from real odds API
    const spreads = [-3.5, +7, -1.5, +10.5, -6];
    const opponents = ["vs LAR", "@ MIA", "vs CHI", "@ SF", "vs NYJ"];
    
    return {
      id: stable.id,
      nflTeam: stable.nflTeam,
      locksRemaining: 4 - (stable.locksUsed || 0),
      lockAndLoadAvailable: !stable.lockAndLoadUsed,
      upcomingOpponent: opponents[index] || "vs OPP",
      pointSpread: spreads[index] || 0,
      isBye: false,
      weeklyRecord: "0-0",
      acquiredVia: stable.acquiredVia,
      acquiredAt: stable.acquiredAt,
      isLocked: false // Would track current week lock status
    };
  });

  const userPoints = 12.5;
  const userRank = 1;
  const weeklyPrize = 250;

  // Debug logging
  console.log('Main page debug:', {
    user: user?.name,
    leagues: (leagues as any[])?.length || 0,
    selectedLeague,
    stableTeams: (stableTeams as any[])?.length || 0,
    userTeams: userTeams?.length || 0,
    stableTeamsData: (stableTeams as any[])?.map(team => ({
      nflTeam: team.nflTeam?.code || 'UNKNOWN',
      acquiredVia: team.acquiredVia,
      acquiredAt: team.acquiredAt
    }))
  });

  if (!user) {
    return <div className="min-h-screen bg-background pb-20 flex items-center justify-center">
      <div>Loading...</div>
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
        <div className="p-4 space-y-4">
          <div className="grid grid-cols-2 gap-4">
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
                      Weekly Skins
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





        {/* Lock Selection Interface */}
        {isLockWindowOpen && (
          <div className="p-4 space-y-4">

            {/* Lock Selection Interface */}
            <Card>
              <CardHeader className="pb-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <CardTitle className="text-lg mb-1">Choose Your Lock</CardTitle>
                    <div className="text-sm text-muted-foreground">
                      Deadline: {lockDeadline.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })} 8:20 PM ET
                    </div>
                  </div>
                  <Badge variant="secondary" className="text-xs px-2 py-1 mt-1">
                    Week {selectedWeek}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4 p-4">
                {userTeams.length === 0 ? (
                  <div className="text-center py-8">
                    <div className="w-12 h-12 mx-auto mb-3 bg-muted rounded-full flex items-center justify-center">
                      <Shield className="w-6 h-6 text-muted-foreground" />
                    </div>
                    <h3 className="text-base font-semibold mb-2">No Teams Yet</h3>
                    <p className="text-sm text-muted-foreground mb-4 max-w-sm mx-auto">
                      Complete a draft to start building your stable
                    </p>
                    <Button onClick={() => navigate('/leagues')} size="sm">
                      Join a League
                    </Button>
                  </div>
                ) : (
                  <>
                    {/* Lockable Teams - Compact Mobile Design */}
                    {userTeams.filter(team => team.locksRemaining > 0 && !team.isBye).map((team: any) => (
                      <div 
                        key={team.id}
                        className="rounded-lg border bg-card hover:shadow-sm transition-all duration-200 overflow-hidden"
                      >
                        <div className="p-4">
                          {/* Team Header - Balanced sizing */}
                          <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center space-x-4 flex-1 min-w-0">
                              <TeamLogo 
                                logoUrl={team.nflTeam.logoUrl}
                                teamCode={team.nflTeam.code}
                                teamName={team.nflTeam.name}
                                size="lg"
                                className="w-12 h-12 flex-shrink-0"
                              />
                              <div className="flex-1 min-w-0">
                                <div className="font-medium text-sm truncate">
                                  {team.nflTeam.city} {team.nflTeam.name}
                                </div>
                                <div className="flex items-center space-x-2 text-xs">
                                  <span className="text-muted-foreground">
                                    {team.upcomingOpponent}
                                  </span>
                                  <span className="text-xs px-1.5 py-0.5 rounded bg-muted/50 font-mono">
                                    {team.pointSpread > 0 ? '+' : ''}{team.pointSpread}
                                  </span>
                                </div>
                              </div>
                            </div>
                            
                            <div className="flex items-center space-x-2 flex-shrink-0">
                              <div className="text-xs text-muted-foreground">
                                {team.locksRemaining} left
                              </div>
                              <div className="relative">
                                <div className="w-5 h-5 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
                                  <Zap className="w-2.5 h-2.5 text-amber-600 dark:text-amber-400" />
                                </div>
                                {!team.lockAndLoadAvailable && (
                                  <div className="absolute inset-0 flex items-center justify-center">
                                    <div className="w-6 h-0.5 bg-red-500 transform rotate-45"></div>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                          
                          {/* Action Buttons - Better touch targets */}
                          <div className="flex space-x-3">
                            <Button 
                              size="sm"
                              className="flex-1 h-9 text-sm"
                              disabled={team.isLocked}
                            >
                              {team.isLocked ? (
                                <>
                                  <Lock className="w-3 h-3 mr-2" />
                                  Locked
                                </>
                              ) : (
                                <>
                                  <Lock className="w-3 h-3 mr-2" />
                                  Lock
                                </>
                              )}
                            </Button>
                            
                            {team.lockAndLoadAvailable && !team.isLocked && (
                              <Button 
                                size="sm"
                                variant="outline"
                                className="flex-1 h-9 text-sm border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-300 hover:bg-amber-50 dark:hover:bg-amber-950/20"
                              >
                                <Zap className="w-3 h-3 mr-2" />
                                Lock & Load
                              </Button>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}

                    {/* Unavailable Teams - More compact */}
                    {userTeams.filter(team => team.locksRemaining === 0 || team.isBye).length > 0 && (
                      <div className="mt-4 pt-4 border-t border-border/50">
                        <p className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wide">
                          Unavailable This Week
                        </p>
                        <div className="grid grid-cols-3 gap-1.5">
                          {userTeams.filter(team => team.locksRemaining === 0 || team.isBye).map((team: any) => (
                            <div 
                              key={team.id}
                              className="flex items-center p-2 rounded-md bg-muted/20 opacity-60"
                            >
                              <TeamLogo 
                                logoUrl={team.nflTeam.logoUrl}
                                teamCode={team.nflTeam.code}
                                teamName={team.nflTeam.name}
                                size="sm"
                                className="w-5 h-5 mr-1.5"
                              />
                              <div className="flex-1 min-w-0">
                                <div className="font-medium text-xs truncate">
                                  {team.nflTeam.code}
                                </div>
                                <div className="text-xs text-muted-foreground leading-none">
                                  {team.isBye ? 'Bye' : 'Used'}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                )}
              </CardContent>
            </Card>
          </div>
        )}

        {/* Trades Card */}
        <div className="p-4">
          <Card 
            className="cursor-pointer hover:shadow-md transition-shadow duration-200 border-2 hover:border-primary/20"
            onClick={() => navigate('/more/trades')}
          >
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  <div className="p-2.5 bg-green-100 dark:bg-green-900/30 rounded-full">
                    <RefreshCw className="w-5 h-5 text-green-600 dark:text-green-400" />
                  </div>
                  <div>
                    <div className="font-semibold text-base mb-1">
                      Trades & Free Agents
                    </div>
                    <div className="text-sm text-muted-foreground">
                      Manage your team roster
                    </div>
                  </div>
                </div>
                <div className="flex items-center space-x-3">
                  <Badge variant="outline" className="bg-green-50 dark:bg-green-950/50 text-green-700 dark:text-green-300 border-green-200 dark:border-green-800">
                    2 Available
                  </Badge>
                  <ChevronRight className="w-5 h-5 text-muted-foreground" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Recent Activity */}
        <div className="p-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">Recent Activity</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {/* Activity Item 1 - Lock Made */}
              <div className="flex items-start space-x-3 p-3 rounded-lg bg-muted/30">
                <div className="p-1.5 bg-blue-100 dark:bg-blue-900/30 rounded-full flex-shrink-0">
                  <Lock className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium">Mike locked Ravens</p>
                    <span className="text-xs text-muted-foreground">2h ago</span>
                  </div>
                  <p className="text-xs text-muted-foreground">+1 bonus point if Ravens win</p>
                </div>
              </div>

              {/* Activity Item 2 - Trade */}
              <div className="flex items-start space-x-3 p-3 rounded-lg bg-muted/30">
                <div className="p-1.5 bg-green-100 dark:bg-green-900/30 rounded-full flex-shrink-0">
                  <RefreshCw className="w-4 h-4 text-green-600 dark:text-green-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium">Sarah traded for Cardinals</p>
                    <span className="text-xs text-muted-foreground">4h ago</span>
                  </div>
                  <p className="text-xs text-muted-foreground">Dropped Panthers for free agent</p>
                </div>
              </div>

              {/* Activity Item 3 - Lock & Load */}
              <div className="flex items-start space-x-3 p-3 rounded-lg bg-muted/30">
                <div className="p-1.5 bg-orange-100 dark:bg-orange-900/30 rounded-full flex-shrink-0">
                  <Zap className="w-4 h-4 text-orange-600 dark:text-orange-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium">Alex used Lock & Load on Chiefs</p>
                    <span className="text-xs text-muted-foreground">1d ago</span>
                  </div>
                  <p className="text-xs text-muted-foreground">High risk, high reward play</p>
                </div>
              </div>

              {/* Activity Item 4 - Scoring Update */}
              <div className="flex items-start space-x-3 p-3 rounded-lg bg-muted/30">
                <div className="p-1.5 bg-yellow-100 dark:bg-yellow-900/30 rounded-full flex-shrink-0">
                  <Trophy className="w-4 h-4 text-yellow-600 dark:text-yellow-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium">Week 1 scores updated</p>
                    <span className="text-xs text-muted-foreground">2d ago</span>
                  </div>
                  <p className="text-xs text-muted-foreground">Cowboys won weekly high scorer</p>
                </div>
              </div>

              {/* View All Activity Link */}
              <div className="pt-2 border-t border-border/50">
                <Button variant="ghost" className="w-full text-sm h-8">
                  View All Activity
                  <ChevronRight className="w-4 h-4 ml-1" />
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>



      </div>
      <BottomNav />
    </div>
  );
}