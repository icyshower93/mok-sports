import { useAuth } from "@/hooks/use-auth";
import { MainLayout } from "@/components/layout/main-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { User, Trophy, Calendar, LogOut, BarChart3, Target, Users, TrendingUp } from "lucide-react";
import { useQuery } from "@tanstack/react-query";

export default function ProfilePage() {
  // const { user, logout } = useAuth();

  // Get user statistics
  const { data: userStats, isLoading: statsLoading } = useQuery({
    queryKey: ['/api/user/stats'],
    enabled: !!user,
  });

  // Get user's recent draft history
  const { data: recentDrafts, isLoading: draftsLoading } = useQuery({
    queryKey: ['/api/user/drafts/recent'],
    enabled: !!user,
  });

  if (!user) return null;

  const handleLogout = async () => {
    await logout();
  };

  return (
    <MainLayout>
      <div className="py-6 space-y-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Profile</h1>
            <p className="text-muted-foreground mt-1">Manage your account and fantasy preferences</p>
          </div>
        </div>

        {/* User Profile Card */}
        <Card className="fantasy-card">
          <CardHeader>
            <CardTitle className="flex items-center">
              <User className="w-5 h-5 mr-2 text-fantasy-green" />
              Account Information
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center space-x-6 mb-6">
              <Avatar className="w-20 h-20">
                <AvatarImage src={user.avatar} alt={user.name} />
                <AvatarFallback className="text-2xl">{user.name.charAt(0)}</AvatarFallback>
              </Avatar>
              <div>
                <h2 className="text-2xl font-bold text-foreground mb-1">{user.name}</h2>
                <p className="text-muted-foreground mb-2">{user.email}</p>
                <p className="text-sm text-muted-foreground">
                  Mok Sports member
                </p>
              </div>
            </div>
            
            <div className="pt-6 border-t border-gray-200">
              <Button
                onClick={handleLogout}
                variant="outline"
              >
                <LogOut className="w-4 h-4 mr-2" />
                Sign Out
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Fantasy Statistics */}
        <Card className="fantasy-card">
          <CardHeader>
            <CardTitle className="flex items-center">
              <BarChart3 className="w-5 h-5 mr-2 text-fantasy-green" />
              Fantasy Statistics
            </CardTitle>
          </CardHeader>
          <CardContent>
            {statsLoading ? (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[...Array(4)].map((_, i) => (
                  <div key={i} className="p-4 bg-secondary/20 rounded-lg animate-pulse">
                    <div className="h-4 bg-secondary rounded mb-2"></div>
                    <div className="h-8 bg-secondary rounded"></div>
                  </div>
                ))}
              </div>
            ) : userStats ? (
              <div className="space-y-6">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="p-4 bg-fantasy-green/10 rounded-lg border">
                    <div className="flex items-center text-fantasy-green mb-2">
                      <Users className="w-4 h-4 mr-1" />
                      <span className="text-sm font-medium">Leagues Joined</span>
                    </div>
                    <div className="text-2xl font-bold">{userStats.totalLeagues || 0}</div>
                  </div>
                  
                  <div className="p-4 bg-blue-500/10 rounded-lg border">
                    <div className="flex items-center text-blue-500 mb-2">
                      <Trophy className="w-4 h-4 mr-1" />
                      <span className="text-sm font-medium">Drafts Completed</span>
                    </div>
                    <div className="text-2xl font-bold">{userStats.totalDrafts || 0}</div>
                  </div>
                  
                  <div className="p-4 bg-green-500/10 rounded-lg border">
                    <div className="flex items-center text-green-500 mb-2">
                      <Target className="w-4 h-4 mr-1" />
                      <span className="text-sm font-medium">Win Rate</span>
                    </div>
                    <div className="text-2xl font-bold">
                      {userStats.winRate ? `${Math.round(userStats.winRate)}%` : 'N/A'}
                    </div>
                  </div>
                  
                  <div className="p-4 bg-purple-500/10 rounded-lg border">
                    <div className="flex items-center text-purple-500 mb-2">
                      <TrendingUp className="w-4 h-4 mr-1" />
                      <span className="text-sm font-medium">Avg Pick Time</span>
                    </div>
                    <div className="text-2xl font-bold">
                      {userStats.avgPickTime ? `${userStats.avgPickTime}s` : 'N/A'}
                    </div>
                  </div>
                </div>

                {/* Draft Performance */}
                {userStats.pickHistory && userStats.pickHistory.length > 0 && (
                  <div>
                    <h3 className="font-semibold mb-3 flex items-center">
                      <Trophy className="w-4 h-4 mr-2" />
                      Draft Performance
                    </h3>
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span>Manual Picks:</span>
                        <Badge variant="secondary">
                          {userStats.pickHistory.filter((p: any) => !p.isAutoPick).length}
                        </Badge>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span>Auto Picks:</span>
                        <Badge variant="outline">
                          {userStats.pickHistory.filter((p: any) => p.isAutoPick).length}
                        </Badge>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span>Fastest Pick:</span>
                        <Badge variant="default">
                          {userStats.fastestPick ? `${userStats.fastestPick}s` : 'N/A'}
                        </Badge>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-12">
                <div className="w-20 h-20 bg-accent-gold/10 rounded-full flex items-center justify-center mx-auto mb-6">
                  <Trophy className="w-10 h-10 text-accent-gold" />
                </div>
                <h3 className="text-xl font-semibold mb-2">Start Your Fantasy Journey</h3>
                <p className="text-muted-foreground max-w-md mx-auto">
                  Join your first league to begin tracking your draft performance and building your fantasy legacy.
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Draft History */}
        {recentDrafts && recentDrafts.length > 0 && (
          <Card className="fantasy-card">
            <CardHeader>
              <CardTitle className="flex items-center">
                <Calendar className="w-5 h-5 mr-2 text-fantasy-green" />
                Recent Draft History
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {recentDrafts.map((draft: any) => (
                  <div key={draft.id} className="flex items-center justify-between p-3 bg-secondary/20 rounded-lg border">
                    <div>
                      <div className="font-medium">{draft.leagueName}</div>
                      <div className="text-sm text-muted-foreground">
                        {new Date(draft.completedAt).toLocaleDateString()} • {draft.totalPicks} picks
                      </div>
                    </div>
                    <div className="text-right">
                      <Badge variant={draft.status === 'completed' ? 'default' : 'secondary'}>
                        {draft.status}
                      </Badge>
                      <div className="text-xs text-muted-foreground mt-1">
                        Round {draft.finalRound}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </MainLayout>
  );
}