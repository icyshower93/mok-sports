import { BottomNav } from "@/components/layout/bottom-nav";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TeamLogo } from "@/components/team-logo";
import { 
  Trophy, 
  Clock, 
  Play,
  Star,
  Lock,
  Zap,
  Calendar,
  TrendingUp,
  Target,
  CheckCircle
} from "lucide-react";
import { useState } from "react";

export default function ScoresPage() {
  const [selectedWeek, setSelectedWeek] = useState(4);
  const [selectedTab, setSelectedTab] = useState("live");

  // User's teams (would come from API in real app)
  const userTeams = ["KC", "SF", "BUF", "PHI", "LAR"];

  // Mock game data for Week 4
  const games = [
    // Thursday Night Football
    {
      id: 1,
      status: "final",
      week: 4,
      gameTime: "Thursday 8:20 PM ET",
      homeTeam: { code: "KC", name: "Kansas City Chiefs", score: 31, logoUrl: "/images/nfl/team_logos/KC.png" },
      awayTeam: { code: "DEN", name: "Denver Broncos", score: 17, logoUrl: "/images/nfl/team_logos/DEN.png" },
      quarter: "F",
      timeRemaining: "",
      isBlowout: true,
      hasUserTeam: true,
      userTeamCodes: ["KC"],
      lockInfo: { locked: true, lockedBy: "You", lockAndLoad: false }
    },
    // Sunday Early Games
    {
      id: 2,
      status: "live",
      week: 4,
      gameTime: "Sunday 1:00 PM ET",
      homeTeam: { code: "BUF", name: "Buffalo Bills", score: 21, logoUrl: "/images/nfl/team_logos/BUF.png" },
      awayTeam: { code: "MIA", name: "Miami Dolphins", score: 14, logoUrl: "/images/nfl/team_logos/MIA.png" },
      quarter: "3rd",
      timeRemaining: "8:42",
      isBlowout: false,
      hasUserTeam: true,
      userTeamCodes: ["BUF"],
      lockInfo: null
    },
    {
      id: 3,
      status: "live",
      week: 4,
      gameTime: "Sunday 1:00 PM ET",
      homeTeam: { code: "PHI", name: "Philadelphia Eagles", score: 24, logoUrl: "/images/nfl/team_logos/PHI.png" },
      awayTeam: { code: "WSH", name: "Washington Commanders", score: 20, logoUrl: "/images/nfl/team_logos/WAS.png" },
      quarter: "4th",
      timeRemaining: "3:15",
      isBlowout: false,
      hasUserTeam: true,
      userTeamCodes: ["PHI"],
      lockInfo: { locked: true, lockedBy: "Mike Chen", lockAndLoad: false }
    },
    {
      id: 4,
      status: "live",
      week: 4,
      gameTime: "Sunday 1:00 PM ET",
      homeTeam: { code: "CLE", name: "Cleveland Browns", score: 10, logoUrl: "/images/nfl/team_logos/CLE.png" },
      awayTeam: { code: "BAL", name: "Baltimore Ravens", score: 28, logoUrl: "/images/nfl/team_logos/BAL.png" },
      quarter: "4th",
      timeRemaining: "12:05",
      isBlowout: true,
      hasUserTeam: false,
      userTeamCodes: [],
      lockInfo: { locked: true, lockedBy: "Sarah Wilson", lockAndLoad: true }
    },
    // Sunday Late Games
    {
      id: 5,
      status: "upcoming",
      week: 4,
      gameTime: "Sunday 4:25 PM ET",
      homeTeam: { code: "LAR", name: "Los Angeles Rams", score: null, logoUrl: "/images/nfl/team_logos/LAR.png" },
      awayTeam: { code: "SF", name: "San Francisco 49ers", score: null, logoUrl: "/images/nfl/team_logos/SF.png" },
      quarter: "",
      timeRemaining: "",
      isBlowout: false,
      hasUserTeam: true,
      userTeamCodes: ["LAR", "SF"],
      lockInfo: { locked: true, lockedBy: "You", lockAndLoad: true }
    },
    {
      id: 6,
      status: "upcoming",
      week: 4,
      gameTime: "Sunday 4:25 PM ET",
      homeTeam: { code: "SEA", name: "Seattle Seahawks", score: null, logoUrl: "/images/nfl/team_logos/SEA.png" },
      awayTeam: { code: "NYG", name: "New York Giants", score: null, logoUrl: "/images/nfl/team_logos/NYG.png" },
      quarter: "",
      timeRemaining: "",
      isBlowout: false,
      hasUserTeam: false,
      userTeamCodes: [],
      lockInfo: null
    },
    // Sunday Night Football
    {
      id: 7,
      status: "upcoming",
      week: 4,
      gameTime: "Sunday 8:20 PM ET",
      homeTeam: { code: "DAL", name: "Dallas Cowboys", score: null, logoUrl: "/images/nfl/team_logos/DAL.png" },
      awayTeam: { code: "NYJ", name: "New York Jets", score: null, logoUrl: "/images/nfl/team_logos/NYJ.png" },
      quarter: "",
      timeRemaining: "",
      isBlowout: false,
      hasUserTeam: false,
      userTeamCodes: [],
      lockInfo: null
    },
    // Monday Night Football
    {
      id: 8,
      status: "upcoming",
      week: 4,
      gameTime: "Monday 8:15 PM ET",
      homeTeam: { code: "TB", name: "Tampa Bay Buccaneers", score: null, logoUrl: "/images/nfl/team_logos/TB.png" },
      awayTeam: { code: "NO", name: "New Orleans Saints", score: null, logoUrl: "/images/nfl/team_logos/NO.png" },
      quarter: "",
      timeRemaining: "",
      isBlowout: false,
      hasUserTeam: false,
      userTeamCodes: [],
      lockInfo: null
    }
  ];

  const weeklyStats = {
    totalGames: 16,
    completedGames: 1,
    liveGames: 3,
    upcomingGames: 4,
    yourTeamsPlaying: 5,
    locksActive: 3
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "live": return "text-green-600 dark:text-green-400";
      case "final": return "text-gray-600 dark:text-gray-400";
      case "upcoming": return "text-blue-600 dark:text-blue-400";
      default: return "text-muted-foreground";
    }
  };

  const getStatusBadge = (status: string, quarter: string, timeRemaining: string) => {
    if (status === "final") {
      return <Badge variant="secondary" className="text-xs">FINAL</Badge>;
    } else if (status === "live") {
      return (
        <Badge className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300 text-xs">
          {quarter} {timeRemaining}
        </Badge>
      );
    } else {
      return <Badge variant="outline" className="text-xs">UPCOMING</Badge>;
    }
  };

  const filteredGames = games.filter(game => {
    if (selectedTab === "my-teams") {
      return game.hasUserTeam;
    }
    if (selectedTab === "live") {
      return game.status === "live" || game.status === "final";
    }
    if (selectedTab === "upcoming") {
      return game.status === "upcoming";
    }
    return true;
  });

  return (
    <div className="min-h-screen bg-background pb-20">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="p-4 border-b border-border/50 bg-card sticky top-0 z-10">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-full">
                <Trophy className="w-5 h-5 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <h1 className="text-xl font-bold">Scores</h1>
                <p className="text-sm text-muted-foreground">Week {selectedWeek} Games</p>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => setSelectedWeek(Math.max(1, selectedWeek - 1))}
                disabled={selectedWeek <= 1}
              >
                ←
              </Button>
              <span className="text-sm font-medium min-w-[60px] text-center">Week {selectedWeek}</span>
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => setSelectedWeek(Math.min(18, selectedWeek + 1))}
                disabled={selectedWeek >= 18}
              >
                →
              </Button>
            </div>
          </div>
        </div>

        {/* Quick Stats */}
        <div className="p-4 bg-muted/30">
          <div className="grid grid-cols-3 gap-4">
            <div className="text-center">
              <div className="text-lg font-bold text-green-600 dark:text-green-400">{weeklyStats.yourTeamsPlaying}</div>
              <div className="text-xs text-muted-foreground">Your Teams Playing</div>
            </div>
            <div className="text-center">
              <div className="text-lg font-bold text-blue-600 dark:text-blue-400">{weeklyStats.locksActive}</div>
              <div className="text-xs text-muted-foreground">Active Locks</div>
            </div>
            <div className="text-center">
              <div className="text-lg font-bold">{weeklyStats.liveGames}</div>
              <div className="text-xs text-muted-foreground">Live Games</div>
            </div>
          </div>
        </div>

        <Tabs value={selectedTab} onValueChange={setSelectedTab} className="w-full">
          <TabsList className="grid w-full grid-cols-4 m-4 mb-0">
            <TabsTrigger value="live" className="text-xs">Live</TabsTrigger>
            <TabsTrigger value="my-teams" className="text-xs">My Teams</TabsTrigger>
            <TabsTrigger value="upcoming" className="text-xs">Upcoming</TabsTrigger>
            <TabsTrigger value="all" className="text-xs">All Games</TabsTrigger>
          </TabsList>
          
          <TabsContent value={selectedTab} className="p-4 space-y-3">
            {filteredGames.map((game) => (
              <Card 
                key={game.id} 
                className={`${game.hasUserTeam ? 'ring-2 ring-primary/20 bg-primary/5' : ''} transition-all hover:shadow-sm`}
              >
                <CardContent className="p-4">
                  {/* Game Header */}
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center space-x-2">
                      <span className="text-xs text-muted-foreground">{game.gameTime}</span>
                      {game.hasUserTeam && (
                        <Star className="w-3 h-3 text-yellow-500" />
                      )}
                    </div>
                    <div className="flex items-center space-x-2">
                      {game.lockInfo && (
                        <div className="flex items-center space-x-1">
                          {game.lockInfo.lockAndLoad ? (
                            <Zap className="w-3 h-3 text-orange-500" />
                          ) : (
                            <Lock className="w-3 h-3 text-blue-500" />
                          )}
                          <span className="text-xs text-muted-foreground">{game.lockInfo.lockedBy}</span>
                        </div>
                      )}
                      {getStatusBadge(game.status, game.quarter, game.timeRemaining)}
                    </div>
                  </div>

                  {/* Teams and Scores */}
                  <div className="space-y-3">
                    {/* Away Team */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <TeamLogo 
                          logoUrl={game.awayTeam.logoUrl}
                          teamCode={game.awayTeam.code}
                          teamName={game.awayTeam.name}
                          size="md"
                          className="w-8 h-8"
                        />
                        <div>
                          <div className={`font-medium text-sm ${userTeams.includes(game.awayTeam.code) ? 'text-primary' : ''}`}>
                            {game.awayTeam.name}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {game.awayTeam.code}
                            {userTeams.includes(game.awayTeam.code) && " • Your Team"}
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        {game.awayTeam.score !== null ? (
                          <div className="text-2xl font-bold">{game.awayTeam.score}</div>
                        ) : (
                          <div className="text-sm text-muted-foreground">-</div>
                        )}
                      </div>
                    </div>

                    {/* Home Team */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <TeamLogo 
                          logoUrl={game.homeTeam.logoUrl}
                          teamCode={game.homeTeam.code}
                          teamName={game.homeTeam.name}
                          size="md"
                          className="w-8 h-8"
                        />
                        <div>
                          <div className={`font-medium text-sm ${userTeams.includes(game.homeTeam.code) ? 'text-primary' : ''}`}>
                            {game.homeTeam.name}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {game.homeTeam.code}
                            {userTeams.includes(game.homeTeam.code) && " • Your Team"}
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        {game.homeTeam.score !== null ? (
                          <div className="text-2xl font-bold">{game.homeTeam.score}</div>
                        ) : (
                          <div className="text-sm text-muted-foreground">-</div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Game Status Indicators */}
                  {game.status === "final" && (
                    <div className="mt-3 pt-3 border-t border-border/50">
                      <div className="flex items-center justify-between text-xs">
                        <div className="flex items-center space-x-4">
                          {game.isBlowout && (
                            <Badge variant="outline" className="text-xs">
                              <Target className="w-3 h-3 mr-1" />
                              Blowout
                            </Badge>
                          )}
                          <span className="text-muted-foreground">Final Score</span>
                        </div>
                        {game.hasUserTeam && (
                          <CheckCircle className="w-4 h-4 text-green-500" />
                        )}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}

            {filteredGames.length === 0 && (
              <Card>
                <CardContent className="p-8 text-center">
                  <Calendar className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                  <h3 className="text-lg font-semibold mb-2">No Games Found</h3>
                  <p className="text-sm text-muted-foreground">
                    {selectedTab === "my-teams" 
                      ? "None of your teams are playing in the selected time period."
                      : "No games match the selected filter."}
                  </p>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </div>
      <BottomNav />
    </div>
  );
}