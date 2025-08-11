import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Trophy, Target, Lock, Zap, Flame } from "lucide-react";
import { useState, useEffect, useCallback } from "react";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { BottomNav } from "@/components/layout/bottom-nav";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { getWeekLabel } from "@shared/utils/weekUtils";

interface MokScoringRules {
  winPoints: number;
  tiePoints: number;
  lossPoints: number;
  blowoutPoints: number;
  shutoutPoints: number;
  weeklyHighPoints: number;
  weeklyLowPenalty: number;
  lockBonusPoints: number;
  lockAndLoadWinPoints: number;
  lockAndLoadLossPenalty: number;
  maxLocksPerTeamPerSeason: number;
  maxLockAndLoadPerTeamPerSeason: number;
}

interface UserWeeklyScore {
  userId: string;
  leagueId: string;
  week: number;
  season: number;
  teamResults: any[];
  totalBaseMokPoints: number;
  lockedTeam?: string;
  lockAndLoadTeam?: string;
  lockBonusPoints: number;
  lockAndLoadBonusPoints: number;
  totalMokPoints: number;
}

interface WeeklyScoresResponse {
  scores: UserWeeklyScore[];
  week: number;
  season: number;
}

interface NFLGame {
  id: string;
  homeTeam: string;
  awayTeam: string;
  homeScore: number;
  awayScore: number;
  week: number;
  season: number;
  gameDate: Date;
  isCompleted: boolean;
  homeOwner?: string;
  awayOwner?: string;
  homeOwnerName?: string;
  awayOwnerName?: string;
  homeLocked?: boolean;
  awayLocked?: boolean;
  homeLockAndLoad?: boolean;
  awayLockAndLoad?: boolean;
  homeMokPoints?: number;
  awayMokPoints?: number;
}

