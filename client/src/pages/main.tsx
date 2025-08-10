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
  Calendar
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
  const userTeams = (stableTeams as any[]).map((stable: any) => ({
    id: stable.id,
    nflTeam: stable.nflTeam,
    locksRemaining: 4 - (stable.locksUsed || 0),
    lockAndLoadAvailable: !stable.lockAndLoadUsed,
    upcomingOpponent: "vs OPP",
    isBye: false,
    weeklyRecord: "0-0",
    acquiredVia: stable.acquiredVia,
    acquiredAt: stable.acquiredAt,
    isLocked: false // Would track current week lock status
  }));

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
        
        {/* Header - Clean and Modern */}
        <div className="p-4 border-b border-border/50">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold">{currentLeague?.name || 'Mok Sports'}</h1>
              <div className="flex items-center space-x-2 text-sm text-muted-foreground">
                <span>Week {selectedWeek}</span>
                {isLockWindowOpen && (
                  <>
                    <span>•</span>
                    <div className="flex items-center space-x-1">
                      <Clock className="w-3 h-3 text-green-500" />
                      <span className="text-green-600 dark:text-green-400 font-medium">Lock Window Open</span>
                    </div>
                  </>
                )}
              </div>
            </div>
            {(leagues as any[]).length > 1 && (
              <select 
                value={selectedLeague || ''} 
                onChange={(e) => setSelectedLeague(e.target.value)}
                className="px-3 py-2 text-sm border rounded-lg bg-background"
              >
                {(leagues as any[]).map((league: League) => (
                  <option key={league.id} value={league.id}>
                    {league.name}
                  </option>
                ))}
              </select>
            )}
          </div>
        </div>

        {/* Lock Window Active - Hero Section */}
        {isLockWindowOpen && (
          <div className="p-4 space-y-4">
            {/* Lock Deadline Alert */}
            <Card className="bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-950/20 dark:to-emerald-950/20 border-green-200 dark:border-green-800">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-full">
                      <Target className="w-5 h-5 text-green-600 dark:text-green-400" />
                    </div>
                    <div>
                      <div className="font-semibold text-green-800 dark:text-green-200">
                        Make Your Lock
                      </div>
                      <div className="text-sm text-green-600 dark:text-green-400">
                        Deadline: {lockDeadline.toLocaleDateString()} 8:20 PM ET
                      </div>
                    </div>
                  </div>
                  <Badge variant="outline" className="bg-green-50 dark:bg-green-950/50 text-green-700 dark:text-green-300 border-green-200 dark:border-green-800">
                    <Flame className="w-3 h-3 mr-1" />
                    +1 Point
                  </Badge>
                </div>
              </CardContent>
            </Card>

            {/* Lock Selection Interface */}
            <Card>
              <CardHeader className="pb-4">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">Choose Your Lock</CardTitle>
                  <Badge variant="secondary" className="text-xs px-2 py-1">
                    Week {selectedWeek}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-3 p-3">
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
                        <div className="p-3">
                          {/* Team Header - More compact */}
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center space-x-2 flex-1 min-w-0">
                              <TeamLogo 
                                logoUrl={team.nflTeam.logoUrl}
                                teamCode={team.nflTeam.code}
                                teamName={team.nflTeam.name}
                                size="sm"
                                className="w-8 h-8 flex-shrink-0"
                              />
                              <div className="flex-1 min-w-0">
                                <div className="font-medium text-sm truncate">
                                  {team.nflTeam.city} {team.nflTeam.name}
                                </div>
                                <div className="text-xs text-muted-foreground">
                                  {team.upcomingOpponent}
                                </div>
                              </div>
                            </div>
                            
                            <div className="flex items-center space-x-2 flex-shrink-0">
                              <div className="text-xs text-muted-foreground">
                                {team.locksRemaining} left
                              </div>
                              {team.lockAndLoadAvailable && (
                                <Badge variant="outline" className="text-xs px-1.5 py-0.5 h-5">
                                  <Zap className="w-2.5 h-2.5 mr-0.5" />
                                  L&L
                                </Badge>
                              )}
                            </div>
                          </div>
                          
                          {/* Action Buttons - More compact */}
                          <div className="flex space-x-2">
                            <Button 
                              size="sm"
                              className="flex-1 h-8 text-xs"
                              disabled={team.isLocked}
                            >
                              {team.isLocked ? (
                                <>
                                  <Lock className="w-3 h-3 mr-1" />
                                  Locked
                                </>
                              ) : (
                                <>
                                  <Lock className="w-3 h-3 mr-1" />
                                  Lock
                                </>
                              )}
                            </Button>
                            
                            {team.lockAndLoadAvailable && !team.isLocked && (
                              <Button 
                                size="sm"
                                variant="outline"
                                className="flex-1 h-8 text-xs border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-300 hover:bg-amber-50 dark:hover:bg-amber-950/20"
                              >
                                <Zap className="w-3 h-3 mr-1" />
                                Lock & Load
                              </Button>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}

                    {/* Unavailable Teams - More compact */}
                    {userTeams.filter(team => team.locksRemaining === 0 || team.isBye).length > 0 && (
                      <div className="mt-3 pt-3 border-t border-border/50">
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
                                size="xs"
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

        {/* Your Performance Dashboard */}
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

          {/* Quick Actions */}
          <div className="grid grid-cols-2 gap-3">
            <Button variant="outline" className="justify-start min-h-[44px]" onClick={() => navigate('/stable')}>
              <Shield className="w-4 h-4 mr-3" />
              My Stable
            </Button>
            <Button variant="outline" className="justify-start min-h-[44px]" onClick={() => navigate('/league')}>
              <Users className="w-4 h-4 mr-3" />
              League
            </Button>
            <Button variant="outline" className="justify-start min-h-[44px]" onClick={() => navigate('/scores')}>
              <Calendar className="w-4 h-4 mr-3" />
              This Week
            </Button>
            <Button variant="outline" className="justify-start min-h-[44px]">
              <Star className="w-4 h-4 mr-3" />
              Free Agents
            </Button>
          </div>
        </div>

      </div>
      <BottomNav />
    </div>
  );
}