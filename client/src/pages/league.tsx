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
          <div className="mb-4">
            <h2 className="text-lg font-bold text-foreground">Season Standings</h2>
            <p className="text-sm text-muted-foreground">Week {leagueInfo.week} • {leagueInfo.memberCount} teams</p>
          </div>
          
          <div className="bg-card rounded-lg border border-border/50 overflow-hidden">
            {/* Header Row */}
            <div className="grid grid-cols-12 gap-2 px-4 py-3 bg-muted/30 border-b border-border/30 text-xs font-medium text-muted-foreground uppercase tracking-wide">
              <div className="col-span-1 text-center">Rank</div>
              <div className="col-span-6">Team</div>
              <div className="col-span-2 text-center">Locks</div>
              <div className="col-span-2 text-center">Skins</div>
              <div className="col-span-1 text-center">PTS</div>
            </div>
            
            {standings.map((member: any, index: number) => (
              <div 
                key={member.name} 
                className={`grid grid-cols-12 gap-2 px-4 py-4 border-b border-border/20 last:border-b-0 hover:bg-muted/20 transition-colors ${
                  member.isCurrentUser ? 'bg-primary/5 border-primary/20' : ''
                }`}
              >
                {/* Rank */}
                <div className="col-span-1 flex items-center justify-center">
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                    member.rank === 1 ? 'bg-yellow-500 text-white' :
                    member.rank === 2 ? 'bg-gray-400 text-white' :
                    member.rank === 3 ? 'bg-orange-500 text-white' :
                    'bg-muted text-muted-foreground'
                  }`}>
                    {member.rank}
                  </div>
                </div>
                
                {/* Team Info */}
                <div className="col-span-6 flex items-center space-x-3">
                  <Avatar className="w-8 h-8">
                    <AvatarFallback className="text-xs font-medium">{member.avatar}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center space-x-2">
                      <span className="font-medium text-sm truncate">{member.name}</span>
                      {member.isCurrentUser && (
                        <Badge variant="secondary" className="text-xs px-1.5 py-0.5">You</Badge>
                      )}
                    </div>
                    {/* Team Logos */}
                    {member.teams && member.teams.length > 0 && (
                      <div className="flex items-center space-x-1 mt-1">
                        {member.teams.map((team: any) => (
                          <img 
                            key={team.code}
                            src={`/images/nfl/team_logos/${team.code}.png`}
                            alt={team.code}
                            title={team.name}
                            className="w-4 h-4 rounded-sm object-contain opacity-90"
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
                
                {/* Locks Correct */}
                <div className="col-span-2 flex items-center justify-center">
                  <span className="text-sm font-medium">{member.locks}</span>
                </div>
                
                {/* Skins Won */}
                <div className="col-span-2 flex items-center justify-center">
                  <span className="text-sm font-medium">{member.skinsWon || 0}</span>
                </div>
                
                {/* Total Points */}
                <div className="col-span-1 flex items-center justify-center">
                  <span className="text-sm font-bold text-foreground">{member.points}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Season Prizes */}
        <div className="p-4">
          <div className="mb-4 flex items-center space-x-2">
            <Award className="w-5 h-5 text-yellow-500" />
            <h2 className="text-lg font-bold text-foreground">Season Prizes</h2>
          </div>
          
          <div className="bg-card rounded-lg border border-border/50 overflow-hidden">
            {/* Header Row */}
            <div className="grid grid-cols-3 gap-4 px-4 py-3 bg-muted/30 border-b border-border/30 text-xs font-medium text-muted-foreground uppercase tracking-wide">
              <div>Prize Category</div>
              <div className="text-center">Current Leader</div>
              <div className="text-center">Payout</div>
            </div>
            
            {seasonPrizes.map((prize: any, index: number) => (
              <div key={index} className="grid grid-cols-3 gap-4 px-4 py-4 border-b border-border/20 last:border-b-0 hover:bg-muted/20 transition-colors">
                <div className="font-medium text-sm">{prize.name}</div>
                <div className="text-center">
                  <span className="text-sm font-medium">{prize.leader}</span>
                  {prize.points !== '-' && (
                    <span className="text-xs text-muted-foreground ml-1">({prize.points})</span>
                  )}
                </div>
                <div className="text-center">
                  <Badge variant="outline" className="text-sm font-semibold text-emerald-600 border-emerald-200">
                    {prize.prize}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
      <BottomNav />
    </div>
  );
}