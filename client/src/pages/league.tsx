import { BottomNav } from "@/components/layout/bottom-nav";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { TeamLogo } from "@/components/team-logo";
import { 
  Trophy, 
  Users, 
  Calendar, 
  DollarSign, 
  Target, 
  Crown, 
  TrendingUp,
  Lock,
  Zap,
  Settings,
  MessageCircle,
  Activity,
  Award
} from "lucide-react";
import { useState } from "react";

export default function LeaguePage() {
  const [selectedTab, setSelectedTab] = useState("standings");

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

  const recentActivity = [
    { 
      type: "lock", 
      user: "Sky Evans", 
      action: "locked Ravens", 
      time: "2h ago", 
      points: "+1",
      icon: Lock,
      color: "blue"
    },
    { 
      type: "trade", 
      user: "Mike Chen", 
      action: "traded for Cardinals", 
      time: "1d ago", 
      points: "",
      icon: TrendingUp,
      color: "green"
    },
    { 
      type: "lockload", 
      user: "Sarah Wilson", 
      action: "Lock & Load on Chiefs", 
      time: "2d ago", 
      points: "+2",
      icon: Zap,
      color: "orange"
    },
    { 
      type: "prize", 
      user: "Alex Rodriguez", 
      action: "won weekly high", 
      time: "1w ago", 
      points: "+1",
      icon: Award,
      color: "yellow"
    }
  ];

  const seasonPrizes = [
    { name: "Most Points", prize: "$200", leader: "Sky Evans", points: "8.5" },
    { name: "Super Bowl Winner", prize: "$150", leader: "TBD", points: "-" },
    { name: "Most Correct Locks", prize: "$150", leader: "Mike Chen", points: "3" }
  ];

  return (
    <div className="min-h-screen bg-background pb-20">
      <div className="max-w-4xl mx-auto">
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

        {/* Season Progress */}
        <div className="p-4 bg-muted/30">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium">Season Progress</span>
            <span className="text-sm text-muted-foreground">
              Week {leagueInfo.week} of {leagueInfo.totalWeeks}
            </span>
          </div>
          <Progress value={(leagueInfo.week / leagueInfo.totalWeeks) * 100} className="h-2" />
        </div>

        <Tabs value={selectedTab} onValueChange={setSelectedTab} className="w-full">
          <TabsList className="grid w-full grid-cols-4 m-4 mb-0">
            <TabsTrigger value="standings" className="text-xs">Standings</TabsTrigger>
            <TabsTrigger value="activity" className="text-xs">Activity</TabsTrigger>
            <TabsTrigger value="prizes" className="text-xs">Prizes</TabsTrigger>
            <TabsTrigger value="rules" className="text-xs">Rules</TabsTrigger>
          </TabsList>
          
          {/* Standings Tab */}
          <TabsContent value="standings" className="p-4 space-y-3">
            {standings.map((member, index) => (
              <Card key={member.name} className={`${member.isCurrentUser ? 'ring-2 ring-primary/20 bg-primary/5' : ''}`}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center space-x-3">
                      <div className="flex items-center space-x-2">
                        <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                          member.rank === 1 ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400' :
                          member.rank === 2 ? 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400' :
                          member.rank === 3 ? 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400' :
                          'bg-muted text-muted-foreground'
                        }`}>
                          {member.rank}
                        </div>
                        {member.rank === 1 && <Crown className="w-4 h-4 text-yellow-500" />}
                      </div>
                      <Avatar className="w-8 h-8">
                        <AvatarFallback className="text-xs">{member.avatar}</AvatarFallback>
                      </Avatar>
                      <div>
                        <div className="font-medium text-sm flex items-center space-x-2">
                          <span>{member.name}</span>
                          {member.isCurrentUser && <Badge variant="secondary" className="text-xs">You</Badge>}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {member.wins} wins • {member.locks} locks • {member.lockAndLoads} L&L
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-lg font-bold">{member.points}</div>
                      <div className="text-xs text-muted-foreground">points</div>
                    </div>
                  </div>
                  
                  {/* Member's Teams Preview */}
                  <div className="flex items-center space-x-1">
                    {member.teams.slice(0, 5).map((teamCode, teamIndex) => (
                      <div key={teamIndex} className="w-6 h-6 bg-muted/50 rounded flex items-center justify-center">
                        <span className="text-xs font-medium">{teamCode}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))}
          </TabsContent>
          
          {/* Activity Tab */}
          <TabsContent value="activity" className="p-4 space-y-3">
            {recentActivity.map((activity, index) => (
              <Card key={index}>
                <CardContent className="p-4">
                  <div className="flex items-center space-x-3">
                    <div className={`p-2 rounded-full ${
                      activity.color === 'blue' ? 'bg-blue-100 dark:bg-blue-900/30' :
                      activity.color === 'green' ? 'bg-green-100 dark:bg-green-900/30' :
                      activity.color === 'orange' ? 'bg-orange-100 dark:bg-orange-900/30' :
                      'bg-yellow-100 dark:bg-yellow-900/30'
                    }`}>
                      <activity.icon className={`w-4 h-4 ${
                        activity.color === 'blue' ? 'text-blue-600 dark:text-blue-400' :
                        activity.color === 'green' ? 'text-green-600 dark:text-green-400' :
                        activity.color === 'orange' ? 'text-orange-600 dark:text-orange-400' :
                        'text-yellow-600 dark:text-yellow-400'
                      }`} />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-medium">{activity.user} {activity.action}</p>
                        <div className="flex items-center space-x-2">
                          {activity.points && (
                            <Badge variant="outline" className="text-xs">{activity.points}</Badge>
                          )}
                          <span className="text-xs text-muted-foreground">{activity.time}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </TabsContent>

          {/* Prizes Tab */}
          <TabsContent value="prizes" className="p-4 space-y-4">
            {/* Weekly Skins */}
            <Card className="bg-gradient-to-r from-emerald-50 to-green-50 dark:from-emerald-950/20 dark:to-green-950/20 border-emerald-200 dark:border-emerald-800">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg text-emerald-800 dark:text-emerald-200 flex items-center space-x-2">
                  <DollarSign className="w-5 h-5" />
                  <span>Weekly Skins</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm text-emerald-600 dark:text-emerald-400 mb-1">This Week's Prize Pool</div>
                    <div className="text-2xl font-bold text-emerald-700 dark:text-emerald-300">${leagueInfo.weeklyPot}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm text-emerald-600 dark:text-emerald-400 mb-1">Stacks when tied</div>
                    <Badge className="bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300">
                      Week {leagueInfo.week}
                    </Badge>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Season Prizes */}
            <div className="space-y-3">
              <h3 className="text-lg font-semibold">Season Prizes</h3>
              {seasonPrizes.map((prize, index) => (
                <Card key={index}>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-medium">{prize.name}</div>
                        <div className="text-sm text-muted-foreground">
                          Leader: {prize.leader} ({prize.points})
                        </div>
                      </div>
                      <Badge variant="outline" className="text-sm font-semibold">
                        {prize.prize}
                      </Badge>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          {/* Rules Tab */}
          <TabsContent value="rules" className="p-4 space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Game Rules</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <h4 className="font-semibold mb-2">League Format</h4>
                  <div className="text-sm text-muted-foreground space-y-1">
                    <p>• 6 players, each drafts 5 NFL teams</p>
                    <p>• Snake draft with division restrictions</p>
                    <p>• 30/32 teams drafted, 2 free agents remain</p>
                  </div>
                </div>
                
                <div>
                  <h4 className="font-semibold mb-2">Scoring System</h4>
                  <div className="text-sm text-muted-foreground space-y-1">
                    <p>• Wins: +1 point, Ties: +0.5 points</p>
                    <p>• Blowouts (14+ margin): +1 bonus</p>
                    <p>• Shutouts: +1 bonus</p>
                    <p>• Weekly high scorer: +1 bonus</p>
                    <p>• Weekly low scorer: -1 penalty</p>
                  </div>
                </div>
                
                <div>
                  <h4 className="font-semibold mb-2">Lock System</h4>
                  <div className="text-sm text-muted-foreground space-y-1">
                    <p>• Pick 1 team to lock weekly for +1 bonus</p>
                    <p>• Maximum 4 locks per team per season</p>
                    <p>• Lock & Load: +2 for win, -1 for loss</p>
                    <p>• One Lock & Load per team per season</p>
                  </div>
                </div>
                
                <div>
                  <h4 className="font-semibold mb-2">Trading Rules</h4>
                  <div className="text-sm text-muted-foreground space-y-1">
                    <p>• Trade window: Monday night to Thursday 8:20 PM ET</p>
                    <p>• Team-to-team trades allowed</p>
                    <p>• No lock restrictions on new teams</p>
                    <p>• Cannot trade once week has started</p>
                    <p>• Maximum 1 trade per week</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
      <BottomNav />
    </div>
  );
}