export default function ScoresPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [selectedWeek, setSelectedWeek] = useState(1); // Start with Week 1
  const [selectedGame, setSelectedGame] = useState<any>(null);
  const [selectedSeason] = useState(2024); // Using completed 2024 NFL season for testing

  // Listen for admin date advances to refresh scores automatically
  useEffect(() => {
    const connectWebSocket = () => {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}/draft-ws`;
      
      try {
        const ws = new WebSocket(wsUrl);
        
        ws.onmessage = (event) => {
          try {
            const message = JSON.parse(event.data);
            if (message.type === 'admin_date_advanced') {
              console.log('Admin date advanced, refreshing scores...');
              // Invalidate scores queries to trigger refresh
              queryClient.invalidateQueries({ queryKey: ['/api/scores'] });
              queryClient.invalidateQueries({ queryKey: [`/api/scores/week/${selectedWeek}`] });
            } else if (message.type === 'admin_season_reset') {
              console.log('Admin season reset, refreshing scores to show 0-0...');
              // Invalidate scores queries to trigger refresh and show cleared scores
              queryClient.invalidateQueries({ queryKey: ['/api/scores'] });
              queryClient.invalidateQueries({ queryKey: [`/api/scores/week/${selectedWeek}`] });
            }
          } catch (e) {
            console.log('WebSocket message parsing error:', e);
          }
        };

        ws.onopen = () => console.log('Scores WebSocket connected for live admin updates');
        ws.onclose = () => console.log('Scores WebSocket disconnected');
        ws.onerror = (error) => console.log('Scores WebSocket error:', error);
        
        return ws;
      } catch (error) {
        console.log('WebSocket connection failed:', error);
        return null;
      }
    };

    const ws = connectWebSocket();
    return () => {
      if (ws) ws.close();
    };
  }, [queryClient, selectedWeek]);

  // Get user's leagues to show scores for
  const { data: userLeagues } = useQuery({
    queryKey: ['/api/user/leagues'],
    enabled: !!user
  });

  // Get scoring rules
  const { data: scoringRules } = useQuery<MokScoringRules>({
    queryKey: ['/api/scoring/rules']
  });

  // Get current league (use real EEW2YU test league)  
  const currentLeague = (userLeagues && Array.isArray(userLeagues) && userLeagues.length > 0) ? userLeagues[0] : {
    id: '243d719b-92ce-4752-8689-5da93ee69213',
    name: 'Test League 1',
    season: 2024
  };

  // Get NFL teams to map logos and owners
  const { data: nflTeams } = useQuery({
    queryKey: ['/api/nfl-teams'],
    enabled: !!currentLeague
  });

  // Get league members to show ownership
  const { data: leagueMembers } = useQuery({
    queryKey: [`/api/leagues/${currentLeague?.id}/members`],
    enabled: !!currentLeague
  });

  // Get weekly scores for current league with automatic refreshing
  const { data: weeklyScores, isLoading: loadingWeekly } = useQuery<WeeklyScoresResponse>({
    queryKey: [`/api/leagues/${currentLeague?.id}/scores/${selectedSeason}/${selectedWeek}`],
    enabled: !!currentLeague,
    refetchInterval: 30000, // Refresh scores every 30 seconds
    refetchIntervalInBackground: true,
    staleTime: 15000,
    refetchOnWindowFocus: true
  });

  // Get real NFL games for selected week from the scores API with automatic refreshing
  const { data: nflGamesData, isLoading: loadingGames, error: gamesError } = useQuery({
    queryKey: [`/api/scores/week/${selectedWeek}/${selectedSeason}`],
    queryFn: async () => {
      console.log(`[DEBUG] Fetching games for week ${selectedWeek} season ${selectedSeason}`);
      const response = await fetch(`/api/scores/week/${selectedWeek}?season=${selectedSeason}`);
      const data = await response.json();
      console.log(`[DEBUG] API Response:`, data);
      return data;
    },
    enabled: !!currentLeague && selectedWeek >= 1 && selectedWeek <= 18,
    refetchInterval: 30000, // Automatically refresh every 30 seconds
    refetchIntervalInBackground: true, // Keep refreshing even when tab is not active
    staleTime: 15000, // Consider data stale after 15 seconds
    refetchOnWindowFocus: true, // Refresh when user returns to tab
    refetchOnMount: true // Always fetch fresh data on component mount
  });

  // Get user's teams for highlighting
  const { data: userTeams } = useQuery({
    queryKey: [`/api/user/stable/${currentLeague?.id}`],
    enabled: !!user && !!currentLeague
  });

  // WebSocket connection for real-time updates (using draft WebSocket for lock updates)
  useEffect(() => {
    if (!currentLeague) return;

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/draft-ws`;
    
    console.log('[WebSocket] Connecting to draft WebSocket for lock updates:', wsUrl);
    const ws = new WebSocket(wsUrl);
    
    ws.onopen = () => {
      console.log('[WebSocket] Connected to draft WebSocket for lock updates');
      // Send identification as scores page client
      ws.send(JSON.stringify({
        type: 'scores-page-connect',
        leagueId: currentLeague.id,
        week: selectedWeek
      }));
    };
    
    ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        console.log('[WebSocket] Received live score update:', message);
        
        if (message.type === 'lock-update') {
          console.log('[WebSocket] Lock update received:', message);
          // Invalidate and refetch scores to show updated lock icons
          queryClient.invalidateQueries({ 
            queryKey: [`/api/scores/week/${selectedWeek}`] 
          });
          queryClient.invalidateQueries({ 
            queryKey: [`/api/leagues/${currentLeague.id}/scores/${selectedSeason}/${selectedWeek}`] 
          });
          
          console.log('[WebSocket] Refreshed scores after lock update');
        }
      } catch (error) {
        console.error('[WebSocket] Error parsing message:', error);
      }
    };
    
    ws.onerror = (error) => {
      console.error('[WebSocket] Connection error:', error);
    };
    
    ws.onclose = () => {
      console.log('[WebSocket] Live scores connection closed');
    };
    
    return () => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.close();
      }
    };
  }, [currentLeague, selectedWeek, queryClient, selectedSeason]);

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p>Please sign in to view scores</p>
      </div>
    );
  }

  if (!currentLeague) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p>Join a league to view scores</p>
      </div>
    );
  }

  // Transform real NFL games data from the scores API
  const nflGames: NFLGame[] = (nflGamesData as any)?.games?.map((game: any, index: number) => {
    return {
    id: game.id || `game_${selectedWeek}_${index}`,
    homeTeam: game.homeTeam,
    awayTeam: game.awayTeam,
    homeScore: game.homeScore,
    awayScore: game.awayScore,
    week: selectedWeek,
    season: selectedSeason,
    gameDate: new Date(game.gameDate),
    isCompleted: game.isCompleted || false,
    // Team ownership from draft data
    homeOwner: game.homeOwner || '',
    homeOwnerName: game.homeOwnerName || '',
    awayOwner: game.awayOwner || '',
    awayOwnerName: game.awayOwnerName || '',
    // Lock status
    homeLocked: game.homeLocked || false,
    awayLocked: game.awayLocked || false,
    homeLockAndLoad: game.homeLockAndLoad || false,
    awayLockAndLoad: game.awayLockAndLoad || false,
    // Mok points
    homeMokPoints: game.homeMokPoints || 0,
    awayMokPoints: game.awayMokPoints || 0
    };
  }) || [];



  const isUserTeam = (teamCode: string): boolean => {
    if (!user || !userTeams) {
      console.log('[DEBUG] isUserTeam: Missing user or userTeams', { user: !!user, userTeams: !!userTeams });
      return false;
    }
    
    const isOwned = Array.isArray(userTeams) && userTeams.some((team: any) => team.nflTeam?.code === teamCode);
    if (isOwned) {
      console.log('[DEBUG] ✅ YOUR TEAM FOUND:', teamCode, '- Should be GREEN');
    }
    
    return isOwned;
  };

  const isTeamLocked = (teamCode: string): { locked: boolean; lockAndLoad: boolean } => {
    const game = nflGames.find(g => g.homeTeam === teamCode || g.awayTeam === teamCode);
    if (game?.homeTeam === teamCode) {
      return { locked: !!game.homeLocked, lockAndLoad: !!game.homeLockAndLoad };
    }
    if (game?.awayTeam === teamCode) {
      return { locked: !!game.awayLocked, lockAndLoad: !!game.awayLockAndLoad };
    }
    return { locked: false, lockAndLoad: false };
  };

  return (
    <div className="flex flex-col min-h-screen">
      {/* Main Content */}
      <div className="flex-1 container mx-auto px-4 py-6 max-w-4xl pb-24">
        <div className="flex flex-col space-y-6">
          {/* Header */}
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold">Scores</h1>
                <p className="text-muted-foreground">{currentLeague.name}</p>
              </div>
              
              {/* Week Selector - Dropdown Style */}
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">Week</span>
                <select 
                  value={selectedWeek}
                  onChange={(e) => setSelectedWeek(Number(e.target.value))}
                  className="bg-background border border-border rounded-md px-3 py-2 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                >
                  {/* Regular season options - Week 1 to Week 18 */}
                  {Array.from({length: 18}, (_, i) => i + 1).map(week => (
                    <option key={week} value={week}>
                      Week {week}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

        {/* Games List */}
        <div className="space-y-4">
          {loadingGames && (
            <div className="text-center py-8">Loading Week {selectedWeek} games...</div>
          )}
          {!loadingGames && nflGames.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              No games found for Week {selectedWeek}
              <div className="text-xs mt-2 space-y-1">
                <div>Debug: Week {selectedWeek}</div>
                <div>Games data: {nflGamesData ? JSON.stringify(nflGamesData).substring(0, 200) + '...' : 'null'}</div>
                {gamesError && <div className="text-red-500">Error: {JSON.stringify(gamesError)}</div>}
              </div>
            </div>
          )}
          {nflGames
            .sort((a: NFLGame, b: NFLGame) => new Date(a.gameDate).getTime() - new Date(b.gameDate).getTime())
            .map((game: NFLGame) => {
              const homeWin = game.homeScore !== null && game.awayScore !== null && game.homeScore > game.awayScore;
              const awayWin = game.awayScore !== null && game.homeScore !== null && game.awayScore > game.homeScore;
              const scoreDiff = (game.homeScore !== null && game.awayScore !== null) ? Math.abs(game.homeScore - game.awayScore) : 0;
              const isBlowout = scoreDiff >= 20;
              const isShutout = game.homeScore === 0 || game.awayScore === 0;
              
              const homeLockStatus = isTeamLocked(game.homeTeam);
              const awayLockStatus = isTeamLocked(game.awayTeam);
              
              return (
                <div 
                  key={game.id} 
                  className="bg-card rounded-lg p-4 space-y-3 cursor-pointer hover:shadow-md transition-shadow"
                  onClick={() => setSelectedGame(game)}
                >
                  {/* Game Header */}
                  <div className="flex justify-between items-center text-sm text-muted-foreground">
                    <span>{new Date(game.gameDate).toLocaleDateString('en-US', { 
                      weekday: 'short', 
                      month: 'short', 
                      day: 'numeric',
                      hour: 'numeric',
                      minute: '2-digit',
                      timeZone: 'America/New_York'
                    })} ET</span>
                    {game.isCompleted && (
                      <Badge variant="outline" className="text-xs">Final</Badge>
                    )}
                  </div>

                  {/* Teams and Scores */}
                  <div className="space-y-2">
                    {/* Away Team */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3 flex-1">
                        <img 
                          src={`/images/nfl/team_logos/${game.awayTeam}.png`}
                          alt={game.awayTeam}
                          className="w-8 h-8"
                          onError={(e) => {
                            console.log(`[Image Error] Failed to load ${game.awayTeam} logo, trying fallback`);
                            // Use ESPN's reliable team logo API
                            (e.target as HTMLImageElement).src = `https://a.espncdn.com/i/teamlogos/nfl/500/${game.awayTeam.toLowerCase()}.png`;
                          }}
                        />
                        <div className="flex items-center gap-2">
                          <span className={`font-medium ${
                            isUserTeam(game.awayTeam) 
                              ? 'text-green-600 font-bold' 
                              : awayWin ? 'text-foreground' : 'text-muted-foreground'
                          }`}>
                            {game.awayTeam}
                          </span>
                          {game.awayOwnerName && (
                            <span className="text-xs text-muted-foreground">
                              ({game.awayOwnerName})
                            </span>
                          )}
                          {awayLockStatus.locked && (
                            <Lock className="w-3 h-3 text-blue-500" />
                          )}
                          {awayLockStatus.lockAndLoad && (
                            <Zap className="w-3 h-3 text-orange-500" />
                          )}
                          {game.isCompleted && (game.awayMokPoints || 0) > 0 && (
                            <div className="flex items-center space-x-1">
                              <Flame className="w-3 h-3 text-purple-500" />
                              <span className="text-xs text-purple-600 font-medium">+{game.awayMokPoints}</span>
                            </div>
                          )}
                        </div>
                      </div>
                      <div className={`text-xl font-bold ${awayWin ? 'text-foreground' : 'text-muted-foreground'}`}>
                        {game.awayScore !== null && game.awayScore !== undefined ? game.awayScore : '-'}
                      </div>
                    </div>

                    {/* Home Team */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3 flex-1">
                        <img 
                          src={`/images/nfl/team_logos/${game.homeTeam}.png`}
                          alt={game.homeTeam}
                          className="w-8 h-8"
                          onError={(e) => {
                            console.log(`[Image Error] Failed to load ${game.homeTeam} logo, trying fallback`);
                            // Use ESPN's reliable team logo API
                            (e.target as HTMLImageElement).src = `https://a.espncdn.com/i/teamlogos/nfl/500/${game.homeTeam.toLowerCase()}.png`;
                          }}
                        />
                        <div className="flex items-center gap-2">
                          <span className={`font-medium ${
                            isUserTeam(game.homeTeam) 
                              ? 'text-green-600 font-bold' 
                              : homeWin ? 'text-foreground' : 'text-muted-foreground'
                          }`}>
                            {game.homeTeam}
                          </span>
                          {game.homeOwnerName && (
                            <span className="text-xs text-muted-foreground">
                              ({game.homeOwnerName})
                            </span>
                          )}
                          {homeLockStatus.locked && (
                            <Lock className="w-3 h-3 text-blue-500" />
                          )}
                          {homeLockStatus.lockAndLoad && (
                            <Zap className="w-3 h-3 text-orange-500" />
                          )}
                          {game.isCompleted && (game.homeMokPoints || 0) > 0 && (
                            <div className="flex items-center space-x-1">
                              <Flame className="w-3 h-3 text-purple-500" />
                              <span className="text-xs text-purple-600 font-medium">+{game.homeMokPoints}</span>
                            </div>
                          )}
                        </div>
                      </div>
                      <div className={`text-xl font-bold ${homeWin ? 'text-foreground' : 'text-muted-foreground'}`}>
                        {game.homeScore !== null && game.homeScore !== undefined ? game.homeScore : '-'}
                      </div>
                    </div>
                  </div>

                  {/* Game Bonuses */}
                  {game.isCompleted && (isBlowout || isShutout) && (
                    <div className="flex gap-2 pt-2 border-t border-border">
                      {isBlowout && (
                        <Badge variant="secondary" className="text-xs">
                          <Trophy className="w-3 h-3 mr-1" />
                          Blowout
                        </Badge>
                      )}
                      {isShutout && (
                        <Badge variant="secondary" className="text-xs">
                          <Target className="w-3 h-3 mr-1" />
                          Shutout
                        </Badge>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Game Details Modal - Sleeper/ESPN Style */}
      <Dialog open={!!selectedGame} onOpenChange={(open) => !open && setSelectedGame(null)}>
        <DialogContent className="max-w-md p-0 gap-0">
          {selectedGame && (
            <div className="relative">
              {/* Header with gradient background */}
              <div className="bg-gradient-to-br from-blue-600 to-purple-700 text-white p-4 rounded-t-lg">
                <div className="flex justify-between items-start mb-2">
                  <div className="text-sm opacity-90">
                    Week {selectedGame.week} • {new Date(selectedGame.gameDate).toLocaleDateString('en-US', {
                      weekday: 'short',
                      month: 'short', 
                      day: 'numeric'
                    })}
                  </div>
                  <Badge variant="secondary" className="text-xs bg-white/20 text-white border-0">
                    Final
                  </Badge>
                </div>
                <div className="text-xs opacity-75">
                  {new Date(selectedGame.gameDate).toLocaleTimeString('en-US', {
                    hour: 'numeric',
                    minute: '2-digit',
                    timeZone: 'America/New_York'
                  })} ET
                </div>
              </div>

              {/* Main Score Display */}
              <div className="bg-card">
                {/* Away Team */}
                <div className="flex items-center justify-between p-4 border-b border-border/50">
                  <div className="flex items-center gap-4 flex-1">
                    <div className="relative">
                      <img 
                        src={`/images/nfl/team_logos/${selectedGame.awayTeam}.png`}
                        alt={selectedGame.awayTeam}
                        className="w-12 h-12"
                        onError={(e) => {
                          (e.target as HTMLImageElement).src = `https://www.fantasynerds.com/images/nfl/team_logos/${selectedGame.awayTeam}.png`;
                        }}
                      />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <div className={`font-bold text-lg ${selectedGame.awayScore > selectedGame.homeScore ? 'text-green-600' : 'text-muted-foreground'}`}>
                          {selectedGame.awayTeam}
                        </div>
                        <div className="flex items-center gap-1">
                          {selectedGame.awayLocked && <Lock className="w-4 h-4 text-blue-500" />}
                          {selectedGame.awayLockAndLoad && <Zap className="w-4 h-4 text-orange-500" />}
                        </div>
                      </div>
                      {selectedGame.awayOwnerName && (
                        <div className="text-sm text-muted-foreground">
                          {selectedGame.awayOwnerName}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {(selectedGame.awayMokPoints || 0) > 0 && (
                      <div className="flex items-center gap-1 bg-purple-100 dark:bg-purple-900/30 px-2 py-1 rounded-full">
                        <Flame className="w-3 h-3 text-purple-600" />
                        <span className="text-xs font-medium text-purple-700 dark:text-purple-300">+{selectedGame.awayMokPoints}</span>
                      </div>
                    )}
                    <div className={`text-2xl font-bold ${selectedGame.awayScore > selectedGame.homeScore ? 'text-foreground' : 'text-muted-foreground'}`}>
                      {selectedGame.awayScore}
                    </div>
                  </div>
                </div>

                {/* Home Team */}
                <div className="flex items-center justify-between p-4">
                  <div className="flex items-center gap-4 flex-1">
                    <div className="relative">
                      <img 
                        src={`/images/nfl/team_logos/${selectedGame.homeTeam}.png`}
                        alt={selectedGame.homeTeam}
                        className="w-12 h-12"
                        onError={(e) => {
                          (e.target as HTMLImageElement).src = `https://www.fantasynerds.com/images/nfl/team_logos/${selectedGame.homeTeam}.png`;
                        }}
                      />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <div className={`font-bold text-lg ${selectedGame.homeScore > selectedGame.awayScore ? 'text-green-600' : 'text-muted-foreground'}`}>
                          {selectedGame.homeTeam}
                        </div>
                        <div className="flex items-center gap-1">
                          {selectedGame.homeLocked && <Lock className="w-4 h-4 text-blue-500" />}
                          {selectedGame.homeLockAndLoad && <Zap className="w-4 h-4 text-orange-500" />}
                        </div>
                      </div>
                      {selectedGame.homeOwnerName && (
                        <div className="text-sm text-muted-foreground">
                          {selectedGame.homeOwnerName}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {(selectedGame.homeMokPoints || 0) > 0 && (
                      <div className="flex items-center gap-1 bg-purple-100 dark:bg-purple-900/30 px-2 py-1 rounded-full">
                        <Flame className="w-3 h-3 text-purple-600" />
                        <span className="text-xs font-medium text-purple-700 dark:text-purple-300">+{selectedGame.homeMokPoints}</span>
                      </div>
                    )}
                    <div className={`text-2xl font-bold ${selectedGame.homeScore > selectedGame.awayScore ? 'text-foreground' : 'text-muted-foreground'}`}>
                      {selectedGame.homeScore}
                    </div>
                  </div>
                </div>
              </div>

              {/* Mok Points Breakdown */}
              <div className="bg-muted/30 p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <Flame className="w-4 h-4 text-purple-600" />
                  <h4 className="font-semibold text-sm">Mok Points Breakdown</h4>
                </div>
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Trophy className="w-3 h-3 text-amber-500" />
                      <span>Win: <span className="font-medium">+1</span></span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Lock className="w-3 h-3 text-blue-500" />
                      <span>Lock Bonus: <span className="font-medium">+1</span></span>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Target className="w-3 h-3 text-red-500" />
                      <span>Blowout: <span className="font-medium">+1</span></span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Zap className="w-3 h-3 text-orange-500" />
                      <span>L&L: <span className="font-medium">+2/-1</span></span>
                    </div>
                  </div>
                </div>
                
                {/* Game bonuses if applicable */}
                {(() => {
                  const scoreDiff = Math.abs(selectedGame.homeScore - selectedGame.awayScore);
                  const isBlowout = scoreDiff >= 20;
                  const isShutout = selectedGame.homeScore === 0 || selectedGame.awayScore === 0;
                  
                  if (isBlowout || isShutout) {
                    return (
                      <div className="pt-2 border-t border-border/50">
                        <div className="text-xs font-medium text-muted-foreground mb-1">Game Bonuses:</div>
                        <div className="flex gap-2">
                          {isBlowout && (
                            <Badge variant="secondary" className="text-xs">
                              <Trophy className="w-3 h-3 mr-1" />
                              Blowout
                            </Badge>
                          )}
                          {isShutout && (
                            <Badge variant="secondary" className="text-xs">
                              <Target className="w-3 h-3 mr-1" />
                              Shutout
                            </Badge>
                          )}
                        </div>
                      </div>
                    );
                  }
                  return null;
                })()}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <BottomNav />
    </div>
  );
}