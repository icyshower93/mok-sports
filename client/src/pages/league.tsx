import { BottomNav } from "@/components/layout/bottom-nav";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { useLocation } from "wouter";
import { useState, useMemo } from "react";
import { useRealtimeScores } from "@/hooks/use-realtime-scores";
import { 
  Trophy, 
  DollarSign, 
  Crown, 
  Settings,
  Award,
  Target,
  Loader2,
  ChevronDown,
  ChevronUp,
  ChevronRight,
  Lock,
  Gift,
  Star,
  Zap,
  TrendingUp,
  CheckCircle,
  Coins
} from "lucide-react";

export default function LeaguePage() {
  const { user } = useAuth();
  const [location] = useLocation();
  const [expandedUsers, setExpandedUsers] = useState<Set<string>>(new Set());
  
  // Enable real-time score updates for instant point visibility
  useRealtimeScores();
  
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

  // Get weekly skins data to show winners
  const { data: skinsData } = useQuery({
    queryKey: [`/api/scoring/skins/${targetLeagueId}/2024`],
    enabled: !!user && !!targetLeagueId,
  });

  // Process skins data to calculate skins won per user - MOVED BEFORE EARLY RETURNS
  const userSkinsWon = useMemo(() => {
    try {
      if (!skinsData || !(skinsData as any)?.skins || !Array.isArray((skinsData as any)?.skins)) {
        console.log('[League] No skins data available, returning empty object');
        return {};
      }
      
      const skinsCount: Record<string, number> = {};
      (skinsData as any).skins.forEach((skin: any) => {
        if (skin && skin.winnerName) {
          skinsCount[skin.winnerName] = (skinsCount[skin.winnerName] || 0) + 1;
        }
      });
      
      console.log('[League] Skins won by user:', skinsCount);
      return skinsCount;
    } catch (error) {
      console.error('[League] Error processing skins data:', error);
      return {};
    }
  }, [skinsData]);

  // EARLY RETURNS MOVED AFTER ALL HOOKS
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

  const { league: leagueInfo, standings, seasonPrizes } = leagueData as any || { league: null, standings: [], seasonPrizes: [] };

  const toggleUserExpansion = (userName: string) => {
    setExpandedUsers(prev => {
      const newSet = new Set(prev);
      if (newSet.has(userName)) {
        newSet.delete(userName);
      } else {
        newSet.add(userName);
      }
      return newSet;
    });
  };

  // Format name as "First L." or "F. L." for long first names
  const formatName = (fullName: string) => {
    const parts = fullName.trim().split(' ');
    if (parts.length === 1) return fullName; // Single name, return as is
    
    const firstName = parts[0];
    const lastName = parts[parts.length - 1];
    
    // If first name is longer than 8 characters, use initials
    if (firstName.length > 8) {
      return `${firstName[0]}. ${lastName[0]}.`;
    }
    
    // Otherwise use "First L."
    return `${firstName} ${lastName[0]}.`;
  };

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

        {/* Professional Standings Card */}
        <Card className="overflow-hidden bg-gradient-to-br from-card to-card/50 border-border/50 shadow-lg rounded-2xl mb-6">
          <CardHeader className="pb-4 bg-gradient-to-r from-primary/5 to-primary/10">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-primary/10 rounded-full">
                  <Trophy className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <CardTitle className="text-xl font-bold">Season Standings</CardTitle>
                  <p className="text-sm text-muted-foreground">Week {(currentWeekData as any)?.currentWeek || leagueInfo?.week} • 6 players</p>
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-border/30">
              {standings.map((member: any, index: number) => (
                <div key={member.name} className="group">
                  {/* Main Player Row */}
                  <div 
                    className={`px-4 py-3 transition-all duration-200 cursor-pointer hover:bg-muted/20 ${
                      member.isCurrentUser ? 'bg-gradient-to-r from-primary/8 to-primary/4 border-l-4 border-primary/50' : ''
                    } ${expandedUsers.has(member.name) ? 'bg-muted/10' : ''}`}
                    onClick={() => toggleUserExpansion(member.name)}
                  >
                    <div className="flex items-center justify-between">
                      {/* Left: Place + Username */}
                      <div className="flex items-center space-x-3 flex-1 min-w-0">
                        {/* Place Number */}
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold shadow-sm flex-shrink-0 ${
                          member.rank === 1 ? 'bg-gradient-to-br from-yellow-400 to-yellow-600 text-white' :
                          member.rank === 2 ? 'bg-gradient-to-br from-gray-300 to-gray-500 text-white' :
                          member.rank === 3 ? 'bg-gradient-to-br from-orange-400 to-orange-600 text-white' :
                          'bg-muted text-muted-foreground'
                        }`}>
                          {member.rank === 1 ? <Crown className="w-4 h-4" /> : member.rank}
                        </div>
                        
                        {/* Username */}
                        <div className="flex-1 min-w-0">
                          <div className="font-bold text-base text-foreground truncate">{member.name}</div>
                        </div>
                      </div>
                      
                      {/* Right: Stats */}
                      <div className="flex items-center justify-end flex-1">
                        {/* Locks and Skins - Positioned far right with proper spacing */}
                        <div className="flex items-center space-x-3 mr-1">
                          {/* Locks Correct */}
                          <div className="text-center min-w-[36px]">
                            <div className="text-xs text-muted-foreground font-medium">LOCKS</div>
                            <div className="text-sm font-bold text-foreground">{member.locks}</div>
                          </div>
                          
                          {/* Skins Won */}
                          <div className="text-center min-w-[36px]">
                            <div className="text-xs text-muted-foreground font-medium">SKINS</div>
                            <div className="text-sm font-bold text-foreground">{userSkinsWon[member.name] || 0}</div>
                          </div>
                        </div>
                        
                        {/* Total Season Points - Most Prominent */}
                        <div className="text-right min-w-[50px] mr-4">
                          <div className="text-2xl font-black text-foreground">{member.points}</div>
                          <div className="text-xs text-muted-foreground font-medium">PTS</div>
                        </div>
                        
                        {/* Chevron */}
                        <div className={`transition-transform duration-200 ${
                          expandedUsers.has(member.name) ? 'rotate-90' : ''
                        }`}>
                          <ChevronRight className="w-4 h-4 text-muted-foreground" />
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  {/* Expanded Teams Section with Animation */}
                  {expandedUsers.has(member.name) && member.teams && member.teams.length > 0 && (
                    <div className="px-4 py-3 bg-muted/5 border-t border-border/20 animate-in slide-in-from-top-2 duration-200">
                      <div className="flex items-center justify-center">
                        <div className="flex items-center space-x-2 flex-wrap justify-center max-w-xs">
                          {member.teams.map((team: any, teamIndex: number) => (
                            <div 
                              key={team.code} 
                              className="w-10 h-10 rounded-lg bg-muted/20 flex items-center justify-center animate-in fade-in-0 duration-300"
                              style={{ animationDelay: `${teamIndex * 50}ms` }}
                            >
                              <img 
                                src={`/images/nfl/team_logos/${team.code}.png`}
                                alt={team.code}
                                title={`${team.name} (${team.code})`}
                                className="w-10 h-10 rounded-lg object-contain shadow-sm hover:scale-105 transition-all duration-150"
                                onLoad={(e) => {
                                  // Remove background once image loads
                                  const container = e.currentTarget.parentElement;
                                  if (container) {
                                    container.classList.remove('bg-muted/20');
                                  }
                                }}
                                onError={(e) => {
                                  (e.target as HTMLImageElement).src = `https://a.espncdn.com/i/teamlogos/nfl/500/${team.code.toLowerCase()}.png`;
                                }}
                                loading="eager"
                              />
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

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