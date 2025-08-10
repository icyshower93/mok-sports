import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Trophy, Target, Zap, Info, Users, Lock, Sparkles, Flame, X } from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
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
  homeLocked?: boolean;
  awayLocked?: boolean;
  homeLockAndLoad?: boolean;
  awayLockAndLoad?: boolean;
}

interface GameDetails {
  game: NFLGame;
  homePoints: number;
  awayPoints: number;
  homePointsBreakdown: PointsBreakdown;
  awayPointsBreakdown: PointsBreakdown;
}

interface PointsBreakdown {
  basePoints: number;
  blowoutBonus: number;
  shutoutBonus: number;
  weeklyHighBonus: number;
  weeklyLowPenalty: number;
  lockBonus: number;
  lockAndLoadBonus: number;
  total: number;
  details: string[];
}

export default function ScoresPage() {
  const { user } = useAuth();
  const [selectedWeek, setSelectedWeek] = useState(1);
  const [selectedSeason] = useState(2025);
  const [selectedGame, setSelectedGame] = useState<GameDetails | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Get user's leagues to show scores for
  const { data: userLeagues } = useQuery({
    queryKey: ['/api/user/leagues'],
    enabled: !!user
  });

  // Get scoring rules
  const { data: scoringRules } = useQuery<MokScoringRules>({
    queryKey: ['/api/scoring/rules']
  });

  // Get current league (first league for now)
  const currentLeague = userLeagues?.[0];

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

  // Create mock NFL games for current week (this would come from API in real implementation)
  const mockGames: NFLGame[] = [
    {
      id: '1',
      homeTeam: 'KC',
      awayTeam: 'BUF',
      homeScore: 31,
      awayScore: 17,
      week: selectedWeek,
      season: selectedSeason,
      gameDate: new Date('2025-01-15T18:00:00Z'),
      isCompleted: true,
      homeOwner: 'SE',
      homeLocked: true
    },
    {
      id: '2', 
      homeTeam: 'LAR',
      awayTeam: 'MIN',
      homeScore: 27,
      awayScore: 9,
      week: selectedWeek,
      season: selectedSeason,
      gameDate: new Date('2025-01-15T21:30:00Z'),
      isCompleted: true,
      awayOwner: 'JD',
      awayLockAndLoad: true
    },
    {
      id: '3',
      homeTeam: 'BAL',
      awayTeam: 'PIT',
      homeScore: 28,
      awayScore: 14,
      week: selectedWeek,
      season: selectedSeason,
      gameDate: new Date('2025-01-16T16:30:00Z'),
      isCompleted: true,
      homeOwner: 'MK',
      awayOwner: 'RJ',
      homeLocked: true
    }
  ];

  // Calculate Mok points for a team in a specific game
  const calculateTeamMokPoints = (game: NFLGame, isHome: boolean): number => {
    const teamScore = isHome ? game.homeScore : game.awayScore;
    const opponentScore = isHome ? game.awayScore : game.homeScore;
    const isOwned = isHome ? !!game.homeOwner : !!game.awayOwner;
    
    if (!isOwned || !game.isCompleted) return 0;
    
    let points = 0;
    const scoreDiff = teamScore - opponentScore;
    
    // Base points
    if (scoreDiff > 0) points += 1; // Win
    else if (scoreDiff === 0) points += 0.5; // Tie
    
    // Bonus points
    if (scoreDiff >= 20) points += 1; // Blowout (20+ points)
    if (opponentScore === 0 && scoreDiff > 0) points += 1; // Shutout
    
    // Mock weekly high/low (would be calculated from all games)
    const isWeeklyHigh = teamScore === 31; // KC's score is highest in mock data
    const isWeeklyLow = teamScore === 9; // MIN's score is lowest in mock data
    if (isWeeklyHigh) points += 1;
    if (isWeeklyLow) points -= 1;
    
    // Lock bonuses
    const isLocked = isHome ? game.homeLocked : game.awayLocked;
    const isLockAndLoad = isHome ? game.homeLockAndLoad : game.awayLockAndLoad;
    
    if (isLocked && !isLockAndLoad) {
      points += 1; // Regular lock bonus
    } else if (isLockAndLoad) {
      if (scoreDiff > 0) points += 2; // Lock & Load win
      else if (scoreDiff < 0) points -= 1; // Lock & Load loss
    }
    
    return points;
  };

  // Get detailed points breakdown for a team
  const getPointsBreakdown = (game: NFLGame, isHome: boolean): PointsBreakdown => {
    const teamScore = isHome ? game.homeScore : game.awayScore;
    const opponentScore = isHome ? game.awayScore : game.homeScore;
    const isOwned = isHome ? !!game.homeOwner : !!game.awayOwner;
    const teamCode = isHome ? game.homeTeam : game.awayTeam;
    
    const breakdown: PointsBreakdown = {
      basePoints: 0,
      blowoutBonus: 0,
      shutoutBonus: 0,
      weeklyHighBonus: 0,
      weeklyLowPenalty: 0,
      lockBonus: 0,
      lockAndLoadBonus: 0,
      total: 0,
      details: []
    };
    
    if (!isOwned || !game.isCompleted) {
      breakdown.details.push("Team not owned or game not completed");
      return breakdown;
    }
    
    const scoreDiff = teamScore - opponentScore;
    
    // Base points
    if (scoreDiff > 0) {
      breakdown.basePoints = 1;
      breakdown.details.push(`Win: +1 point`);
    } else if (scoreDiff === 0) {
      breakdown.basePoints = 0.5;
      breakdown.details.push(`Tie: +0.5 points`);
    } else {
      breakdown.details.push(`Loss: 0 points`);
    }
    
    // Bonus points
    if (scoreDiff >= 20) {
      breakdown.blowoutBonus = 1;
      breakdown.details.push(`Blowout win (${Math.abs(scoreDiff)} pts): +1 point`);
    }
    
    if (opponentScore === 0 && scoreDiff > 0) {
      breakdown.shutoutBonus = 1;
      breakdown.details.push(`Shutout defense: +1 point`);
    }
    
    // Weekly high/low
    const isWeeklyHigh = teamScore === 31;
    const isWeeklyLow = teamScore === 9;
    
    if (isWeeklyHigh) {
      breakdown.weeklyHighBonus = 1;
      breakdown.details.push(`Weekly high score (${teamScore}): +1 point`);
    }
    
    if (isWeeklyLow) {
      breakdown.weeklyLowPenalty = -1;
      breakdown.details.push(`Weekly low score (${teamScore}): -1 point`);
    }
    
    // Lock bonuses
    const isLocked = isHome ? game.homeLocked : game.awayLocked;
    const isLockAndLoad = isHome ? game.homeLockAndLoad : game.awayLockAndLoad;
    
    if (isLocked && !isLockAndLoad) {
      breakdown.lockBonus = 1;
      breakdown.details.push(`Regular lock bonus: +1 point`);
    } else if (isLockAndLoad) {
      if (scoreDiff > 0) {
        breakdown.lockAndLoadBonus = 2;
        breakdown.details.push(`Lock & Load win: +2 points`);
      } else if (scoreDiff < 0) {
        breakdown.lockAndLoadBonus = -1;
        breakdown.details.push(`Lock & Load loss: -1 point`);
      }
    }
    
    breakdown.total = breakdown.basePoints + breakdown.blowoutBonus + breakdown.shutoutBonus + 
                    breakdown.weeklyHighBonus + breakdown.weeklyLowPenalty + 
                    breakdown.lockBonus + breakdown.lockAndLoadBonus;
    
    return breakdown;
  };

  // Handle game click
  const handleGameClick = (game: NFLGame) => {
    const homeBreakdown = getPointsBreakdown(game, true);
    const awayBreakdown = getPointsBreakdown(game, false);
    
    const gameDetails: GameDetails = {
      game,
      homePoints: calculateTeamMokPoints(game, true),
      awayPoints: calculateTeamMokPoints(game, false),
      homePointsBreakdown: homeBreakdown,
      awayPointsBreakdown: awayBreakdown
    };
    
    setSelectedGame(gameDetails);
    setIsModalOpen(true);
  };

  const getUserInitials = (teamCode: string): string => {
    const game = mockGames.find(g => g.homeTeam === teamCode || g.awayTeam === teamCode);
    if (game?.homeTeam === teamCode && game.homeOwner) return game.homeOwner;
    if (game?.awayTeam === teamCode && game.awayOwner) return game.awayOwner;
    return '';
  };

  const isUserTeam = (teamCode: string): boolean => {
    const initials = getUserInitials(teamCode);
    return initials === 'SE'; // Sky Evans initials
  };

  const isTeamLocked = (teamCode: string): { locked: boolean; lockAndLoad: boolean } => {
    const game = mockGames.find(g => g.homeTeam === teamCode || g.awayTeam === teamCode);
    if (game?.homeTeam === teamCode) {
      return { locked: !!game.homeLocked, lockAndLoad: !!game.homeLockAndLoad };
    }
    if (game?.awayTeam === teamCode) {
      return { locked: !!game.awayLocked, lockAndLoad: !!game.awayLockAndLoad };
    }
    return { locked: false, lockAndLoad: false };
  };

  return (
    <div className="container mx-auto px-4 py-6 max-w-4xl">
      <div className="flex flex-col space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4">
          <div>
            <h1 className="text-2xl font-bold">Scores</h1>
            <p className="text-muted-foreground">{currentLeague.name} • Week {selectedWeek}</p>
          </div>
          
          {/* Week Selector */}
          <div className="flex gap-2 flex-wrap">
            {Array.from({length: 18}, (_, i) => i + 1).map(week => (
              <Button
                key={week}
                variant={selectedWeek === week ? 'default' : 'outline'}
                size="sm"
                onClick={() => setSelectedWeek(week)}
              >
                {week}
              </Button>
            ))}
          </div>
        </div>

        {/* Games List */}
        <div className="space-y-4">
          {mockGames
            .sort((a, b) => new Date(a.gameDate).getTime() - new Date(b.gameDate).getTime())
            .map((game) => {
              const homeWin = game.homeScore > game.awayScore;
              const awayWin = game.awayScore > game.homeScore;
              const scoreDiff = Math.abs(game.homeScore - game.awayScore);
              const isBlowout = scoreDiff >= 20;
              const isShutout = game.homeScore === 0 || game.awayScore === 0;
              
              const homeLockStatus = isTeamLocked(game.homeTeam);
              const awayLockStatus = isTeamLocked(game.awayTeam);
              
              return (
                <div key={game.id} className="bg-card rounded-lg p-4 space-y-3">
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
                        <div className="relative">
                          <img 
                            src={`/images/nfl/team_logos/${game.awayTeam}.png`}
                            alt={game.awayTeam}
                            className="w-8 h-8"
                            onError={(e) => {
                              (e.target as HTMLImageElement).src = `https://www.fantasynerds.com/images/nfl/team_logos/${game.awayTeam}.png`;
                            }}
                          />
                          {game.awayOwner && (
                            <div className="absolute -bottom-1 -right-1">
                              <Avatar className="w-4 h-4 border border-background">
                                <AvatarFallback className={`text-xs ${isUserTeam(game.awayTeam) ? 'text-green-600 bg-green-100 dark:bg-green-900/20' : 'bg-muted'}`}>
                                  {game.awayOwner}
                                </AvatarFallback>
                              </Avatar>
                            </div>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={`font-medium ${isUserTeam(game.awayTeam) ? 'text-green-600' : ''} ${awayWin ? 'text-foreground' : 'text-muted-foreground'}`}>
                            {game.awayTeam}
                          </span>
                          {awayLockStatus.locked && (
                            <Lock className="w-3 h-3 text-blue-500" />
                          )}
                          {awayLockStatus.lockAndLoad && (
                            <Sparkles className="w-3 h-3 text-purple-500" />
                          )}
                        </div>
                      </div>
                      <div className={`text-xl font-bold ${awayWin ? 'text-foreground' : 'text-muted-foreground'}`}>
                        {game.awayScore}
                      </div>
                    </div>

                    {/* Home Team */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3 flex-1">
                        <div className="relative">
                          <img 
                            src={`/images/nfl/team_logos/${game.homeTeam}.png`}
                            alt={game.homeTeam}
                            className="w-8 h-8"
                            onError={(e) => {
                              (e.target as HTMLImageElement).src = `https://www.fantasynerds.com/images/nfl/team_logos/${game.homeTeam}.png`;
                            }}
                          />
                          {game.homeOwner && (
                            <div className="absolute -bottom-1 -right-1">
                              <Avatar className="w-4 h-4 border border-background">
                                <AvatarFallback className={`text-xs ${isUserTeam(game.homeTeam) ? 'text-green-600 bg-green-100 dark:bg-green-900/20' : 'bg-muted'}`}>
                                  {game.homeOwner}
                                </AvatarFallback>
                              </Avatar>
                            </div>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={`font-medium ${isUserTeam(game.homeTeam) ? 'text-green-600' : ''} ${homeWin ? 'text-foreground' : 'text-muted-foreground'}`}>
                            {game.homeTeam}
                          </span>
                          {homeLockStatus.locked && (
                            <Lock className="w-3 h-3 text-blue-500" />
                          )}
                          {homeLockStatus.lockAndLoad && (
                            <Sparkles className="w-3 h-3 text-purple-500" />
                          )}
                        </div>
                      </div>
                      <div className={`text-xl font-bold ${homeWin ? 'text-foreground' : 'text-muted-foreground'}`}>
                        {game.homeScore}
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

        {/* Game Details Modal */}
        <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            {selectedGame && (
              <>
                <DialogHeader>
                  <DialogTitle className="flex items-center justify-between">
                    <span>Game Details</span>
                    <Badge variant="outline" className="text-xs">
                      {new Date(selectedGame.game.gameDate).toLocaleDateString('en-US', { 
                        weekday: 'short', 
                        month: 'short', 
                        day: 'numeric' 
                      })}
                    </Badge>
                  </DialogTitle>
                </DialogHeader>

                <div className="space-y-6">
                  {/* Game Score Header */}
                  <div className="text-center space-y-2">
                    <div className="flex items-center justify-center gap-6">
                      <div className="flex items-center gap-3">
                        <img 
                          src={`/images/nfl/team_logos/${selectedGame.game.awayTeam}.png`}
                          alt={selectedGame.game.awayTeam}
                          className="w-12 h-12"
                          onError={(e) => {
                            (e.target as HTMLImageElement).src = `https://www.fantasynerds.com/images/nfl/team_logos/${selectedGame.game.awayTeam}.png`;
                          }}
                        />
                        <div className="text-center">
                          <div className="font-bold text-lg">{selectedGame.game.awayTeam}</div>
                          <div className="text-2xl font-bold">{selectedGame.game.awayScore}</div>
                        </div>
                      </div>
                      
                      <div className="text-muted-foreground font-medium">@</div>
                      
                      <div className="flex items-center gap-3">
                        <div className="text-center">
                          <div className="font-bold text-lg">{selectedGame.game.homeTeam}</div>
                          <div className="text-2xl font-bold">{selectedGame.game.homeScore}</div>
                        </div>
                        <img 
                          src={`/images/nfl/team_logos/${selectedGame.game.homeTeam}.png`}
                          alt={selectedGame.game.homeTeam}
                          className="w-12 h-12"
                          onError={(e) => {
                            (e.target as HTMLImageElement).src = `https://www.fantasynerds.com/images/nfl/team_logos/${selectedGame.game.homeTeam}.png`;
                          }}
                        />
                      </div>
                    </div>
                    {selectedGame.game.isCompleted && (
                      <Badge variant="outline">Final</Badge>
                    )}
                  </div>

                  {/* Points Breakdown */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Away Team Points */}
                    {selectedGame.game.awayOwner && (
                      <Card>
                        <CardHeader className="pb-3">
                          <CardTitle className="text-sm flex items-center gap-2">
                            <Avatar className="w-6 h-6">
                              <AvatarFallback className="text-xs">
                                {selectedGame.game.awayOwner}
                              </AvatarFallback>
                            </Avatar>
                            <span>{selectedGame.game.awayTeam} Mok Points</span>
                            <div className="ml-auto flex items-center gap-1">
                              <Flame className="w-4 h-4 text-orange-500" />
                              <span className="font-bold text-orange-600">{selectedGame.awayPoints}</span>
                            </div>
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="pt-0 space-y-2">
                          {selectedGame.awayPointsBreakdown.details.map((detail, index) => (
                            <div key={index} className="text-sm flex justify-between">
                              <span>{detail.split(':')[0]}</span>
                              <span className="font-medium">{detail.split(':')[1]}</span>
                            </div>
                          ))}
                          {selectedGame.awayPointsBreakdown.details.length > 1 && (
                            <div className="border-t pt-2 font-bold flex justify-between">
                              <span>Total</span>
                              <span>{selectedGame.awayPoints} points</span>
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    )}

                    {/* Home Team Points */}
                    {selectedGame.game.homeOwner && (
                      <Card>
                        <CardHeader className="pb-3">
                          <CardTitle className="text-sm flex items-center gap-2">
                            <Avatar className="w-6 h-6">
                              <AvatarFallback className="text-xs">
                                {selectedGame.game.homeOwner}
                              </AvatarFallback>
                            </Avatar>
                            <span>{selectedGame.game.homeTeam} Mok Points</span>
                            <div className="ml-auto flex items-center gap-1">
                              <Flame className="w-4 h-4 text-orange-500" />
                              <span className="font-bold text-orange-600">{selectedGame.homePoints}</span>
                            </div>
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="pt-0 space-y-2">
                          {selectedGame.homePointsBreakdown.details.map((detail, index) => (
                            <div key={index} className="text-sm flex justify-between">
                              <span>{detail.split(':')[0]}</span>
                              <span className="font-medium">{detail.split(':')[1]}</span>
                            </div>
                          ))}
                          {selectedGame.homePointsBreakdown.details.length > 1 && (
                            <div className="border-t pt-2 font-bold flex justify-between">
                              <span>Total</span>
                              <span>{selectedGame.homePoints} points</span>
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    )}

                    {/* No owned teams message */}
                    {!selectedGame.game.homeOwner && !selectedGame.game.awayOwner && (
                      <div className="col-span-full text-center text-muted-foreground py-8">
                        <Users className="w-12 h-12 mx-auto mb-2 opacity-50" />
                        <p>No league members own teams in this game</p>
                      </div>
                    )}
                  </div>

                  {/* Game Bonuses Summary */}
                  {selectedGame.game.isCompleted && (
                    <div className="space-y-3">
                      <h4 className="font-semibold">Game Bonuses Available</h4>
                      <div className="flex flex-wrap gap-2">
                        {Math.abs(selectedGame.game.homeScore - selectedGame.game.awayScore) >= 20 && (
                          <Badge variant="secondary" className="text-xs">
                            <Trophy className="w-3 h-3 mr-1" />
                            Blowout (+1)
                          </Badge>
                        )}
                        {(selectedGame.game.homeScore === 0 || selectedGame.game.awayScore === 0) && (
                          <Badge variant="secondary" className="text-xs">
                            <Target className="w-3 h-3 mr-1" />
                            Shutout (+1)
                          </Badge>
                        )}
                        {(selectedGame.game.homeScore === 31 || selectedGame.game.awayScore === 31) && (
                          <Badge variant="secondary" className="text-xs">
                            <Zap className="w-3 h-3 mr-1" />
                            Weekly High (+1)
                          </Badge>
                        )}
                        {(selectedGame.game.homeScore === 9 || selectedGame.game.awayScore === 9) && (
                          <Badge variant="destructive" className="text-xs">
                            <Target className="w-3 h-3 mr-1" />
                            Weekly Low (-1)
                          </Badge>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}