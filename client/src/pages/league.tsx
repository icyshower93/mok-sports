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
  
  // Get current week info
  const { data: currentWeekData } = useQuery({
    queryKey: ['/api/admin/current-week'],
    enabled: !!user,
  });
  
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
      <div className="max-w-4xl mx-auto px-4">
        {/* Simple Header */}
        <div className="py-6 pb-4">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-yellow-100 dark:bg-yellow-900/30 rounded-full">
              <Trophy className="w-5 h-5 text-yellow-600 dark:text-yellow-400" />
            </div>
            <h1 className="text-2xl font-bold">{leagueInfo.name}</h1>
          </div>
        </div>

        {/* Standings */}
        <div className="pb-6">
          <div className="mb-4">
            <h2 className="text-xl font-bold">Standings</h2>
            <p className="text-sm text-muted-foreground">Week {currentWeekData?.currentWeek || leagueInfo.week}</p>
          </div>
          
          <div className="space-y-3">
            {standings.map((member: any, index: number) => (
              <Card 
                key={member.name} 
                className={`${member.isCurrentUser ? 'ring-2 ring-primary/20 bg-primary/5' : ''}`}
              >
                <CardContent className="p-4">
                  <div className="flex items-center justify-between gap-2">
                    {/* Left: Rank + Team Info */}
                    <div className="flex items-center space-x-3 flex-1 min-w-0">
                      {/* Rank Badge */}
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                        member.rank === 1 ? 'bg-yellow-500 text-white' :
                        member.rank === 2 ? 'bg-gray-400 text-white' :
                        member.rank === 3 ? 'bg-orange-500 text-white' :
                        'bg-muted text-muted-foreground'
                      }`}>
                        {member.rank}
                      </div>
                      
                      {/* Team Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center space-x-2 mb-2">
                          <span className="font-semibold text-base">{member.name}</span>
                          {member.isCurrentUser && (
                            <Badge variant="secondary" className="text-xs">You</Badge>
                          )}
                        </div>
                        
                        {/* Team Logos - Show all 5 teams */}
                        {member.teams && member.teams.length > 0 && (
                          <div className="flex items-center space-x-1">
                            {member.teams.map((team: any) => (
                              <img 
                                key={team.code}
                                src={`/images/nfl/team_logos/${team.code}.png`}
                                alt={team.code}
                                title={team.name}
                                className="w-6 h-6 rounded object-contain"
                                onError={(e) => {
                                  (e.target as HTMLImageElement).src = `https://a.espncdn.com/i/teamlogos/nfl/500/${team.code.toLowerCase()}.png`;
                                }}
                              />
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                    
                    {/* Right: Stats */}
                    <div className="flex items-center space-x-6 text-sm">
                      <div className="text-center">
                        <div className="text-xs text-muted-foreground">LOCKS</div>
                        <div className="font-medium">{member.locks}</div>
                      </div>
                      <div className="text-center">
                        <div className="text-xs text-muted-foreground">SKINS</div>
                        <div className="font-medium">{member.skinsWon || 0}</div>
                      </div>
                      <div className="text-center">
                        <div className="text-xs text-muted-foreground">PTS</div>
                        <div className="text-lg font-bold">{member.points}</div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {/* Season Prizes */}
        <div className="pb-6">
          <div className="mb-4 flex items-center space-x-2">
            <Award className="w-5 h-5 text-yellow-500" />
            <h2 className="text-xl font-bold">Season Prizes</h2>
          </div>
          
          <div className="space-y-3">
            {/* Weekly Skins - First Card */}
            <Card className="bg-gradient-to-r from-emerald-50 to-green-50 dark:from-emerald-950/20 dark:to-green-950/20 border-emerald-200 dark:border-emerald-800">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="font-medium text-base">Weekly Skins</div>
                    <div className="text-sm text-muted-foreground">
                      Week {leagueInfo.week} prize
                    </div>
                  </div>
                  <Badge variant="outline" className="text-sm font-semibold text-emerald-600 border-emerald-200">
                    ${leagueInfo.weeklyPot}
                  </Badge>
                </div>
              </CardContent>
            </Card>

            {/* Season Prize Cards */}
            {seasonPrizes.map((prize: any, index: number) => (
              <Card key={index}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="font-medium text-base">{prize.name}</div>
                      <div className="text-sm text-muted-foreground">
                        {prize.leader}
                        {prize.points !== '-' && (
                          <span className="ml-1">• {prize.points} pts</span>
                        )}
                      </div>
                    </div>
                    <Badge variant="outline" className="text-sm font-semibold text-emerald-600 border-emerald-200">
                      {prize.prize}
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>
      <BottomNav />
    </div>
  );
}