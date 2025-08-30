import { useState, useEffect } from "react";
import { AuthTokenManager } from "@/features/query/queryClient";
import { useAuth } from "@/features/auth";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { MainLayout } from "@/components/layout/main-layout";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, UserPlus, LogOut, Trophy, Users, Clock, BarChart3, TrendingUp } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import { usePushNotifications } from "@/hooks/use-push-notifications";
import { NotificationPrompt } from "@/components/notification-prompt";
// Debug panels removed for production - can be re-enabled by uncommenting imports below
// import { PWADebugPanel } from "@/components/pwa-debug-panel";
// import { PushDiagnosticPanel } from "@/components/push-diagnostic-panel";
import { PersistentPushManager } from "@/components/persistent-push-manager";

// Development helper for quick login
const testLogin = async (userId?: string) => {
  try {
    const response = await fetch('/api/auth/testing/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId }),
      credentials: 'include'
    });
    const result = await response.json();
    if (result.success && result.token) {
      // Store token for PWA compatibility
      // FIXED: Use static import instead of dynamic to prevent TDZ race condition
      AuthTokenManager.setToken(result.token);
      window.location.reload();
    } else if (result.success) {
      window.location.reload();
    }
  } catch (error) {
    console.error('Test login failed:', error);
  }
};

