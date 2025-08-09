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
  const [navigate] = useLocation();
  const [selectedLeague, setSelectedLeague] = useState<string>("");
  const [selectedWeek] = useState(1);

  // Fetch user's leagues
  const { data: leagues = [], isLoading: leaguesLoading } = useQuery({
    queryKey: ['/api/users/leagues'],
    enabled: !!user,
  });

  // Fetch stable teams for selected league
  const { data: stableTeams = [] } = useQuery({
    queryKey: ['/api/stable', selectedLeague],
    enabled: !!selectedLeague,
  });

  // Set first league as default selection
  React.useEffect(() => {
    if (leagues.length > 0 && !selectedLeague) {
      setSelectedLeague(leagues[0].id);
    }
  }, [leagues, selectedLeague]);

  const currentLeague = leagues.find((l: League) => l.id === selectedLeague);
  const lockDeadline = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000);
  const isLockWindowOpen = true;

  // Transform stable data into user teams with lock/load state
  const userTeams = stableTeams.map((stable: any) => ({
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
            {leagues.length > 1 && (
              <select 
                value={selectedLeague || ''} 
                onChange={(e) => setSelectedLeague(e.target.value)}
                className="px-3 py-2 text-sm border rounded-lg bg-background"
              >
                {leagues.map((league: League) => (
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
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">Choose Your Lock</CardTitle>
                  <Badge variant="secondary" className="text-xs">
                    Week {selectedWeek}
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground">
                  Pick one team to lock for a bonus point if they win
                </p>
              </CardHeader>
              <CardContent className="space-y-3">
                {userTeams.length === 0 ? (
                  <div className="text-center py-8">
                    <div className="w-16 h-16 mx-auto mb-4 bg-muted rounded-full flex items-center justify-center">
                      <Shield className="w-8 h-8 text-muted-foreground" />
                    </div>
                    <h3 className="text-lg font-semibold mb-2">No Teams Yet</h3>
                    <p className="text-sm text-muted-foreground mb-4">
                      Complete a draft to start building your stable
                    </p>
                    <Button onClick={() => navigate('/leagues')}>
                      Join a League
                    </Button>
                  </div>
                ) : (
                  <>
                    {/* Lockable Teams */}
                    {userTeams.filter(team => team.locksRemaining > 0 && !team.isBye).map((team: any) => (
                      <div 
                        key={team.id}
                        className="group relative overflow-hidden rounded-lg border bg-card hover:bg-accent/50 transition-all duration-200"
                      >
                        <div className="flex items-center p-4">
                          <div className="flex items-center space-x-3 flex-1">
                            <TeamLogo 
                              logoUrl={team.nflTeam.logoUrl}
                              teamCode={team.nflTeam.code}
                              teamName={team.nflTeam.name}
                              size="lg"
                              className="w-12 h-12"
                            />
                            <div className="flex-1">
                              <div className="font-semibold">
                                {team.nflTeam.city} {team.nflTeam.name}
                              </div>
                              <div className="text-sm text-muted-foreground flex items-center space-x-2">
                                <span>{team.upcomingOpponent}</span>
                                <span>•</span>
                                <div className="flex items-center space-x-1">
                                  <Lock className="w-3 h-3" />
                                  <span>{team.locksRemaining} left</span>
                                </div>
                              </div>
                              {team.lockAndLoadAvailable && (
                                <Badge variant="outline" className="mt-1 text-xs">
                                  <Zap className="w-3 h-3 mr-1" />
                                  Lock & Load Ready
                                </Badge>
                              )}
                            </div>
                          </div>
                          
                          <div className="flex flex-col space-y-2">
                            <Button 
                              size="sm"
                              className="min-h-[36px] px-4"
                              disabled={team.isLocked}
                            >
                              {team.isLocked ? (
                                <>
                                  <Lock className="w-4 h-4 mr-2" />
                                  Locked
                                </>
                              ) : (
                                <>
                                  <Target className="w-4 h-4 mr-2" />
                                  Lock
                                </>
                              )}
                            </Button>
                            
                            {team.lockAndLoadAvailable && !team.isLocked && (
                              <Button 
                                variant="outline"
                                size="sm"
                                className="min-h-[36px] px-4 border-yellow-200 dark:border-yellow-800 text-yellow-700 dark:text-yellow-300 hover:bg-yellow-50 dark:hover:bg-yellow-950/20"
                              >
                                <Zap className="w-4 h-4 mr-2" />
                                Lock & Load
                              </Button>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}

                    {/* Used Up Teams */}
                    {userTeams.filter(team => team.locksRemaining === 0 && !team.isBye).length > 0 && (
                      <div className="pt-4 border-t border-border/50">
                        <p className="text-xs text-muted-foreground mb-3 font-medium">LOCKS EXHAUSTED</p>
                        {userTeams.filter(team => team.locksRemaining === 0 && !team.isBye).map((team: any) => (
                          <div 
                            key={team.id}
                            className="flex items-center p-3 rounded-lg bg-muted/30 opacity-60"
                          >
                            <TeamLogo 
                              logoUrl={team.nflTeam.logoUrl}
                              teamCode={team.nflTeam.code}
                              teamName={team.nflTeam.name}
                              size="sm"
                              className="w-8 h-8 mr-3"
                            />
                            <div className="flex-1">
                              <div className="font-medium text-sm">
                                {team.nflTeam.city} {team.nflTeam.name}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                {team.upcomingOpponent}
                              </div>
                            </div>
                            <Badge variant="secondary" className="text-xs">
                              All Used
                            </Badge>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Bye Week Teams */}
                    {userTeams.filter(team => team.isBye).length > 0 && (
                      <div className="pt-4 border-t border-border/50">
                        <p className="text-xs text-muted-foreground mb-3 font-medium">ON BYE</p>
                        {userTeams.filter(team => team.isBye).map((team: any) => (
                          <div 
                            key={team.id}
                            className="flex items-center p-3 rounded-lg bg-muted/20"
                          >
                            <TeamLogo 
                              logoUrl={team.nflTeam.logoUrl}
                              teamCode={team.nflTeam.code}
                              teamName={team.nflTeam.name}
                              size="sm"
                              className="w-8 h-8 mr-3 opacity-50"
                            />
                            <div className="flex-1">
                              <div className="font-medium text-sm opacity-75">
                                {team.nflTeam.city} {team.nflTeam.name}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                Bye Week
                              </div>
                            </div>
                          </div>
                        ))}
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