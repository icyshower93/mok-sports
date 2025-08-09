import { BottomNav } from "@/components/layout/bottom-nav";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Shield, RefreshCw, TrendingUp, Star, ArrowUpDown } from "lucide-react";

export default function StablePage() {
  return (
    <div className="min-h-screen bg-background pb-20">
      <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
        <div className="flex items-center space-x-2">
          <Shield className="w-6 h-6 text-primary" />
          <h1 className="text-2xl font-bold">My Stable</h1>
        </div>
        
        <Tabs defaultValue="teams" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="teams">My 5 Teams</TabsTrigger>
            <TabsTrigger value="trades">Free Agent Trades</TabsTrigger>
          </TabsList>
          
          <TabsContent value="teams" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Shield className="w-5 h-5" />
                  <span>Your Stable</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground mb-4">
                  Your 5 NFL teams with performance stats, lock history, and analytics.
                </p>
                <div className="space-y-3">
                  {[
                    { team: "Kansas City Chiefs", record: "3-0", locks: "4 remaining", performance: "+2.5" },
                    { team: "San Francisco 49ers", record: "2-1", locks: "3 remaining", performance: "+1.8" },
                    { team: "Buffalo Bills", record: "2-1", locks: "4 remaining", performance: "+1.2" },
                    { team: "Philadelphia Eagles", record: "1-2", locks: "2 remaining", performance: "-0.5" },
                    { team: "Los Angeles Rams", record: "1-2", locks: "4 remaining", performance: "-1.1" }
                  ].map((team, index) => (
                    <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
                      <div>
                        <div className="font-semibold">{team.team}</div>
                        <div className="text-sm text-muted-foreground">{team.record} • {team.locks}</div>
                      </div>
                      <div className="text-right">
                        <Badge variant={parseFloat(team.performance) > 0 ? "default" : "secondary"}>
                          <TrendingUp className="w-3 h-3 mr-1" />
                          {team.performance}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
          
          <TabsContent value="trades" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <RefreshCw className="w-5 h-5" />
                  <span>Free Agent Trading</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground mb-4">
                  Trade window: Monday night to Thursday morning
                </p>
                
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-4 border rounded-lg bg-muted/50">
                    <div>
                      <div className="font-semibold">Available Free Agents</div>
                      <div className="text-sm text-muted-foreground">2 teams remaining</div>
                    </div>
                    <Button variant="outline" disabled>
                      <ArrowUpDown className="w-4 h-4 mr-2" />
                      Trade Window Closed
                    </Button>
                  </div>
                  
                  <Card>
                    <CardContent className="pt-4">
                      <div className="text-center space-y-2">
                        <Star className="w-12 h-12 mx-auto text-muted-foreground" />
                        <h3 className="font-semibold">Trading System</h3>
                        <p className="text-sm text-muted-foreground">
                          Make strategic trades during the weekly trade window to optimize your stable performance.
                        </p>
                      </div>
                    </CardContent>
                  </Card>
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