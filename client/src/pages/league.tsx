import { BottomNav } from "@/components/layout/bottom-nav";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";
import { 
  Trophy, 
  DollarSign, 
  Crown, 
  Settings,
  Award,
  Target
} from "lucide-react";

export default function LeaguePage() {
  // Mock league data - in real app this would come from API
  const leagueInfo = {
    name: "The Championship",
    joinCode: "EEW2YU",
    season: "2024",
    week: 4,
    totalWeeks: 18,
    memberCount: 6,
    weeklyPot: 150,
    seasonPot: 500
  };

  const standings = [
    { 
      rank: 1, 
      name: "Sky Evans", 
      avatar: "SE", 
      points: 8.5, 
      wins: 3, 
      locks: 2, 
      lockAndLoads: 1, 
      isCurrentUser: true,
      teams: ["KC", "SF", "BUF", "PHI", "LAR"]
    },
    { 
      rank: 2, 
      name: "Mike Chen", 
      avatar: "MC", 
      points: 7.0, 
      wins: 2, 
      locks: 3, 
      lockAndLoads: 0,
      teams: ["DAL", "MIA", "NYJ", "DEN", "CLE"]
    },
    { 
      rank: 3, 
      name: "Sarah Wilson", 
      avatar: "SW", 
      points: 6.5, 
      wins: 2, 
      locks: 1, 
      lockAndLoads: 1,
      teams: ["BAL", "GB", "MIN", "ATL", "CAR"]
    },
    { 
      rank: 4, 
      name: "Alex Rodriguez", 
      avatar: "AR", 
      points: 5.5, 
      wins: 2, 
      locks: 2, 
      lockAndLoads: 0,
      teams: ["TB", "SEA", "LV", "TEN", "JAX"]
    },
    { 
      rank: 5, 
      name: "Emma Davis", 
      avatar: "ED", 
      points: 4.0, 
      wins: 1, 
      locks: 1, 
      lockAndLoads: 0,
      teams: ["PIT", "CIN", "HOU", "IND", "NO"]
    },
    { 
      rank: 6, 
      name: "Chris Martinez", 
      avatar: "CM", 
      points: 3.5, 
      wins: 1, 
      locks: 0, 
      lockAndLoads: 1,
      teams: ["WAS", "DET", "CHI", "LAC", "NE"]
    }
  ];

  const seasonPrizes = [
    { name: "Most Points", prize: "$200", leader: "Sky Evans", points: "8.5" },
    { name: "Super Bowl Winner", prize: "$150", leader: "TBD", points: "-" },
    { name: "Most Correct Locks", prize: "$150", leader: "Mike Chen", points: "3" }
  ];

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
          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="text-lg">Season Standings</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {standings.map((member) => (
                <div key={member.name} className="flex items-center justify-between py-2">
                  <div className="flex items-center space-x-3">
                    {/* Rank Badge */}
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center text-sm font-semibold ${
                      member.rank === 1 ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300' :
                      member.rank === 2 ? 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300' :
                      member.rank === 3 ? 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300' :
                      'bg-muted text-muted-foreground'
                    }`}>
                      {member.rank}
                    </div>
                    
                    {/* Avatar and Name */}
                    <div className="flex items-center space-x-2.5">
                      <Avatar className="w-8 h-8">
                        <AvatarFallback className="text-xs font-medium">{member.avatar}</AvatarFallback>
                      </Avatar>
                      <div>
                        <div className="flex items-center space-x-2">
                          <span className="font-medium text-sm">{member.name}</span>
                          {member.isCurrentUser && <Badge variant="secondary" className="text-xs">You</Badge>}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {member.wins} wins • {member.locks} locks
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  {/* Points */}
                  <div className="text-right">
                    <span className="text-lg font-bold">{member.points}</span>
                    <span className="text-sm text-muted-foreground ml-1">pts</span>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        {/* Season Prizes */}
        <div className="p-4">
          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="text-lg flex items-center space-x-2">
                <Award className="w-5 h-5" />
                <span>Season Prizes</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {seasonPrizes.map((prize, index) => (
                <div key={index} className="flex items-center justify-between py-2">
                  <div>
                    <div className="font-medium text-sm">{prize.name}</div>
                    <div className="text-xs text-muted-foreground">
                      Leader: {prize.leader}
                    </div>
                  </div>
                  <Badge variant="outline" className="text-sm font-semibold">
                    {prize.prize}
                  </Badge>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
      <BottomNav />
    </div>
  );
}