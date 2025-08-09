import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Clock, 
  Users, 
  Trophy, 
  Zap, 
  Shield, 
  Star, 
  TrendingUp,
  Calendar,
  Target,
  Award,
  ArrowRight,
  Lock,
  Unlock,
  DollarSign,
  Medal,
  Activity
} from "lucide-react";
import { TeamLogo } from "@/components/team-logo";
import { useAuth } from "@/hooks/use-auth";

interface NflTeam {
  id: string;
  code: string;
  name: string;
  city: string;
  conference: 'AFC' | 'NFC';
  division: string;
  logoUrl: string;
}

interface UserTeam {
  nflTeam: NflTeam;
  locksRemaining: number;
  lockAndLoadAvailable: boolean;
  upcomingOpponent?: string;
  isBye: boolean;
  weeklyRecord?: string;
}

export default function MainPage() {
  const [location, navigate] = useLocation();
  const { user } = useAuth();
  const [selectedWeek] = useState(1); // Will be dynamic based on NFL schedule

  // Mock data for now - will be replaced with real API calls
  const mockUserTeams: UserTeam[] = [
    {
      nflTeam: {
        id: "1",
        code: "KC",
        name: "Chiefs",
        city: "Kansas City",
        conference: "AFC",
        division: "West",
        logoUrl: "/images/nfl-team-logos/KC.png"
      },
      locksRemaining: 4,
      lockAndLoadAvailable: true,
      upcomingOpponent: "vs LAC",
      isBye: false,
      weeklyRecord: "2-1"
    },
    {
      nflTeam: {
        id: "2", 
        code: "SF",
        name: "49ers",
        city: "San Francisco",
        conference: "NFC",
        division: "West",
        logoUrl: "/images/nfl-team-logos/SF.png"
      },
      locksRemaining: 3,
      lockAndLoadAvailable: true,
      upcomingOpponent: "@ DAL",
      isBye: false,
      weeklyRecord: "3-0"
    },
    {
      nflTeam: {
        id: "3",
        code: "BUF", 
        name: "Bills",
        city: "Buffalo",
        conference: "AFC",
        division: "East",
        logoUrl: "/images/nfl-team-logos/BUF.png"
      },
      locksRemaining: 4,
      lockAndLoadAvailable: false,
      upcomingOpponent: "vs MIA",
      isBye: false,
      weeklyRecord: "2-1"
    },
    {
      nflTeam: {
        id: "4",
        code: "PHI",
        name: "Eagles", 
        city: "Philadelphia",
        conference: "NFC",
        division: "East",
        logoUrl: "/images/nfl-team-logos/PHI.png"
      },
      locksRemaining: 2,
      lockAndLoadAvailable: true,
      upcomingOpponent: "BYE",
      isBye: true,
      weeklyRecord: "1-2"
    },
    {
      nflTeam: {
        id: "5",
        code: "LAR",
        name: "Rams",
        city: "Los Angeles", 
        conference: "NFC",
        division: "West",
        logoUrl: "/images/nfl-team-logos/LAR.png"
      },
      locksRemaining: 4,
      lockAndLoadAvailable: true,
      upcomingOpponent: "@ ARI",
      isBye: false,
      weeklyRecord: "1-2"
    }
  ];

  const lockDeadline = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000); // 2 days from now
  const isLockWindowOpen = true;
  const currentSkinsPrize = 250;
  const isSkinsStacked = false;

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto p-4 space-y-6">
        
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Mok Sports</h1>
            <p className="text-muted-foreground">Week {selectedWeek} • NFL Regular Season</p>
          </div>
          <Button 
            variant="outline" 
            onClick={() => navigate('/dashboard')}
          >
            <Users className="w-4 h-4 mr-2" />
            Leagues
          </Button>
        </div>

        {/* Lock Status Banner */}
        {isLockWindowOpen && (
          <Card className="bg-gradient-to-r from-green-50 to-blue-50 dark:from-green-950/20 dark:to-blue-950/20 border-green-200 dark:border-green-800">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-full">
                    <Clock className="w-5 h-5 text-green-600 dark:text-green-400" />
                  </div>
                  <div>
                    <div className="font-semibold text-green-800 dark:text-green-200">
                      Lock Window Open
                    </div>
                    <div className="text-sm text-green-600 dark:text-green-400">
                      Deadline: {lockDeadline.toLocaleDateString()} at 8:20 PM ET
                    </div>
                  </div>
                </div>
                <Button className="bg-green-600 hover:bg-green-700 text-white">
                  <Lock className="w-4 h-4 mr-2" />
                  Lock Now
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        <div className="grid lg:grid-cols-3 gap-6">
          
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            
            {/* Your Stable */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Shield className="w-5 h-5" />
                  <span>Your Stable</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4">
                  {mockUserTeams.map((team) => (
                    <div 
                      key={team.nflTeam.id}
                      className={`flex items-center justify-between p-4 rounded-lg border transition-colors ${
                        team.isBye ? 'bg-muted/50 opacity-75' : 'bg-card hover:bg-accent/50'
                      }`}
                    >
                      <div className="flex items-center space-x-4">
                        <TeamLogo 
                          logoUrl={team.nflTeam.logoUrl}
                          teamCode={team.nflTeam.code}
                          teamName={team.nflTeam.name}
                          size="lg"
                          className="w-12 h-12"
                        />
                        <div>
                          <div className="font-semibold text-lg">
                            {team.nflTeam.city} {team.nflTeam.name}
                          </div>
                          <div className="text-sm text-muted-foreground">
                            {team.isBye ? 'BYE WEEK' : team.upcomingOpponent}
                          </div>
                          {team.weeklyRecord && (
                            <div className="text-xs text-muted-foreground">
                              Season: {team.weeklyRecord}
                            </div>
                          )}
                        </div>
                      </div>
                      
                      <div className="flex items-center space-x-3">
                        {/* Lock Status */}
                        <div className="text-right">
                          <div className="text-sm font-medium">
                            {team.locksRemaining} locks left
                          </div>
                          {team.lockAndLoadAvailable && (
                            <Badge variant="outline" className="text-xs">
                              <Zap className="w-3 h-3 mr-1" />
                              L&L Ready
                            </Badge>
                          )}
                        </div>
                        
                        {/* Lock Button */}
                        {!team.isBye && isLockWindowOpen && (
                          <Button 
                            size="sm"
                            variant={team.locksRemaining > 0 ? "default" : "secondary"}
                            disabled={team.locksRemaining === 0}
                          >
                            {team.locksRemaining > 0 ? (
                              <>
                                <Lock className="w-4 h-4 mr-1" />
                                Lock
                              </>
                            ) : (
                              <>
                                <Unlock className="w-4 h-4 mr-1" />
                                Used
                              </>
                            )}
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* This Week's Games */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Calendar className="w-5 h-5" />
                  <span>This Week's Games</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-center text-muted-foreground py-8">
                  <Activity className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p>Game schedule will load here</p>
                  <p className="text-sm">Show your teams' games with live scores</p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            
            {/* Weekly Skins */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <DollarSign className="w-5 h-5" />
                  <span>Weekly Skins</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-center space-y-2">
                  <div className="text-3xl font-bold text-green-600">
                    ${currentSkinsPrize}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {isSkinsStacked ? 'Stacked Prize' : 'This Week'}
                  </div>
                  {isSkinsStacked && (
                    <Badge variant="outline" className="text-xs">
                      <TrendingUp className="w-3 h-3 mr-1" />
                      3 Weeks Stacked
                    </Badge>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* League Standings */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Trophy className="w-5 h-5" />
                  <span>League Standings</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {[
                    { name: "You", points: 12.5, position: 1 },
                    { name: "Alex", points: 11.0, position: 2 },
                    { name: "Jordan", points: 10.5, position: 3 },
                    { name: "Casey", points: 9.0, position: 4 },
                    { name: "Taylor", points: 8.5, position: 5 },
                    { name: "Morgan", points: 7.0, position: 6 }
                  ].map((player) => (
                    <div key={player.name} className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                          player.position === 1 ? 'bg-yellow-500 text-yellow-50' :
                          player.position === 2 ? 'bg-gray-400 text-gray-50' :
                          player.position === 3 ? 'bg-amber-600 text-amber-50' :
                          'bg-muted text-muted-foreground'
                        }`}>
                          {player.position}
                        </div>
                        <span className={player.name === "You" ? "font-semibold" : ""}>
                          {player.name}
                        </span>
                      </div>
                      <span className="font-mono text-sm">
                        {player.points.toFixed(1)}
                      </span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Quick Actions */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Target className="w-5 h-5" />
                  <span>Quick Actions</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <Button variant="outline" className="w-full justify-start">
                  <Star className="w-4 h-4 mr-2" />
                  Free Agent Market
                </Button>
                <Button variant="outline" className="w-full justify-start">
                  <Award className="w-4 h-4 mr-2" />
                  Lock History
                </Button>
                <Button variant="outline" className="w-full justify-start">
                  <Medal className="w-4 h-4 mr-2" />
                  Season Prizes
                </Button>
              </CardContent>
            </Card>

            {/* Recent Activity */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Activity className="w-5 h-5" />
                  <span>Recent Activity</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3 text-sm">
                  <div className="flex items-start space-x-2">
                    <div className="w-2 h-2 bg-green-500 rounded-full mt-2 flex-shrink-0"></div>
                    <div>
                      <span className="font-medium">Alex</span> locked <span className="font-medium">Ravens</span> for Week {selectedWeek}
                      <div className="text-xs text-muted-foreground">2 hours ago</div>
                    </div>
                  </div>
                  <div className="flex items-start space-x-2">
                    <div className="w-2 h-2 bg-blue-500 rounded-full mt-2 flex-shrink-0"></div>
                    <div>
                      <span className="font-medium">Jordan</span> traded for <span className="font-medium">Dolphins</span>
                      <div className="text-xs text-muted-foreground">5 hours ago</div>
                    </div>
                  </div>
                  <div className="flex items-start space-x-2">
                    <div className="w-2 h-2 bg-yellow-500 rounded-full mt-2 flex-shrink-0"></div>
                    <div>
                      <span className="font-medium">You</span> won Week {selectedWeek - 1} skins ($200)
                      <div className="text-xs text-muted-foreground">3 days ago</div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

          </div>
        </div>
      </div>
    </div>
  );
}