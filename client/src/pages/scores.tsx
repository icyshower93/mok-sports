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
  const [selectedSeason] = useState(2025);

  // Get user's leagues to show scores for
  const { data: userLeagues } = useQuery({
    queryKey: ['/api/user/leagues'],
    enabled: !!user
  });

  // Get scoring rules
  const { data: scoringRules } = useQuery<MokScoringRules>({
    queryKey: ['/api/scoring/rules']
  });

  // Get current league (first league for now, with fallback for mock data)
  const currentLeague = userLeagues?.[0] || {
    id: 'EEW2YU',
    name: 'Sky\'s League',
    season: 2025
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
      homeOwnerName: 'Sky Evans',
      homeMokPoints: 3,
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
      awayOwnerName: 'John Doe',
      awayMokPoints: 1,
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
      homeOwnerName: 'Mike Kelly',
      awayOwner: 'RJ',
      awayOwnerName: 'Rick James',
      homeMokPoints: 2,
      homeLocked: true
    }
  ];



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
                              {game.awayOwnerName}
                            </span>
                          )}
                          {awayLockStatus.locked && (
                            <Lock className="w-3 h-3 text-blue-500" />
                          )}
                          {awayLockStatus.lockAndLoad && (
                            <Zap className="w-3 h-3 text-orange-500" />
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className={`text-xl font-bold ${awayWin ? 'text-foreground' : 'text-muted-foreground'}`}>
                          {game.awayScore}
                        </div>
                        {game.isCompleted && game.awayMokPoints && game.awayMokPoints > 0 && (
                          <div className="flex items-center space-x-1">
                            <Flame className="w-3 h-3 text-purple-500" />
                            <span className="text-xs text-purple-600 font-medium">+{game.awayMokPoints}</span>
                          </div>
                        )}
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
                              {game.homeOwnerName}
                            </span>
                          )}
                          {homeLockStatus.locked && (
                            <Lock className="w-3 h-3 text-blue-500" />
                          )}
                          {homeLockStatus.lockAndLoad && (
                            <Zap className="w-3 h-3 text-orange-500" />
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className={`text-xl font-bold ${homeWin ? 'text-foreground' : 'text-muted-foreground'}`}>
                          {game.homeScore}
                        </div>
                        {game.isCompleted && game.homeMokPoints && game.homeMokPoints > 0 && (
                          <div className="flex items-center space-x-1">
                            <Flame className="w-3 h-3 text-purple-500" />
                            <span className="text-xs text-purple-600 font-medium">+{game.homeMokPoints}</span>
                          </div>
                        )}
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

      {/* Game Details Modal */}
      <Dialog open={!!selectedGame} onOpenChange={() => setSelectedGame(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Game Details</DialogTitle>
          </DialogHeader>
          {selectedGame && (
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <div className="text-sm text-muted-foreground">
                  {new Date(selectedGame.gameDate).toLocaleDateString('en-US', {
                    weekday: 'long',
                    month: 'long', 
                    day: 'numeric',
                    hour: 'numeric',
                    minute: '2-digit',
                    timeZone: 'America/New_York'
                  })} ET
                </div>
                <Badge variant="outline" className="text-xs">Final</Badge>
              </div>

              <div className="space-y-3">
                {/* Away Team Details */}
                <div className="flex items-center justify-between p-3 bg-muted/20 rounded-lg">
                  <div className="flex items-center gap-3">
                    <img 
                      src={`/images/nfl/team_logos/${selectedGame.awayTeam}.png`}
                      alt={selectedGame.awayTeam}
                      className="w-10 h-10"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = `https://www.fantasynerds.com/images/nfl/team_logos/${selectedGame.awayTeam}.png`;
                      }}
                    />
                    <div>
                      <div className="font-semibold">{selectedGame.awayTeam}</div>
                      {selectedGame.awayOwnerName && (
                        <div className="text-xs text-muted-foreground">{selectedGame.awayOwnerName}</div>
                      )}
                    </div>
                    <div className="flex gap-1 ml-2">
                      {selectedGame.awayLocked && <Lock className="w-4 h-4 text-blue-500" />}
                      {selectedGame.awayLockAndLoad && <Zap className="w-4 h-4 text-orange-500" />}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-2xl font-bold">{selectedGame.awayScore}</div>
                    {selectedGame.awayMokPoints && selectedGame.awayMokPoints > 0 && (
                      <div className="flex items-center gap-1">
                        <Flame className="w-4 h-4 text-purple-500" />
                        <span className="text-purple-600 font-medium">+{selectedGame.awayMokPoints}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Home Team Details */}
                <div className="flex items-center justify-between p-3 bg-muted/20 rounded-lg">
                  <div className="flex items-center gap-3">
                    <img 
                      src={`/images/nfl/team_logos/${selectedGame.homeTeam}.png`}
                      alt={selectedGame.homeTeam}
                      className="w-10 h-10"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = `https://www.fantasynerds.com/images/nfl/team_logos/${selectedGame.homeTeam}.png`;
                      }}
                    />
                    <div>
                      <div className="font-semibold">{selectedGame.homeTeam}</div>
                      {selectedGame.homeOwnerName && (
                        <div className="text-xs text-muted-foreground">{selectedGame.homeOwnerName}</div>
                      )}
                    </div>
                    <div className="flex gap-1 ml-2">
                      {selectedGame.homeLocked && <Lock className="w-4 h-4 text-blue-500" />}
                      {selectedGame.homeLockAndLoad && <Zap className="w-4 h-4 text-orange-500" />}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-2xl font-bold">{selectedGame.homeScore}</div>
                    {selectedGame.homeMokPoints && selectedGame.homeMokPoints > 0 && (
                      <div className="flex items-center gap-1">
                        <Flame className="w-4 h-4 text-purple-500" />
                        <span className="text-purple-600 font-medium">+{selectedGame.homeMokPoints}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Scoring Breakdown */}
              <div className="space-y-2">
                <h4 className="font-medium text-sm">Mok Points Breakdown:</h4>
                <div className="text-xs text-muted-foreground space-y-1">
                  <div>• Win: +1 point</div>
                  <div>• Lock Bonus: +1 point</div>
                  <div>• Blowout (20+ points): +1 point</div>
                  <div>• Lock & Load Win: +2 points, Loss: -1 point</div>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <BottomNav />
    </div>
  );
}