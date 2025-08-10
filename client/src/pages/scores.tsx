import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Trophy, Target, Lock, Zap, Flame } from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { BottomNav } from "@/components/layout/bottom-nav";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

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
  const [selectedWeek, setSelectedWeek] = useState(1);
  const [selectedGame, setSelectedGame] = useState<any>(null);
  const [selectedSeason] = useState(2024); // Using real 2024 NFL season data

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

  // Get weekly scores for current league
  const { data: weeklyScores, isLoading: loadingWeekly } = useQuery<WeeklyScoresResponse>({
    queryKey: [`/api/leagues/${currentLeague?.id}/scores/${selectedSeason}/${selectedWeek}`],
    enabled: !!currentLeague
  });

  // Get real NFL games for selected week with ownership data
  const { data: nflGamesData, isLoading: loadingGames } = useQuery({
    queryKey: [`/api/scoring/week/${selectedWeek}`, currentLeague?.id],
    queryFn: () => fetch(`/api/scoring/week/${selectedWeek}?leagueId=${currentLeague?.id}`).then(res => res.json()),
    enabled: selectedWeek > 0 && !!currentLeague
  });

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

  // Transform real NFL games data from Tank01 API with ownership data
  const nflGames: NFLGame[] = (nflGamesData as any)?.results?.map((game: any, index: number) => {
    // Debug specific problematic games
    if (game.awayTeam === 'BAL' || game.homeTeam === 'KC') {
      console.log('BAL-KC Game Debug:', {
        homeTeam: game.homeTeam,
        awayTeam: game.awayTeam,
        homeScore: game.homeScore,
        awayScore: game.awayScore,
        isCompleted: game.isCompleted
      });
    }
    
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
    const game = nflGames.find(g => g.homeTeam === teamCode || g.awayTeam === teamCode);
    if (game?.homeTeam === teamCode) {
      return game.homeOwnerName === 'Sky Evans';
    }
    if (game?.awayTeam === teamCode) {
      return game.awayOwnerName === 'Sky Evans';
    }
    return false;
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
                            (e.target as HTMLImageElement).src = `https://www.fantasynerds.com/images/nfl/team_logos/${game.awayTeam}.png`;
                          }}
                        />
                        <div className="flex items-center gap-2">
                          <span className={`font-medium ${isUserTeam(game.awayTeam) ? 'text-green-600' : ''} ${awayWin ? 'text-foreground' : 'text-muted-foreground'}`}>
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
                          {game.isCompleted && game.awayMokPoints && game.awayMokPoints > 0 && (
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
                            (e.target as HTMLImageElement).src = `https://www.fantasynerds.com/images/nfl/team_logos/${game.homeTeam}.png`;
                          }}
                        />
                        <div className="flex items-center gap-2">
                          <span className={`font-medium ${isUserTeam(game.homeTeam) ? 'text-green-600' : ''} ${homeWin ? 'text-foreground' : 'text-muted-foreground'}`}>
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
                          {game.isCompleted && game.homeMokPoints && game.homeMokPoints > 0 && (
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
      <Dialog open={!!selectedGame} onOpenChange={() => setSelectedGame(null)}>
        <DialogContent className="max-w-md p-0 gap-0 border-0">
          {selectedGame && (
            <div className="relative">
              {/* Custom close button */}
              <button
                onClick={() => setSelectedGame(null)}
                className="absolute top-3 right-3 z-10 w-8 h-8 rounded-full bg-black/20 hover:bg-black/30 flex items-center justify-center text-white transition-colors"
                aria-label="Close"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18"></line>
                  <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
              </button>
              
              {/* Header with gradient background */}
              <div className="bg-gradient-to-br from-blue-600 to-purple-700 text-white p-4 rounded-t-lg">
                <div className="flex justify-between items-start mb-2 pr-8">
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
                    {selectedGame.awayMokPoints && selectedGame.awayMokPoints > 0 && (
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
                    {selectedGame.homeMokPoints && selectedGame.homeMokPoints > 0 && (
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