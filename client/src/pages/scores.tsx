import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Trophy, Target, Zap, Info, Users, Lock, Sparkles } from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

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

export default function ScoresPage() {
  const { user } = useAuth();
  const [selectedWeek, setSelectedWeek] = useState(1);
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
              const tie = game.homeScore === game.awayScore;
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
                          Blowout (+1)
                        </Badge>
                      )}
                      {isShutout && (
                        <Badge variant="secondary" className="text-xs">
                          <Target className="w-3 h-3 mr-1" />
                          Shutout (+1)
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
  );
}