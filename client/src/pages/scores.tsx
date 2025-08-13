import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Trophy, Target, Lock, Zap, Flame } from "lucide-react";
import { useState, useEffect, useCallback } from "react";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { BottomNav } from "@/components/layout/bottom-nav";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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

interface HighLowScoreTeam {
  teamId: string;
  teamCode: string;
  teamName: string;
  score: number;
}

interface WeekEndResults {
  weekComplete: boolean;
  highScoreTeams?: HighLowScoreTeam[];
  lowScoreTeams?: HighLowScoreTeam[];
  weeklySkinsWinner?: {
    userId: string;
    userName: string;
    totalWeeklyPoints: number;
    prizeAmount: number;
    isTied: boolean;
  };
  skinsRollover?: {
    reason: string;
    nextWeekPrize: number;
  };
}

export default function ScoresPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [selectedWeek, setSelectedWeek] = useState(21);

  // Add NFL games data query
  const { data: nflGames } = useQuery({
    queryKey: [`/api/scores/week/${selectedWeek}`],
    enabled: !!user,
  });
  const [selectedGame, setSelectedGame] = useState<any>(null);
  const [isGameDialogOpen, setIsGameDialogOpen] = useState(false);

  const { data: weeklyScores, isLoading: scoresLoading } = useQuery({
    queryKey: [`/api/scores/weekly/${selectedWeek}`],
    enabled: !!user,
  });

  const { data: mokRules } = useQuery({
    queryKey: ["/api/scores/mok-rules"],
    enabled: !!user,
  });

  const { data: weekEndResults } = useQuery({
    queryKey: [`/api/scores/week-end-results/${selectedWeek}`],
    enabled: !!user,
  });

  const currentUserScore = (weeklyScores as WeeklyScoresResponse)?.scores?.find(
    (score) => score.userId === user?.id
  );

  return (
    <div className="min-h-screen bg-background">
      {/* Header with Week Selector */}
      <div className="sticky top-0 z-40 bg-background/80 backdrop-blur-sm border-b border-border/50">
        <div className="flex items-center justify-between p-4">
          <h1 className="text-2xl font-bold">Scores</h1>
          <select
            value={selectedWeek}
            onChange={(e) => setSelectedWeek(Number(e.target.value))}
            className="px-3 py-2 bg-card border border-border rounded-lg text-sm"
          >
            {Array.from({ length: 22 }, (_, i) => i + 1).map((week) => (
              <option key={week} value={week}>
                {getWeekLabel(week)}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="p-4 space-y-6">
        {/* Current User Summary */}
        {currentUserScore && (
          <Card className="p-4 bg-gradient-to-r from-primary/10 to-secondary/10 border-primary/20">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-lg">Your Week {selectedWeek} Score</h3>
                <p className="text-3xl font-bold text-primary mt-1">
                  {currentUserScore.totalMokPoints.toFixed(1)}
                </p>
              </div>
              <div className="text-right">
                <p className="text-sm text-muted-foreground">Base Points</p>
                <p className="text-xl font-semibold">{currentUserScore.totalBaseMokPoints.toFixed(1)}</p>
                {(currentUserScore.lockBonusPoints > 0 || currentUserScore.lockAndLoadBonusPoints > 0) && (
                  <p className="text-sm text-green-600">
                    +{(currentUserScore.lockBonusPoints + currentUserScore.lockAndLoadBonusPoints).toFixed(1)} bonus
                  </p>
                )}
              </div>
            </div>
          </Card>
        )}

        {/* Week End Results */}
        {weekEndResults && (weekEndResults as WeekEndResults).weekComplete ? (
          <Card className="p-4">
            <CardHeader className="p-0 pb-4">
              <CardTitle className="text-lg">Week {selectedWeek} Results</CardTitle>
            </CardHeader>
            <CardContent className="p-0 space-y-4">
              {/* Weekly Skins Winner */}
              {(weekEndResults as WeekEndResults).weeklySkinsWinner && (
                <div className="p-3 bg-gradient-to-r from-yellow-500/10 to-yellow-600/10 border border-yellow-500/20 rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <Trophy className="w-5 h-5 text-yellow-600" />
                    <span className="font-semibold text-yellow-700">Weekly Skins Winner</span>
                  </div>
                  <p className="text-lg font-bold">
                    {(weekEndResults as WeekEndResults).weeklySkinsWinner?.userName}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {(weekEndResults as WeekEndResults).weeklySkinsWinner?.totalWeeklyPoints.toFixed(1)} points • 
                    ${(weekEndResults as WeekEndResults).weeklySkinsWinner?.prizeAmount}
                  </p>
                </div>
              )}

              {/* Skins Rollover */}
              {(weekEndResults as WeekEndResults).skinsRollover && (
                <div className="p-3 bg-gradient-to-r from-orange-500/10 to-orange-600/10 border border-orange-500/20 rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <Zap className="w-5 h-5 text-orange-600" />
                    <span className="font-semibold text-orange-700">Skins Rollover</span>
                  </div>
                  <p className="text-sm">
                    {(weekEndResults as WeekEndResults).skinsRollover?.reason}
                  </p>
                  <p className="text-lg font-bold text-orange-700">
                    Next week: ${(weekEndResults as WeekEndResults).skinsRollover?.nextWeekPrize}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        ) : null}

        {/* Weekly Scores */}
        <Card className="p-4">
          <CardHeader className="p-0 pb-4">
            <CardTitle className="text-lg">Week {selectedWeek} Scores</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {scoresLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 6 }, (_, i) => (
                  <div key={i} className="flex items-center space-x-3 p-3 bg-muted/20 rounded-lg animate-pulse">
                    <div className="w-8 h-8 bg-muted rounded-full"></div>
                    <div className="flex-1">
                      <div className="w-24 h-4 bg-muted rounded"></div>
                      <div className="w-16 h-3 bg-muted rounded mt-1"></div>
                    </div>
                    <div className="w-12 h-6 bg-muted rounded"></div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="space-y-2">
                {(weeklyScores as WeeklyScoresResponse)?.scores
                  ?.sort((a, b) => b.totalMokPoints - a.totalMokPoints)
                  ?.map((score, index) => (
                    <div key={score.userId} className="flex items-center justify-between p-3 bg-card border border-border rounded-lg hover:bg-muted/50 transition-colors">
                      <div className="flex items-center space-x-3">
                        <div className="w-8 h-8 bg-gradient-to-br from-primary/20 to-secondary/20 rounded-full flex items-center justify-center">
                          <span className="text-sm font-bold">#{index + 1}</span>
                        </div>
                        <div>
                          <p className="font-semibold">User {score.userId.slice(0, 8)}</p>
                          <div className="flex gap-2 text-xs">
                            {score.lockedTeam && (
                              <Badge variant="outline" className="text-xs">
                                <Lock className="w-3 h-3 mr-1" />
                                {score.lockedTeam}
                              </Badge>
                            )}
                            {score.lockAndLoadTeam && (
                              <Badge variant="outline" className="text-xs">
                                <Zap className="w-3 h-3 mr-1" />
                                {score.lockAndLoadTeam}
                              </Badge>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-lg font-bold">{score.totalMokPoints.toFixed(1)}</p>
                        <p className="text-xs text-muted-foreground">
                          {score.totalBaseMokPoints.toFixed(1)} base
                          {(score.lockBonusPoints > 0 || score.lockAndLoadBonusPoints > 0) && (
                            <span className="text-green-600 ml-1">
                              +{(score.lockBonusPoints + score.lockAndLoadBonusPoints).toFixed(1)}
                            </span>
                          )}
                        </p>
                      </div>
                    </div>
                  ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* NFL Games Results */}
        {nflGames && (nflGames as any)?.games?.length > 0 && (
          <Card className="p-4">
            <CardHeader className="p-0 pb-4">
              <CardTitle className="text-lg">Week {selectedWeek} NFL Games</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="grid gap-3">
                {(nflGames as any).games.map((game: any, index: number) => (
                  <div key={game.id} className="p-3 bg-card border border-border rounded-lg hover:bg-muted/50 transition-colors cursor-pointer"
                       onClick={() => {
                         setSelectedGame(game);
                         setIsGameDialogOpen(true);
                       }}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <div className="w-8 h-8 bg-gradient-to-br from-primary/20 to-secondary/20 rounded-lg flex items-center justify-center">
                          <span className="text-xs font-bold">
                            {game.awayTeam}
                          </span>
                        </div>
                        <div>
                          <p className="font-semibold text-sm">{game.awayTeam} @ {game.homeTeam}</p>
                          <p className="text-xs text-muted-foreground">
                            {new Date(game.gameDate).toLocaleDateString()} • {game.isCompleted ? 'Final' : 'Scheduled'}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        {game.isCompleted ? (
                          <div className="flex items-center gap-2">
                            <span className="text-lg font-bold">
                              {game.awayScore} - {game.homeScore}
                            </span>
                            {game.homeScore > game.awayScore ? 
                              <Trophy className="w-4 h-4 text-green-600" /> : 
                              game.awayScore > game.homeScore ? 
                              <Trophy className="w-4 h-4 text-blue-600" /> : 
                              <Target className="w-4 h-4 text-yellow-600" />
                            }
                          </div>
                        ) : (
                          <div className="text-sm text-muted-foreground">
                            {new Date(game.gameDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Team Results */}
        {currentUserScore?.teamResults && (
          <Card className="p-4">
            <CardHeader className="p-0 pb-4">
              <CardTitle className="text-lg">Your Team Results</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="grid gap-3">
                {currentUserScore.teamResults.map((result: any, index: number) => (
                  <div key={index} className="p-3 bg-card border border-border rounded-lg hover:bg-muted/50 transition-colors cursor-pointer"
                       onClick={() => {
                         setSelectedGame(result);
                         setIsGameDialogOpen(true);
                       }}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <div className="w-8 h-8 bg-gradient-to-br from-primary/20 to-secondary/20 rounded-lg flex items-center justify-center">
                          <span className="text-xs font-bold">{result.teamCode}</span>
                        </div>
                        <div>
                          <p className="font-semibold text-sm">{result.teamName}</p>
                          <p className="text-xs text-muted-foreground">
                            vs {result.opponentCode} • {result.homeAway === 'home' ? 'Home' : 'Away'}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="flex items-center gap-2">
                          <span className="text-lg font-bold">
                            {result.mokPoints?.toFixed(1) || '0.0'}
                          </span>
                          {result.gameResult === 'W' && <Trophy className="w-4 h-4 text-green-600" />}
                          {result.gameResult === 'T' && <Target className="w-4 h-4 text-yellow-600" />}
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {result.teamScore}-{result.opponentScore} • {result.gameResult}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Game Detail Dialog */}
      <Dialog open={isGameDialogOpen} onOpenChange={setIsGameDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Game Details</DialogTitle>
          </DialogHeader>
          {selectedGame && (
            <div className="space-y-4">
              <div className="text-center">
                {selectedGame.teamName ? (
                  /* Team Result View */
                  <>
                    <h3 className="text-xl font-bold">{selectedGame.teamName}</h3>
                    <p className="text-sm text-muted-foreground">vs {selectedGame.opponentName}</p>
                    <p className="text-2xl font-bold mt-2">
                      {selectedGame.teamScore} - {selectedGame.opponentScore}
                    </p>
                    <Badge variant={selectedGame.gameResult === 'W' ? 'default' : selectedGame.gameResult === 'T' ? 'secondary' : 'destructive'} className="mt-2">
                      {selectedGame.gameResult === 'W' ? 'Win' : selectedGame.gameResult === 'T' ? 'Tie' : 'Loss'}
                    </Badge>
                  </>
                ) : (
                  /* NFL Game View */
                  <>
                    <h3 className="text-xl font-bold">{selectedGame.awayTeam} @ {selectedGame.homeTeam}</h3>
                    <p className="text-sm text-muted-foreground">
                      {new Date(selectedGame.gameDate).toLocaleDateString()} • Week {selectedGame.week}
                    </p>
                    {selectedGame.isCompleted ? (
                      <>
                        <p className="text-2xl font-bold mt-2">
                          {selectedGame.awayScore} - {selectedGame.homeScore}
                        </p>
                        <Badge variant="default" className="mt-2">Final</Badge>
                      </>
                    ) : (
                      <Badge variant="secondary" className="mt-2">Scheduled</Badge>
                    )}
                  </>
                )}
              </div>

              {selectedGame.mokPoints && (
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Mok Points:</span>
                    <span className="font-semibold">{selectedGame.mokPoints?.toFixed(1) || '0.0'}</span>
                  </div>
                  
                  {(() => {
                    const isBlowout = Math.abs(selectedGame.teamScore - selectedGame.opponentScore) >= 21;
                    const isShutout = selectedGame.teamScore === 0 || selectedGame.opponentScore === 0;
                    
                    if (isBlowout || isShutout) {
                      return (
                        <div className="pt-2 border-t border-border/50">
                          <div className="text-xs font-medium text-muted-foreground mb-1">
                            Game Bonuses:
                          </div>
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
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      <BottomNav />
    </div>
  );
}