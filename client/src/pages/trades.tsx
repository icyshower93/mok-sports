import { BottomNav } from "@/components/layout/bottom-nav";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { RefreshCw, ArrowLeftRight, Clock, Users, ArrowLeft, Search, Plus, User, Send } from "lucide-react";
import { useLocation } from "wouter";
import { TeamLogo } from "@/components/team-logo";
import { useState, startTransition } from "react";

export default function TradesPage() {
  const [, navigate] = useLocation();
  const [selectedTab, setSelectedTab] = useState("team-trades");
  const [searchQuery, setSearchQuery] = useState("");

  const myTeams = [
    { id: 1, code: "KC", name: "Kansas City Chiefs", record: "3-0", logoUrl: "/images/nfl/team_logos/KC.png", tradable: true },
    { id: 2, code: "SF", name: "San Francisco 49ers", record: "2-1", logoUrl: "/images/nfl/team_logos/SF.png", tradable: true },
    { id: 3, code: "BUF", name: "Buffalo Bills", record: "2-1", logoUrl: "/images/nfl/team_logos/BUF.png", tradable: false, reason: "Week started" },
    { id: 4, code: "PHI", name: "Philadelphia Eagles", record: "1-2", logoUrl: "/images/nfl/team_logos/PHI.png", tradable: true },
    { id: 5, code: "LAR", name: "Los Angeles Rams", record: "1-2", logoUrl: "/images/nfl/team_logos/LAR.png", tradable: true }
  ];

  const leagueMembers = [
    { id: 1, name: "Mike Chen", avatar: "MC", teams: [
      { code: "DAL", name: "Dallas Cowboys", record: "2-1", logoUrl: "/images/nfl/team_logos/DAL.png" },
      { code: "MIA", name: "Miami Dolphins", record: "2-1", logoUrl: "/images/nfl/team_logos/MIA.png" }
    ]},
    { id: 2, name: "Sarah Wilson", avatar: "SW", teams: [
      { code: "BAL", name: "Baltimore Ravens", record: "3-0", logoUrl: "/images/nfl/team_logos/BAL.png" },
      { code: "GB", name: "Green Bay Packers", record: "2-1", logoUrl: "/images/nfl/team_logos/GB.png" }
    ]},
    { id: 3, name: "Alex Rodriguez", avatar: "AR", teams: [
      { code: "TB", name: "Tampa Bay Buccaneers", record: "2-1", logoUrl: "/images/nfl/team_logos/TB.png" },
      { code: "SEA", name: "Seattle Seahawks", record: "1-2", logoUrl: "/images/nfl/team_logos/SEA.png" }
    ]}
  ];

  const freeAgents = [
    { id: 6, code: "NYG", name: "New York Giants", record: "0-3", logoUrl: "/images/nfl/team_logos/NYG.png" },
    { id: 7, code: "ARI", name: "Arizona Cardinals", record: "1-2", logoUrl: "/images/nfl/team_logos/ARI.png" }
  ];

  const tradeWindowOpen = true; // Mock data

  const filteredMembers = leagueMembers.filter(member => 
    member.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-background pb-20">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border/50 bg-card sticky top-0 z-10">
          <div className="flex items-center space-x-3">
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => startTransition(() => navigate('/'))}
              className="p-2"
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div>
              <h1 className="text-xl font-bold">Trade Center</h1>
              <p className="text-sm text-muted-foreground">Manage your roster</p>
            </div>
          </div>
          <Badge variant={tradeWindowOpen ? "default" : "secondary"} className="text-xs">
            {tradeWindowOpen ? 'Open' : 'Closed'}
          </Badge>
        </div>

        {/* Trade Window Status Banner */}
        {!tradeWindowOpen && (
          <div className="p-3 bg-orange-50 dark:bg-orange-950/20 border-b border-orange-200 dark:border-orange-800">
            <div className="flex items-center space-x-2 text-orange-700 dark:text-orange-300">
              <Clock className="w-4 h-4" />
              <span className="text-sm font-medium">Trade window opens Monday night</span>
            </div>
          </div>
        )}

        <Tabs value={selectedTab} onValueChange={setSelectedTab} className="w-full">
          <TabsList className="grid w-full grid-cols-3 m-4 mb-0">
            <TabsTrigger value="team-trades" className="text-xs">Team Trades</TabsTrigger>
            <TabsTrigger value="free-agents" className="text-xs">Free Agents</TabsTrigger>
            <TabsTrigger value="my-roster" className="text-xs">My Roster</TabsTrigger>
          </TabsList>
          
          {/* Team Trades Tab */}
          <TabsContent value="team-trades" className="p-4 space-y-4">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search league members..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>

            {/* League Members */}
            <div className="space-y-3">
              {filteredMembers.map((member) => (
                <Card key={member.id} className="hover:shadow-sm transition-shadow">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center space-x-3">
                        <Avatar className="w-8 h-8">
                          <AvatarFallback className="text-xs">{member.avatar}</AvatarFallback>
                        </Avatar>
                        <div>
                          <div className="font-medium text-sm">{member.name}</div>
                          <div className="text-xs text-muted-foreground">{member.teams.length} teams</div>
                        </div>
                      </div>
                      <Button size="sm" variant="outline" disabled={!tradeWindowOpen}>
                        <Send className="w-3 h-3 mr-2" />
                        Propose Trade
                      </Button>
                    </div>
                    
                    {/* Member's Teams */}
                    <div className="grid grid-cols-2 gap-2">
                      {member.teams.map((team, index) => (
                        <div key={index} className="flex items-center space-x-2 p-2 rounded-md bg-muted/30">
                          <TeamLogo 
                            logoUrl={team.logoUrl}
                            teamCode={team.code}
                            teamName={team.name}
                            size="sm"
                            className="w-6 h-6"
                          />
                          <div className="flex-1 min-w-0">
                            <div className="text-xs font-medium truncate">{team.code}</div>
                            <div className="text-xs text-muted-foreground">{team.record}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>
          
          {/* Free Agents Tab */}
          <TabsContent value="free-agents" className="p-4 space-y-4">
            <div className="space-y-3">
              {freeAgents.map((team) => (
                <Card key={team.id} className="hover:shadow-sm transition-shadow">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-4">
                        <TeamLogo 
                          logoUrl={team.logoUrl}
                          teamCode={team.code}
                          teamName={team.name}
                          size="md"
                          className="w-10 h-10"
                        />
                        <div>
                          <div className="font-medium">{team.name}</div>
                          <div className="text-sm text-muted-foreground">{team.record} • Free Agent</div>
                        </div>
                      </div>
                      <Button 
                        size="sm" 
                        disabled={!tradeWindowOpen}
                        className="min-w-[80px]"
                      >
                        <Plus className="w-3 h-3 mr-2" />
                        {tradeWindowOpen ? 'Add' : 'Locked'}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
            
            {/* Quick Stats */}
            <Card className="bg-muted/30">
              <CardContent className="p-4">
                <div className="text-center">
                  <div className="text-sm text-muted-foreground mb-1">Available Free Agents</div>
                  <div className="text-2xl font-bold">{freeAgents.length}</div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* My Roster Tab */}
          <TabsContent value="my-roster" className="p-4 space-y-4">
            <div className="space-y-3">
              {myTeams.map((team) => (
                <Card key={team.id} className={`${!team.tradable ? 'opacity-60' : 'hover:shadow-sm'} transition-all`}>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-4">
                        <TeamLogo 
                          logoUrl={team.logoUrl}
                          teamCode={team.code}
                          teamName={team.name}
                          size="md"
                          className="w-10 h-10"
                        />
                        <div>
                          <div className="font-medium">{team.name}</div>
                          <div className="text-sm text-muted-foreground">
                            {team.record} • {team.tradable ? 'Tradable' : team.reason}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        {!team.tradable && (
                          <Badge variant="secondary" className="text-xs">Locked</Badge>
                        )}
                        <Button 
                          size="sm" 
                          variant="outline"
                          disabled={!team.tradable || !tradeWindowOpen}
                          className="min-w-[80px]"
                        >
                          <ArrowLeftRight className="w-3 h-3 mr-2" />
                          Trade
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
            
            {/* Trading Rules */}
            <Card className="bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800">
              <CardHeader className="pb-3">
                <CardTitle className="text-base text-blue-800 dark:text-blue-200">Trading Rules</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm text-blue-700 dark:text-blue-300">
                <p>• Trade window: Monday night to Thursday 8:20 PM ET</p>
                <p>• Team-to-team trades allowed during window</p>
                <p>• No lock restrictions on newly acquired teams</p>
                <p>• Cannot trade teams once their week has started</p>
                <p>• Maximum 1 trade transaction per week</p>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
      <BottomNav />
    </div>
  );
}