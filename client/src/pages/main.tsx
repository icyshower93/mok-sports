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
              {/* Weekly standings with point breakdown */}
              {[
                { 
                  rank: 1, 
                  name: "Sky Evans", 
                  avatar: "SE", 
                  weekPoints: 4.0,
                  isCurrentUser: true,
                  pointBreakdown: [
                    { source: "Wins", points: 2, detail: "KC, BUF" },
                    { source: "Lock Bonus", points: 1, detail: "KC locked" },
                    { source: "Blowout", points: 1, detail: "KC 31-17" }
                  ]
                },
                { 
                  rank: 2, 
                  name: "Sarah Wilson", 
                  avatar: "SW", 
                  weekPoints: 3.5,
                  isCurrentUser: false,
                  pointBreakdown: [
                    { source: "Wins", points: 2, detail: "BAL, GB" },
                    { source: "Lock & Load", points: 2, detail: "BAL L&L" },
                    { source: "Loss", points: -0.5, detail: "MIN tie" }
                  ]
                },
                { 
                  rank: 3, 
                  name: "Mike Chen", 
                  avatar: "MC", 
                  weekPoints: 2.0,
                  isCurrentUser: false,
                  pointBreakdown: [
                    { source: "Wins", points: 1, detail: "DAL" },
                    { source: "Lock Bonus", points: 1, detail: "DAL locked" }
                  ]
                },
                { 
                  rank: 4, 
                  name: "Alex Rodriguez", 
                  avatar: "AR", 
                  weekPoints: 1.5,
                  isCurrentUser: false,
                  pointBreakdown: [
                    { source: "Wins", points: 1, detail: "TB" },
                    { source: "Tie", points: 0.5, detail: "SEA 24-24" }
                  ]
                },
                { 
                  rank: 5, 
                  name: "Emma Davis", 
                  avatar: "ED", 
                  weekPoints: 1.0,
                  isCurrentUser: false,
                  pointBreakdown: [
                    { source: "Wins", points: 1, detail: "PIT" }
                  ]
                },
                { 
                  rank: 6, 
                  name: "Chris Martinez", 
                  avatar: "CM", 
                  weekPoints: 0.0,
                  isCurrentUser: false,
                  pointBreakdown: [
                    { source: "Weekly Low", points: -1, detail: "Lowest scorer" },
                    { source: "Wins", points: 1, detail: "DET" }
                  ]
                }
              ].map((member, index) => (
                <div 
                  key={member.name} 
                  className={`flex items-center justify-between p-3 rounded-lg border transition-all ${
                    member.isCurrentUser ? 'ring-2 ring-primary/20 bg-primary/5' : 'bg-card hover:bg-muted/30'
                  } ${index === 0 ? 'border-yellow-200 dark:border-yellow-800 bg-yellow-50/50 dark:bg-yellow-950/20' : ''}`}
                >
                  <div className="flex items-center space-x-3 flex-1">
                    <div className="flex items-center space-x-2">
                      <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                        member.rank === 1 ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400' :
                        member.rank === 2 ? 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400' :
                        member.rank === 3 ? 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400' :
                        'bg-muted text-muted-foreground'
                      }`}>
                        {member.rank}
                      </div>
                      {member.rank === 1 && <Crown className="w-4 h-4 text-yellow-500" />}
                    </div>
                    <Avatar className="w-8 h-8">
                      <AvatarFallback className="text-xs">{member.avatar}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1">
                      <div className="flex items-center space-x-2">
                        <span className="font-medium text-sm">{member.name}</span>
                        {member.isCurrentUser && <Badge variant="secondary" className="text-xs">You</Badge>}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {member.pointBreakdown.map((item, i) => (
                          <span key={i}>
                            {item.source}: {item.points > 0 ? '+' : ''}{item.points}
                            {i < member.pointBreakdown.length - 1 && ' • '}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-lg font-bold">{member.weekPoints}</div>
                    <div className="text-xs text-muted-foreground">pts</div>
                  </div>
                </div>
              ))}
              
              {/* Games still in progress indicator */}
              <div className="mt-3 pt-3 border-t border-border/50">
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <div className="flex items-center space-x-2">
                    <Clock className="w-3 h-3" />
                    <span>3 games still in progress</span>
                  </div>
                  <span>Updates live</span>
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