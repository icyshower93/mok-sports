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
      <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
        
        {/* Mobile-First Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold">Mok Sports</h1>
            <p className="text-sm text-muted-foreground">Week {selectedWeek} • {isLockWindowOpen ? 'Lock Window Open' : 'NFL Regular Season'}</p>
          </div>
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => navigate('/dashboard')}
          >
            <Users className="w-4 h-4 md:mr-2" />
            <span className="hidden md:inline">Leagues</span>
          </Button>
        </div>

        {/* Lock Window Priority Section */}
        {isLockWindowOpen && (
          <div className="space-y-4">
            <Card className="bg-gradient-to-r from-green-50 to-blue-50 dark:from-green-950/20 dark:to-blue-950/20 border-green-200 dark:border-green-800">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-full">
                      <Clock className="w-5 h-5 text-green-600 dark:text-green-400" />
                    </div>
                    <div>
                      <div className="font-semibold text-green-800 dark:text-green-200">
                        Lock Deadline
                      </div>
                      <div className="text-sm text-green-600 dark:text-green-400">
                        {lockDeadline.toLocaleDateString()} at 8:20 PM ET
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Your Teams - Lock Focus Mode */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">Choose Your Lock for Week {selectedWeek}</CardTitle>
                <p className="text-sm text-muted-foreground">Select one team to lock for bonus points</p>
              </CardHeader>
              <CardContent className="space-y-3">
                {mockUserTeams.filter(team => !team.isBye && team.locksRemaining > 0).map((team) => (
                  <div 
                    key={team.nflTeam.id}
                    className="flex items-center justify-between p-4 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
                  >
                    <div className="flex items-center space-x-3">
                      <TeamLogo 
                        logoUrl={team.nflTeam.logoUrl}
                        teamCode={team.nflTeam.code}
                        teamName={team.nflTeam.name}
                        size="lg"
                        className="w-10 h-10 md:w-12 md:h-12"
                      />
                      <div>
                        <div className="font-semibold">
                          {team.nflTeam.city} {team.nflTeam.name}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {team.upcomingOpponent} • {team.locksRemaining} locks left
                        </div>
                      </div>
                    </div>
                    
                    <Button 
                      size="lg"
                      className="min-h-[44px] px-6"
                    >
                      <Lock className="w-4 h-4 mr-2" />
                      Lock
                    </Button>
                  </div>
                ))}
                
                {/* Teams with no locks remaining */}
                {mockUserTeams.filter(team => !team.isBye && team.locksRemaining === 0).length > 0 && (
                  <div className="pt-2">
                    <p className="text-xs text-muted-foreground mb-2">No locks remaining:</p>
                    {mockUserTeams.filter(team => !team.isBye && team.locksRemaining === 0).map((team) => (
                      <div 
                        key={team.nflTeam.id}
                        className="flex items-center justify-between p-3 rounded-lg bg-muted/50 opacity-60"
                      >
                        <div className="flex items-center space-x-3">
                          <TeamLogo 
                            logoUrl={team.nflTeam.logoUrl}
                            teamCode={team.nflTeam.code}
                            teamName={team.nflTeam.name}
                            size="sm"
                            className="w-8 h-8"
                          />
                          <div>
                            <div className="font-medium text-sm">
                              {team.nflTeam.city} {team.nflTeam.name}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {team.upcomingOpponent}
                            </div>
                          </div>
                        </div>
                        <Badge variant="secondary" className="text-xs">
                          <Unlock className="w-3 h-3 mr-1" />
                          Used
                        </Badge>
                      </div>
                    ))}
                  </div>
                )}

                {/* Bye Week Teams */}
                {mockUserTeams.filter(team => team.isBye).length > 0 && (
                  <div className="pt-2">
                    <p className="text-xs text-muted-foreground mb-2">On bye week:</p>
                    {mockUserTeams.filter(team => team.isBye).map((team) => (
                      <div 
                        key={team.nflTeam.id}
                        className="flex items-center space-x-3 p-3 rounded-lg bg-muted/30"
                      >
                        <TeamLogo 
                          logoUrl={team.nflTeam.logoUrl}
                          teamCode={team.nflTeam.code}
                          teamName={team.nflTeam.name}
                          size="sm"
                          className="w-8 h-8 opacity-50"
                        />
                        <div>
                          <div className="font-medium text-sm opacity-75">
                            {team.nflTeam.city} {team.nflTeam.name}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            BYE WEEK
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}

        {/* Non-Lock Window: Full Team View */}
        {!isLockWindowOpen && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Shield className="w-5 h-5" />
                <span>Your Stable</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {mockUserTeams.map((team) => (
                <div 
                  key={team.nflTeam.id}
                  className={`flex items-center justify-between p-4 rounded-lg border transition-colors ${
                    team.isBye ? 'bg-muted/50 opacity-75' : 'bg-card'
                  }`}
                >
                  <div className="flex items-center space-x-3">
                    <TeamLogo 
                      logoUrl={team.nflTeam.logoUrl}
                      teamCode={team.nflTeam.code}
                      teamName={team.nflTeam.name}
                      size="lg"
                      className="w-10 h-10 md:w-12 md:h-12"
                    />
                    <div>
                      <div className="font-semibold">
                        {team.nflTeam.city} {team.nflTeam.name}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {team.isBye ? 'BYE WEEK' : team.upcomingOpponent}
                      </div>
                    </div>
                  </div>
                  
                  <div className="text-right">
                    <div className="text-sm font-medium">
                      {team.locksRemaining} locks left
                    </div>
                    {team.lockAndLoadAvailable && (
                      <Badge variant="outline" className="text-xs mt-1">
                        <Zap className="w-3 h-3 mr-1" />
                        L&L Ready
                      </Badge>
                    )}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {/* Bottom Navigation Cards - Mobile Optimized */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          
          {/* Current Standings */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center space-x-2 text-lg">
                <Trophy className="w-5 h-5" />
                <span>League Standings</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {[
                  { name: "You", points: 12.5, position: 1 },
                  { name: "Alex", points: 11.0, position: 2 },
                  { name: "Jordan", points: 10.5, position: 3 }
                ].map((player) => (
                  <div key={player.name} className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                        player.position === 1 ? 'bg-yellow-500 text-yellow-50' :
                        player.position === 2 ? 'bg-gray-400 text-gray-50' :
                        'bg-amber-600 text-amber-50'
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
                <Button variant="outline" size="sm" className="w-full mt-3">
                  View Full Standings
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Weekly Prize */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center space-x-2 text-lg">
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
                <Button variant="outline" size="sm" className="w-full mt-3">
                  Prize History
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Quick Actions - Mobile Friendly */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Quick Actions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 gap-3">
              <Button variant="outline" className="justify-start min-h-[44px]">
                <Star className="w-4 h-4 mr-3" />
                Free Agent Market
              </Button>
              <Button variant="outline" className="justify-start min-h-[44px]">
                <Award className="w-4 h-4 mr-3" />
                Lock History
              </Button>
              <Button variant="outline" className="justify-start min-h-[44px]">
                <Calendar className="w-4 h-4 mr-3" />
                This Week's Games
              </Button>
            </div>
          </CardContent>
        </Card>

      </div>
    </div>
  );
}