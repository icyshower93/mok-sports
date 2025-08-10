import { BottomNav } from "@/components/layout/bottom-nav";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { useLocation } from "wouter";
import { 
  Trophy, 
  DollarSign, 
  Crown, 
  Settings,
  Award,
  Target,
  Loader2
} from "lucide-react";

export default function LeaguePage() {
  const { user } = useAuth();
  const [location] = useLocation();
  
  // Get league ID from URL (assumes pattern /league?id=...)
  const searchParams = new URLSearchParams(location.split('?')[1] || '');
  const leagueId = searchParams.get('id');
  
  // If no league ID, try to get the user's first league
  const { data: userLeagues } = useQuery({
    queryKey: ['/api/user/leagues'],
    enabled: !!user && !leagueId,
  });
  
  // Use the provided league ID or fall back to EEW2YU league
  const targetLeagueId = leagueId || (userLeagues as any[])?.[0]?.id || '243d719b-92ce-4752-8689-5da93ee69213';
  
  // Get league standings data
  const { data: leagueData, isLoading } = useQuery({
    queryKey: [`/api/leagues/${targetLeagueId}/standings`],
    enabled: !!user && !!targetLeagueId,
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background pb-20">
        <div className="max-w-lg mx-auto">
          <div className="flex items-center justify-center h-64">
            <Loader2 className="w-6 h-6 animate-spin" />
          </div>
        </div>
        <BottomNav />
      </div>
    );
  }

  if (!leagueData) {
    return (
      <div className="min-h-screen bg-background pb-20">
        <div className="max-w-lg mx-auto p-4">
          <div className="text-center">
            <h2 className="text-lg font-semibold mb-2">League Not Found</h2>
            <p className="text-muted-foreground">Unable to load league data.</p>
          </div>
        </div>
        <BottomNav />
      </div>
    );
  }

  const { league: leagueInfo, standings, seasonPrizes } = leagueData || { league: null, standings: [], seasonPrizes: [] };

  return (
    <div className="min-h-screen bg-background pb-20">
      <div className="max-w-lg mx-auto">
        {/* Header */}
        <div className="p-4 border-b border-border/50 bg-card">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-yellow-100 dark:bg-yellow-900/30 rounded-full">
                <Trophy className="w-5 h-5 text-yellow-600 dark:text-yellow-400" />
              </div>
              <div>
                <h1 className="text-xl font-bold">{leagueInfo.name}</h1>
                <div className="flex items-center space-x-3 text-sm text-muted-foreground">
                  <span>{leagueInfo.joinCode}</span>
                  <span>•</span>
                  <span>Week {leagueInfo.week}</span>
                  <span>•</span>
                  <span>{leagueInfo.memberCount} members</span>
                </div>
              </div>
            </div>
            <Button variant="ghost" size="sm">
              <Settings className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Current Skins Prize - Prominent Display */}
        <div className="p-4">
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
                      Week {leagueInfo.week} prize
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-bold text-emerald-700 dark:text-emerald-300">
                    ${leagueInfo.weeklyPot}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Season Progress */}
        <div className="px-4 pb-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium">Season Progress</span>
            <span className="text-sm text-muted-foreground">
              Week {leagueInfo.week} of {leagueInfo.totalWeeks}
            </span>
          </div>
          <Progress value={(leagueInfo.week / leagueInfo.totalWeeks) * 100} className="h-2" />
        </div>

        {/* Season Standings */}
        <div className="p-4">
          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="text-lg">Season Standings</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {standings.map((member: any) => (
                <div key={member.name} className="flex items-start justify-between py-3 border-b border-border/30 last:border-b-0">
                  <div className="flex items-center space-x-3">
                    {/* Rank Badge */}
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center text-sm font-semibold ${
                      member.rank === 1 ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300' :
                      member.rank === 2 ? 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300' :
                      member.rank === 3 ? 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300' :
                      'bg-muted text-muted-foreground'
                    }`}>
                      {member.rank}
                    </div>
                    
                    {/* Avatar and Name */}
                    <div className="flex items-start space-x-3">
                      <Avatar className="w-8 h-8 mt-0.5">
                        <AvatarFallback className="text-xs font-medium">{member.avatar}</AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center space-x-2 mb-1">
                          <span className="font-medium text-sm">{member.name}</span>
                          {member.isCurrentUser && <Badge variant="secondary" className="text-xs">You</Badge>}
                        </div>
                        <div className="text-xs text-muted-foreground mb-2">
                          {member.locks} locks correct • {member.skinsWon || 0} skins won
                        </div>
                        {/* Team Logos Row */}
                        {member.teams && member.teams.length > 0 && (
                          <div className="flex items-center space-x-1.5">
                            {member.teams.map((team: any) => (
                              <img 
                                key={team.code}
                                src={`/images/nfl/team_logos/${team.code}.png`}
                                alt={team.code}
                                title={team.name}
                                className="w-6 h-6 rounded-sm object-contain"
                                onError={(e) => {
                                  console.log(`[League] Failed to load ${team.code} logo, using fallback`);
                                  (e.target as HTMLImageElement).src = `https://a.espncdn.com/i/teamlogos/nfl/500/${team.code.toLowerCase()}.png`;
                                }}
                              />
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  {/* Points */}
                  <div className="text-right">
                    <span className="text-lg font-bold">{member.points}</span>
                    <span className="text-sm text-muted-foreground ml-1">pts</span>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        {/* Season Prizes */}
        <div className="p-4">
          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="text-lg flex items-center space-x-2">
                <Award className="w-5 h-5" />
                <span>Season Prizes</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {seasonPrizes.map((prize: any, index: number) => (
                <div key={index} className="flex items-center justify-between py-2">
                  <div>
                    <div className="font-medium text-sm">{prize.name}</div>
                    <div className="text-xs text-muted-foreground">
                      Leader: {prize.leader}
                    </div>
                  </div>
                  <Badge variant="outline" className="text-sm font-semibold">
                    {prize.prize}
                  </Badge>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
      <BottomNav />
    </div>
  );
}