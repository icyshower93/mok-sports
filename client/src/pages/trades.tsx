import { BottomNav } from "@/components/layout/bottom-nav";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RefreshCw, ArrowLeftRight, Clock, Star, ArrowLeft } from "lucide-react";
import { useLocation } from "wouter";
import { TeamLogo } from "@/components/team-logo";

export default function TradesPage() {
  const [, navigate] = useLocation();

  const myTeams = [
    { id: 1, code: "KC", name: "Kansas City Chiefs", record: "3-0", logoUrl: "/images/nfl/team_logos/KC.png" },
    { id: 2, code: "SF", name: "San Francisco 49ers", record: "2-1", logoUrl: "/images/nfl/team_logos/SF.png" },
    { id: 3, code: "BUF", name: "Buffalo Bills", record: "2-1", logoUrl: "/images/nfl/team_logos/BUF.png" },
    { id: 4, code: "PHI", name: "Philadelphia Eagles", record: "1-2", logoUrl: "/images/nfl/team_logos/PHI.png" },
    { id: 5, code: "LAR", name: "Los Angeles Rams", record: "1-2", logoUrl: "/images/nfl/team_logos/LAR.png" }
  ];

  const freeAgents = [
    { id: 6, code: "NYG", name: "New York Giants", record: "0-3", logoUrl: "/images/nfl/team_logos/NYG.png" },
    { id: 7, code: "ARI", name: "Arizona Cardinals", record: "1-2", logoUrl: "/images/nfl/team_logos/ARI.png" }
  ];

  const tradeWindowOpen = false; // Mock data - would be calculated based on current time

  return (
    <div className="min-h-screen bg-background pb-20">
      <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
        {/* Header */}
        <div className="flex items-center space-x-3">
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => navigate('/')}
            className="p-2"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <RefreshCw className="w-6 h-6 text-primary" />
          <h1 className="text-2xl font-bold">Trades Center</h1>
        </div>

        {/* Trade Window Status */}
        <Card className={`border-2 ${tradeWindowOpen ? 'border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950/20' : 'border-orange-200 bg-orange-50 dark:border-orange-800 dark:bg-orange-950/20'}`}>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <Clock className={`w-5 h-5 ${tradeWindowOpen ? 'text-green-600 dark:text-green-400' : 'text-orange-600 dark:text-orange-400'}`} />
                <div>
                  <div className={`font-semibold ${tradeWindowOpen ? 'text-green-800 dark:text-green-200' : 'text-orange-800 dark:text-orange-200'}`}>
                    {tradeWindowOpen ? 'Trade Window Open' : 'Trade Window Closed'}
                  </div>
                  <div className={`text-sm ${tradeWindowOpen ? 'text-green-600 dark:text-green-400' : 'text-orange-600 dark:text-orange-400'}`}>
                    {tradeWindowOpen ? 'Closes Thursday 8:20 PM ET' : 'Opens Monday Night'}
                  </div>
                </div>
              </div>
              <Badge variant={tradeWindowOpen ? "default" : "secondary"}>
                {tradeWindowOpen ? 'Active' : 'Closed'}
              </Badge>
            </div>
          </CardContent>
        </Card>

        <Tabs defaultValue="my-teams" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="my-teams">My Teams (5)</TabsTrigger>
            <TabsTrigger value="free-agents">Free Agents (2)</TabsTrigger>
          </TabsList>
          
          <TabsContent value="my-teams" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Star className="w-5 h-5" />
                  <span>Your Stable</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {myTeams.map((team) => (
                  <div key={team.id} className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex items-center space-x-4">
                      <TeamLogo 
                        logoUrl={team.logoUrl}
                        teamCode={team.code}
                        teamName={team.name}
                        size="md"
                        className="w-10 h-10"
                      />
                      <div>
                        <div className="font-semibold">{team.name}</div>
                        <div className="text-sm text-muted-foreground">{team.record} record</div>
                      </div>
                    </div>
                    <Button 
                      size="sm" 
                      variant="outline"
                      disabled={!tradeWindowOpen}
                      className="min-w-[100px]"
                    >
                      <ArrowLeftRight className="w-4 h-4 mr-2" />
                      {tradeWindowOpen ? 'Trade' : 'Locked'}
                    </Button>
                  </div>
                ))}
              </CardContent>
            </Card>
          </TabsContent>
          
          <TabsContent value="free-agents" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <RefreshCw className="w-5 h-5" />
                  <span>Available Free Agents</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {freeAgents.map((team) => (
                  <div key={team.id} className="flex items-center justify-between p-4 border rounded-lg bg-muted/30">
                    <div className="flex items-center space-x-4">
                      <TeamLogo 
                        logoUrl={team.logoUrl}
                        teamCode={team.code}
                        teamName={team.name}
                        size="md"
                        className="w-10 h-10"
                      />
                      <div>
                        <div className="font-semibold">{team.name}</div>
                        <div className="text-sm text-muted-foreground">{team.record} record • Free Agent</div>
                      </div>
                    </div>
                    <Button 
                      size="sm" 
                      disabled={!tradeWindowOpen}
                      className="min-w-[100px]"
                    >
                      <ArrowLeftRight className="w-4 h-4 mr-2" />
                      {tradeWindowOpen ? 'Claim' : 'Locked'}
                    </Button>
                  </div>
                ))}
              </CardContent>
            </Card>
            
            {/* Trade Rules */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Trading Rules</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm text-muted-foreground">
                <p>• Trade window: Monday night to Thursday 8:20 PM ET</p>
                <p>• Maximum 1 trade per week</p>
                <p>• Drop one of your teams to claim a free agent</p>
                <p>• Trades process immediately during window</p>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
      <BottomNav />
    </div>
  );
}