export default function DashboardPage() {
  const { user, logout } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();
  const { permission } = usePushNotifications();

  
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [joinDialogOpen, setJoinDialogOpen] = useState(false);
  const [leagueName, setLeagueName] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [showNotificationPrompt, setShowNotificationPrompt] = useState(false);

  // Check if user is already in a league
  const { data: userLeagues, isLoading: leaguesLoading, refetch: refetchLeagues } = useQuery({
    queryKey: ['/api/leagues/user'],
    enabled: !!user,
    refetchOnWindowFocus: true, // Re-check leagues when PWA regains focus
    staleTime: 0, // Always fetch fresh league data for PWA
  });

  // Get league analytics for dashboard
  const { data: leagueStats, isLoading: statsLoading } = useQuery({
    queryKey: ['/api/leagues/stats'],
    enabled: !!user,
    staleTime: 30000, // Cache for 30 seconds
  });

  // Debug logging for PWA troubleshooting
  useEffect(() => {
    if (user) {
      console.log('[Dashboard] User authenticated:', user);
      console.log('[Dashboard] User leagues loading:', leaguesLoading);
      console.log('[Dashboard] User leagues data:', userLeagues);
    }
  }, [user, userLeagues, leaguesLoading]);

  // Force refresh leagues data if user is authenticated but no leagues found
  useEffect(() => {
    if (user && !leaguesLoading && (!userLeagues || userLeagues.length === 0)) {
      console.log('[Dashboard] User authenticated but no leagues found, refreshing...');
      refetchLeagues();
    }
  }, [user, userLeagues, leaguesLoading, refetchLeagues]);

  // Redirect to league waiting room if user is already in a league
  useEffect(() => {
    // Check if user explicitly wants to stay on dashboard (e.g., after leaving a league)
    const urlParams = new URLSearchParams(window.location.search);
    const shouldStay = urlParams.get('stay') === 'true';
    
    if (!shouldStay && userLeagues && Array.isArray(userLeagues) && userLeagues.length > 0) {
      // Find the most recent active league
      const activeLeague = userLeagues.find((league: any) => league.isActive && league.id);
      if (activeLeague && activeLeague.id) {
        console.log('[Dashboard] Redirecting to league waiting room:', activeLeague.id);
        setLocation(`/league/waiting?id=${activeLeague.id}`);
        return;
      }
    }
    
    // Show dashboard with leagues if user has leagues but wants to stay
    if (shouldStay && userLeagues && Array.isArray(userLeagues) && userLeagues.length > 0) {
      console.log('[Dashboard] User has leagues but staying on dashboard');
    }
  }, [userLeagues, setLocation]);

  // Show notification prompt for newly logged in users
  useEffect(() => {
    if (user && permission === 'default') {
      const hasShownBefore = sessionStorage.getItem('notification-prompt-shown');
      if (!hasShownBefore) {
        setShowNotificationPrompt(true);
        sessionStorage.setItem('notification-prompt-shown', 'true');
      }
    }
  }, [user, permission]);

  // Create league mutation
  const createLeagueMutation = useMutation({
    mutationFn: async (data: { name: string; maxTeams: number }) => {
      const response = await fetch("/api/leagues", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to create league");
      }
      return response.json();
    },
    onSuccess: (result: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/leagues"] });
      queryClient.invalidateQueries({ queryKey: ["/api/leagues/user"] });
      setCreateDialogOpen(false);
      setLeagueName("");
      toast({
        title: "League Created!",
        description: `"${result.name}" has been created successfully.`,
      });
      setLocation(`/league/waiting?id=${result.id}`);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create league",
        variant: "destructive",
      });
    },
  });

  // Join league mutation
  const joinLeagueMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch("/api/leagues/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ joinCode }),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to join league");
      }
      return response.json();
    },
    onSuccess: (result: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/leagues"] });
      queryClient.invalidateQueries({ queryKey: ["/api/leagues/user"] });
      setJoinDialogOpen(false);
      setJoinCode("");
      toast({
        title: "Joined League!",
        description: `You've successfully joined "${result.league.name}".`,
      });
      // Navigate to the league waiting room with the correct league ID
      setLocation(`/league/waiting?id=${result.league.id}`);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to join league",
        variant: "destructive",
      });
    },
  });

  const handleCreateLeague = () => {
    if (!leagueName.trim()) {
      toast({
        title: "Error",
        description: "Please enter a league name",
        variant: "destructive",
      });
      return;
    }
    createLeagueMutation.mutate({ name: leagueName.trim(), maxTeams: 6 });
  };

  const handleJoinLeague = () => {
    if (!joinCode.trim()) {
      toast({
        title: "Error",
        description: "Please enter a join code",
        variant: "destructive",
      });
      return;
    }
    joinLeagueMutation.mutate();
  };

  const showWelcomeNotification = () => {
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification("Welcome to Mok Sports! 🏈", {
        body: `Hey ${firstName}! You're all set to receive draft alerts, league updates, and game notifications.`,
        icon: '/icon-192x192.png',
        badge: '/icon-72x72.png',
        tag: 'welcome',
        requireInteraction: false,
        silent: false
      });
    }
  };

  if (!user) {
    return (
      <MainLayout>
        <div className="container mx-auto px-4 py-8 text-center">
          <h1 className="text-2xl font-bold mb-4">Welcome to Mok Sports</h1>
          <p className="text-muted-foreground mb-6">Please sign in to continue</p>
          <div className="space-y-4">
            <Button onClick={() => window.location.href = "/api/auth/google"}>
              Sign in with Google
            </Button>
            {process.env.NODE_ENV === 'development' && (
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">Development Login:</p>
                <Button 
                  variant="outline" 
                  onClick={() => testLogin('9932fcd8-7fbb-49c3-8fbb-f254cff1bb9a')}
                >
                  Login as Sky Evans
                </Button>
              </div>
            )}
          </div>
        </div>
      </MainLayout>
    );
  }

  const firstName = user.name?.split(" ")[0] || "Player";
  const hasLeagues = userLeagues && Array.isArray(userLeagues) && userLeagues.length > 0;
  const urlParams = new URLSearchParams(window.location.search);
  const shouldStayOnDashboard = urlParams.get('stay') === 'true';

  return (
    <MainLayout>
      <div className={`min-h-screen px-4 py-8 relative ${hasLeagues && shouldStayOnDashboard ? '' : 'flex flex-col items-center justify-center'}`}>
        {/* Logout Button */}
        <Button
          variant="ghost"
          size="sm"
          onClick={() => logout()}
          className="absolute top-4 right-4 flex items-center gap-2"
        >
          <LogOut className="w-4 h-4" />
          Logout
        </Button>
        
        <div className={`w-full space-y-8 ${hasLeagues && shouldStayOnDashboard ? 'max-w-6xl' : 'max-w-md'}`}>
          {/* Welcome Header */}
          <div className={`space-y-2 ${hasLeagues && shouldStayOnDashboard ? 'text-left' : 'text-center'}`}>
            <h1 className="text-3xl font-bold text-fantasy-green">
              Welcome, {firstName}!
            </h1>
            <p className="text-muted-foreground">
              {hasLeagues && shouldStayOnDashboard 
                ? "Manage your leagues and track your fantasy performance" 
                : "Ready to draft entire teams? Let's get started."}
            </p>
          </div>
          
          {/* Notification Prompt */}
          {showNotificationPrompt && (
            <div className="mb-6">
              <NotificationPrompt
                onPermissionGranted={() => {
                  setShowNotificationPrompt(false);
                  // Send welcome notification
                  showWelcomeNotification();
                }}
                onDismiss={() => setShowNotificationPrompt(false)}
              />
            </div>
          )}

          {/* League Management Dashboard - Show if user has leagues and wants to stay */}
          {hasLeagues && shouldStayOnDashboard && (
            <div className="space-y-6">
              {/* League Analytics Cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium flex items-center">
                      <Trophy className="w-4 h-4 mr-2 text-fantasy-green" />
                      Active Leagues
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{userLeagues?.length || 0}</div>
                    <p className="text-xs text-muted-foreground">Total leagues joined</p>
                  </CardContent>
                </Card>
                
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium flex items-center">
                      <BarChart3 className="w-4 h-4 mr-2 text-blue-500" />
                      Drafts Completed
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">
                      {leagueStats?.draftsCompleted || 0}
                    </div>
                    <p className="text-xs text-muted-foreground">Successful drafts</p>
                  </CardContent>
                </Card>
                
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium flex items-center">
                      <TrendingUp className="w-4 h-4 mr-2 text-green-500" />
                      Win Rate
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">
                      {leagueStats?.winRate ? `${Math.round(leagueStats.winRate)}%` : 'N/A'}
                    </div>
                    <p className="text-xs text-muted-foreground">League performance</p>
                  </CardContent>
                </Card>
              </div>

              {/* User's Leagues */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <Users className="w-5 h-5 mr-2" />
                    Your Leagues
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {userLeagues?.map((league: any) => (
                      <div key={league.id} className="flex items-center justify-between p-3 bg-secondary/20 rounded-lg border">
                        <div className="flex items-center space-x-3">
                          <div>
                            <div className="font-semibold">{league.name}</div>
                            <div className="text-sm text-muted-foreground">
                              {league.memberCount}/{league.maxTeams} members
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Badge variant={league.draftStatus === 'completed' ? 'default' : league.draftStarted ? 'destructive' : 'secondary'}>
                            {league.draftStatus === 'completed' ? 'Complete' : league.draftStarted ? 'Drafting' : 'Waiting'}
                          </Badge>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setLocation(`/league/waiting?id=${league.id}`)}
                          >
                            {league.draftStatus === 'completed' ? 'View Results' : 'Enter League'}
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Main Action Buttons - Show only if no leagues or first time */}
          {(!hasLeagues || !shouldStayOnDashboard) && (
            <div className="space-y-4">
            {/* Create League Button */}
            <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
              <DialogTrigger asChild>
                <Button 
                  className="w-full h-14 text-lg font-semibold"
                  size="lg"
                >
                  <Plus className="w-6 h-6 mr-3" />
                  Create League
                </Button>
              </DialogTrigger>
              <DialogContent onOpenAutoFocus={(e) => e.preventDefault()}>
                <DialogHeader>
                  <DialogTitle>Create New League</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="league-name">League Name</Label>
                    <Input
                      id="league-name"
                      value={leagueName}
                      onChange={(e) => setLeagueName(e.target.value)}
                      placeholder="Enter league name"
                      className="mt-1"
                      autoFocus={false}
                      autoComplete="off"
                    />
                  </div>
                  <Button
                    onClick={handleCreateLeague}
                    disabled={createLeagueMutation.isPending}
                    className="w-full"
                  >
                    {createLeagueMutation.isPending ? "Creating..." : "Create League"}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>

            {/* Join League Button */}
            <Dialog open={joinDialogOpen} onOpenChange={setJoinDialogOpen}>
              <DialogTrigger asChild>
                <Button 
                  variant="outline" 
                  className="w-full h-14 text-lg font-semibold border-2"
                  size="lg"
                >
                  <UserPlus className="w-6 h-6 mr-3" />
                  Join League
                </Button>
              </DialogTrigger>
              <DialogContent onOpenAutoFocus={(e) => e.preventDefault()}>
                <DialogHeader>
                  <DialogTitle>Join Existing League</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="join-code">League Code</Label>
                    <Input
                      id="join-code"
                      value={joinCode}
                      onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                      placeholder="Enter 6-letter code"
                      maxLength={6}
                      className="mt-1 text-center text-lg font-mono tracking-wider"
                      autoFocus={false}
                      autoComplete="off"
                    />
                  </div>
                  <Button
                    onClick={handleJoinLeague}
                    disabled={joinLeagueMutation.isPending}
                    className="w-full"
                  >
                    {joinLeagueMutation.isPending ? "Joining..." : "Join League"}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
          )}

          {/* Quick Actions for existing users */}
          {hasLeagues && shouldStayOnDashboard && (
            <div className="flex gap-4">
              <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
                <DialogTrigger asChild>
                  <Button className="flex-1">
                    <Plus className="w-4 h-4 mr-2" />
                    Create New League
                  </Button>
                </DialogTrigger>
                <DialogContent onOpenAutoFocus={(e) => e.preventDefault()}>
                  <DialogHeader>
                    <DialogTitle>Create New League</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="league-name">League Name</Label>
                      <Input
                        id="league-name"
                        value={leagueName}
                        onChange={(e) => setLeagueName(e.target.value)}
                        placeholder="Enter league name"
                        className="mt-1"
                        autoFocus={false}
                        autoComplete="off"
                      />
                    </div>
                    <Button
                      onClick={handleCreateLeague}
                      disabled={createLeagueMutation.isPending}
                      className="w-full"
                    >
                      {createLeagueMutation.isPending ? "Creating..." : "Create League"}
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>

              <Dialog open={joinDialogOpen} onOpenChange={setJoinDialogOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline" className="flex-1">
                    <UserPlus className="w-4 h-4 mr-2" />
                    Join League
                  </Button>
                </DialogTrigger>
                <DialogContent onOpenAutoFocus={(e) => e.preventDefault()}>
                  <DialogHeader>
                    <DialogTitle>Join Existing League</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="join-code">League Code</Label>
                      <Input
                        id="join-code"
                        value={joinCode}
                        onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                        placeholder="Enter 6-letter code"
                        maxLength={6}
                        className="mt-1 text-center text-lg font-mono tracking-wider"
                        autoFocus={false}
                        autoComplete="off"
                      />
                    </div>
                    <Button
                      onClick={handleJoinLeague}
                      disabled={joinLeagueMutation.isPending}
                      className="w-full"
                    >
                      {joinLeagueMutation.isPending ? "Joining..." : "Join League"}
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          )}

          {showNotificationPrompt && (
            <div className="mt-8">
              <NotificationPrompt
                onPermissionGranted={() => {
                  showWelcomeNotification();
                  setShowNotificationPrompt(false);
                }}
                onDismiss={() => setShowNotificationPrompt(false)}
                forceShow={false}
              />
            </div>
          )}
          
          {/* Persistent Push Notification Manager - background operation only */}
          <PersistentPushManager showManualControls={false} />
          
          {/* Debug panels removed for production - uncomment below to re-enable */}
          {/* <PWADebugPanel /> */}
          {/* <PushDiagnosticPanel /> */}
        </div>
      </div>
    </MainLayout>
  );
}