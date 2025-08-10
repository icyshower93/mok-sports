import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Trophy, Target, Zap, Info, Users } from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";

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

export default function ScoresPage() {
  const { user } = useAuth();
  const [selectedWeek, setSelectedWeek] = useState(1);
  const [selectedSeason] = useState(2025);
  const [viewMode, setViewMode] = useState<'weekly' | 'season' | 'rules'>('weekly');

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

  // Get weekly scores for current league
  const { data: weeklyScores, isLoading: loadingWeekly } = useQuery<WeeklyScoresResponse>({
    queryKey: [`/api/leagues/${currentLeague?.id}/scores/${selectedSeason}/${selectedWeek}`],
    enabled: !!currentLeague
  });

  // Get season standings
  const { data: seasonStandings, isLoading: loadingStandings } = useQuery({
    queryKey: [`/api/leagues/${currentLeague?.id}/standings/${selectedSeason}`, { currentWeek: selectedWeek }],
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

  return (
    <div className="container mx-auto px-4 py-6 max-w-6xl">
      <div className="flex flex-col space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold">Scores</h1>
            <p className="text-muted-foreground">{currentLeague.name} • {selectedSeason} Season</p>
          </div>
          
          {/* View Mode Selector */}
          <div className="flex gap-2">
            <Button
              variant={viewMode === 'weekly' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setViewMode('weekly')}
            >
              <Target className="w-4 h-4 mr-2" />
              Weekly
            </Button>
            <Button
              variant={viewMode === 'season' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setViewMode('season')}
            >
              <Trophy className="w-4 h-4 mr-2" />
              Season
            </Button>
            <Button
              variant={viewMode === 'rules' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setViewMode('rules')}
            >
              <Info className="w-4 h-4 mr-2" />
              Rules
            </Button>
          </div>
        </div>

        {viewMode === 'rules' && scoringRules && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Base Scoring */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Target className="w-5 h-5" />
                  Base Scoring
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex justify-between">
                  <span>Win</span>
                  <Badge variant="secondary">+{scoringRules.winPoints}</Badge>
                </div>
                <div className="flex justify-between">
                  <span>Tie</span>
                  <Badge variant="secondary">+{scoringRules.tiePoints}</Badge>
                </div>
                <div className="flex justify-between">
                  <span>Loss</span>
                  <Badge variant="outline">{scoringRules.lossPoints}</Badge>
                </div>
                <hr className="my-3" />
                <div className="flex justify-between">
                  <span>Blowout (14+ pts)</span>
                  <Badge variant="secondary">+{scoringRules.blowoutPoints}</Badge>
                </div>
                <div className="flex justify-between">
                  <span>Shutout</span>
                  <Badge variant="secondary">+{scoringRules.shutoutPoints}</Badge>
                </div>
                <div className="flex justify-between">
                  <span>Weekly High</span>
                  <Badge variant="secondary">+{scoringRules.weeklyHighPoints}</Badge>
                </div>
                <div className="flex justify-between">
                  <span>Weekly Low</span>
                  <Badge variant="destructive">{scoringRules.weeklyLowPenalty}</Badge>
                </div>
              </CardContent>
            </Card>

            {/* Lock System */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Zap className="w-5 h-5" />
                  Lock System
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex justify-between">
                  <span>Regular Lock</span>
                  <Badge variant="secondary">+{scoringRules.lockBonusPoints}</Badge>
                </div>
                <div className="text-sm text-muted-foreground">
                  Max {scoringRules.maxLocksPerTeamPerSeason} times per team
                </div>
                <hr className="my-3" />
                <div className="flex justify-between">
                  <span>Lock & Load Win</span>
                  <Badge variant="secondary">+{scoringRules.lockAndLoadWinPoints}</Badge>
                </div>
                <div className="flex justify-between">
                  <span>Lock & Load Loss</span>
                  <Badge variant="destructive">{scoringRules.lockAndLoadLossPenalty}</Badge>
                </div>
                <div className="text-sm text-muted-foreground">
                  Once per team per season
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {viewMode === 'weekly' && (
          <>
            {/* Week Selector */}
            <div className="flex gap-2 flex-wrap">
              {Array.from({length: 18}, (_, i) => i + 1).map(week => (
                <Button
                  key={week}
                  variant={selectedWeek === week ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setSelectedWeek(week)}
                >
                  Week {week}
                </Button>
              ))}
            </div>

            {/* Weekly Scores */}
            {loadingWeekly ? (
              <Card>
                <CardContent className="p-6">
                  <p>Loading weekly scores...</p>
                </CardContent>
              </Card>
            ) : weeklyScores ? (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Users className="w-5 h-5" />
                    Week {selectedWeek} Scores
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {weeklyScores.scores
                      .sort((a, b) => b.totalMokPoints - a.totalMokPoints)
                      .map((score, index) => (
                      <div key={score.userId} className="flex items-center justify-between p-4 border rounded-lg">
                        <div className="flex items-center gap-3">
                          <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-sm font-medium">
                            {index + 1}
                          </div>
                          <div>
                            <p className="font-medium">User {score.userId.slice(0, 8)}</p>
                            <p className="text-sm text-muted-foreground">
                              {score.teamResults.length} teams played
                            </p>
                          </div>
                        </div>
                        
                        <div className="text-right">
                          <p className="text-lg font-bold">{score.totalMokPoints} pts</p>
                          <div className="text-sm text-muted-foreground">
                            Base: {score.totalBaseMokPoints}
                            {score.lockBonusPoints > 0 && (
                              <span className="ml-1">Lock: +{score.lockBonusPoints}</span>
                            )}
                            {score.lockAndLoadBonusPoints !== 0 && (
                              <span className="ml-1">L&L: {score.lockAndLoadBonusPoints > 0 ? '+' : ''}{score.lockAndLoadBonusPoints}</span>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                    
                    {weeklyScores.scores.length === 0 && (
                      <p className="text-center text-muted-foreground py-8">
                        No scores available for Week {selectedWeek}
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>
            ) : null}
          </>
        )}

        {viewMode === 'season' && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Trophy className="w-5 h-5" />
                Season Standings
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loadingStandings ? (
                <p>Loading season standings...</p>
              ) : seasonStandings ? (
                <div className="space-y-4">
                  {seasonStandings.standings.length === 0 ? (
                    <p className="text-center text-muted-foreground py-8">
                      Season standings will appear here once games begin
                    </p>
                  ) : (
                    seasonStandings.standings.map((standing: any, index: number) => (
                      <div key={standing.userId} className="flex items-center justify-between p-4 border rounded-lg">
                        <div className="flex items-center gap-3">
                          <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-sm font-medium">
                            {index + 1}
                          </div>
                          <div>
                            <p className="font-medium">{standing.userName}</p>
                            <p className="text-sm text-muted-foreground">
                              {standing.gamesPlayed} games played
                            </p>
                          </div>
                        </div>
                        
                        <div className="text-right">
                          <p className="text-lg font-bold">{standing.totalPoints} pts</p>
                          <p className="text-sm text-muted-foreground">
                            Avg: {standing.averagePerWeek.toFixed(1)}
                          </p>
                        </div>
                      </div>
                    ))
                  )}
                  
                  {/* Prize Leaders */}
                  {seasonStandings.prizes && (
                    <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
                      <Card>
                        <CardContent className="p-4 text-center">
                          <Trophy className="w-6 h-6 mx-auto mb-2 text-yellow-600" />
                          <p className="text-sm font-medium">Most Points</p>
                          <p className="text-xs text-muted-foreground">
                            {seasonStandings.prizes.mostPoints.points || 0} pts
                          </p>
                        </CardContent>
                      </Card>
                      
                      <Card>
                        <CardContent className="p-4 text-center">
                          <Target className="w-6 h-6 mx-auto mb-2 text-blue-600" />
                          <p className="text-sm font-medium">Most Locks</p>
                          <p className="text-xs text-muted-foreground">
                            {seasonStandings.prizes.mostCorrectLocks.locks || 0} correct
                          </p>
                        </CardContent>
                      </Card>
                      
                      <Card>
                        <CardContent className="p-4 text-center">
                          <Trophy className="w-6 h-6 mx-auto mb-2 text-green-600" />
                          <p className="text-sm font-medium">Super Bowl</p>
                          <p className="text-xs text-muted-foreground">TBD</p>
                        </CardContent>
                      </Card>
                    </div>
                  )}
                </div>
              ) : null}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}