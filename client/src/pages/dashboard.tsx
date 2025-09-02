import { useState, useEffect, startTransition, useMemo } from "react";
import { useAuth } from "@/features/auth/useAuth";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { MainLayout } from "@/components/layout/main-layout";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, UserPlus, LogOut, Trophy, Users, Clock, BarChart3, TrendingUp, Play, ChevronRight } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import { setLastLeagueId } from "@/hooks/useLastLeague";
import { apiRequest } from "@/features/query/api";
import { useHasLeague } from "@/features/leagues/useHasLeague";
import { apiFetch } from "@/lib/api";

const enableDebugUI =
  (import.meta as any).env?.VITE_ENABLE_DEBUG_UI === "true" ||
  (typeof process !== "undefined" && (process as any).env?.VITE_ENABLE_DEBUG_UI === "true");

interface League {
  id: string;
  name: string;
  joinCode: string;
  memberCount: number;
  maxTeams: number;
  creatorId: string;
  draftStarted: boolean;
  draftId: string | null;
  updatedAt: string;
  createdAt: string;
}

export default function DashboardPage() {
  const { user, logout } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();

  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [joinDialogOpen, setJoinDialogOpen] = useState(false);
  const [leagueName, setLeagueName] = useState("");
  const [joinCode, setJoinCode] = useState("");

  // 🔌 Lazy-load debug panels only if enabled
  const [DebugPanels, setDebugPanels] = useState<null | React.ComponentType>(null);
  useEffect(() => {
    let cancelled = false;
    if (enableDebugUI) {
      // Dynamic import to avoid TDZ and heavy deps at module eval
      Promise.all([
        import("@/components/pwa-debug-panel").catch(() => ({ PWADebugPanel: () => null })),
        import("@/components/push-diagnostic-panel").catch(() => ({ PushDiagnosticPanel: () => null })),
      ]).then(([PWA, Push]) => {
        if (cancelled) return;
        const Panel = () => (
          <div className="mt-8 space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">PWA Debug Panel</CardTitle>
              </CardHeader>
              <CardContent>
                <PWA.PWADebugPanel />
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Push Notification Diagnostics</CardTitle>
              </CardHeader>
              <CardContent>
                <Push.PushDiagnosticPanel user={user} />
              </CardContent>
            </Card>
          </div>
        );
        setDebugPanels(() => Panel);
      });
    }
    return () => { cancelled = true; };
  }, [user]);

  // Check URL params for stay parameter
  const urlParams = new URLSearchParams(window.location.search);
  const shouldStayOnDashboard = urlParams.get('stay') === 'true';

  // Use centralized league check
  const { hasLeague, isLoading: leaguesLoading, leagues = [] } = useHasLeague();

  // League creation mutation
  const createLeagueMutation = useMutation({
    mutationFn: async (name: string) => {
      // Ensure proper payload format
      const payload = {
        name: name.trim(),
        maxTeams: 6
      };

      console.log("[CreateLeague] Sending payload:", payload);

      // Use unified API helper with consistent auth
      const res = await apiFetch('/api/leagues', {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      console.log("[CreateLeague] Response status:", res.status);

      if (!res.ok) {
        // Try JSON first for nice messages (e.g., duplicate name / validation)
        let details = '';
        try {
          const j = await res.json();
          details = j?.message || (Array.isArray(j?.errors) ? j.errors[0]?.message : '');
        } catch {
          details = await res.text().catch(() => '');
        }
        console.error("[CreateLeague] Error response:", details);
        throw new Error(details || `Create league failed (${res.status})`);
      }

      const result = await res.json();
      console.log("[CreateLeague] Success result:", result);
      return result;
    },
    onSuccess: (result: any) => {
      console.log("[CreateLeague] Success - server returned:", result);
      
      toast({
        title: "Success!",
        description: "League created successfully",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/user/leagues'] });
      
      // Only close dialog and navigate after successful response
      setCreateDialogOpen(false);
      setLeagueName("");
      
      // Navigate to league waiting room
      // Server returns league object directly, not wrapped in { league: ... }
      const leagueId = result?.id;
      if (leagueId) {
        console.log("[CreateLeague] Navigating to waiting room with leagueId:", leagueId);
        setLastLeagueId(leagueId);
        startTransition(() => {
          setLocation(`/league/waiting?id=${leagueId}`);
        });
      } else {
        console.error("[CreateLeague] No league ID in response:", result);
        toast({
          title: "Warning",
          description: "League created but navigation failed - check your leagues page",
          variant: "destructive",
        });
      }
    },
    onError: (error: any) => {
      console.error("[CreateLeague] Mutation error:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to create league",
        variant: "destructive",
      });
      // Don't close dialog on error so user can retry
    }
  });

  // League join mutation
  const joinLeagueMutation = useMutation({
    mutationFn: async (code: string) => {
      return apiRequest("POST", "/api/leagues/join", { joinCode: code });
    },
    onSuccess: (result: any) => {
      toast({
        title: "Success!",
        description: "You've joined the league successfully",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/user/leagues'] });
      setJoinDialogOpen(false);
      setJoinCode("");
      // Navigate to league waiting room
      if (result?.league?.id) {
        setLastLeagueId(result.league.id);
        startTransition(() => {
          setLocation(`/league/waiting?id=${result.league.id}`);
        });
      }
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to join league",
        variant: "destructive",
      });
    }
  });

  const handleCreateLeague = (e: React.FormEvent) => {
    e.preventDefault();
    if (leagueName.trim()) {
      createLeagueMutation.mutate(leagueName.trim());
    }
  };

  const handleJoinLeague = (e: React.FormEvent) => {
    e.preventDefault();
    if (joinCode.trim()) {
      joinLeagueMutation.mutate(joinCode.trim().toUpperCase());
    }
  };

  const goToLeague = (leagueId: string) => {
    setLastLeagueId(leagueId);
    startTransition(() => {
      setLocation(`/league/waiting?id=${leagueId}`);
    });
  };

  const goToDraft = (leagueId: string, draftId: string) => {
    setLastLeagueId(leagueId);
    startTransition(() => {
      setLocation(`/draft/${draftId}`);
    });
  };

  if (!user) {
    return (
      <MainLayout>
        <div className="min-h-[70vh] flex items-center justify-center">
          <div>Loading...</div>
        </div>
      </MainLayout>
    );
  }

  const firstName = user.name?.split(" ")[0] || "Player";

  // If user has no leagues, show minimal welcome screen
  if (hasLeague === false) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-background to-muted/30 flex items-center justify-center">
        <div className="mx-auto max-w-md p-6 text-center">
          <h1 className="text-2xl font-semibold mb-4">Welcome to Mok Sports</h1>
          <p className="text-sm text-muted-foreground mb-6">Create a new league or join an existing one to get started.</p>
          <div className="grid gap-3">
            <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
              <DialogTrigger asChild>
                <Button className="w-full">
                  <Plus className="w-4 h-4 mr-2" />
                  Create League
                </Button>
              </DialogTrigger>
              <DialogContent aria-describedby="create-league-desc">
                <DialogHeader>
                  <DialogTitle>Create New League</DialogTitle>
                  <DialogDescription id="create-league-desc">
                    Create a new 6-player fantasy league. You'll need to invite 5 other players to start drafting.
                  </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleCreateLeague} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="leagueName">League Name</Label>
                    <Input
                      id="leagueName"
                      placeholder="Enter league name"
                      value={leagueName}
                      onChange={(e) => setLeagueName(e.target.value)}
                      maxLength={50}
                      data-testid="input-league-name"
                    />
                    {leagueName.trim().length > 50 && (
                      <p className="text-xs text-destructive">League name must be 50 characters or less</p>
                    )}
                    {leagues && leagues.some(league => league.name.toLowerCase() === leagueName.trim().toLowerCase()) && (
                      <p className="text-xs text-amber-600 dark:text-amber-400">
                        ⚠️ You already have a league with this name
                      </p>
                    )}
                  </div>
                  <Button 
                    type="submit" 
                    className="w-full"
                    disabled={!leagueName.trim() || leagueName.trim().length > 50 || createLeagueMutation.isPending}
                    data-testid="button-create-league"
                  >
                    {createLeagueMutation.isPending ? "Creating..." : "Create League"}
                  </Button>
                </form>
              </DialogContent>
            </Dialog>

            <Dialog open={joinDialogOpen} onOpenChange={setJoinDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" className="w-full">
                  <UserPlus className="w-4 h-4 mr-2" />
                  Join League
                </Button>
              </DialogTrigger>
              <DialogContent aria-describedby="join-league-desc">
                <DialogHeader>
                  <DialogTitle>Join League</DialogTitle>
                  <DialogDescription id="join-league-desc">
                    Enter the 6-character league code to join an existing league.
                  </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleJoinLeague} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="joinCode">League Code</Label>
                    <Input
                      id="joinCode"
                      placeholder="Enter 6-character code"
                      value={joinCode}
                      onChange={(e) => setJoinCode(e.target.value)}
                      maxLength={6}
                      data-testid="input-join-code"
                    />
                  </div>
                  <Button 
                    type="submit" 
                    className="w-full"
                    disabled={!joinCode.trim() || joinCode.trim().length !== 6 || joinLeagueMutation.isPending}
                    data-testid="button-join-league"
                  >
                    {joinLeagueMutation.isPending ? "Joining..." : "Join League"}
                  </Button>
                </form>
              </DialogContent>
            </Dialog>
          </div>
          
          <Button variant="ghost" onClick={logout} className="text-muted-foreground mt-6">
            <LogOut className="w-4 h-4 mr-2" />
            Logout
          </Button>
        </div>
      </div>
    );
  }

  // For users with leagues, show the full dashboard
  return (
    <MainLayout>
      <div className="p-4 max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">
              Welcome, {firstName}!
            </h1>
            <p className="text-muted-foreground">
              {hasLeague && shouldStayOnDashboard 
                ? "Manage your leagues and track your fantasy performance" 
                : "Ready to draft entire teams? Let's get started."}
            </p>
          </div>
          <Button variant="ghost" onClick={logout} className="text-muted-foreground">
            <LogOut className="w-4 h-4 mr-2" />
            Logout
          </Button>
        </div>

        {/* Quick Actions */}
        <div className="flex gap-3">
          <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button className="flex-1 sm:flex-none">
                <Plus className="w-4 h-4 mr-2" />
                Create League
              </Button>
            </DialogTrigger>
            <DialogContent aria-describedby="create-league-quick-desc">
              <DialogHeader>
                <DialogTitle>Create New League</DialogTitle>
                <DialogDescription id="create-league-quick-desc">
                  Create a new 6-player fantasy league. You'll need to invite 5 other players to start drafting.
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleCreateLeague} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="leagueName">League Name</Label>
                  <Input
                    id="leagueName"
                    placeholder="Enter league name"
                    value={leagueName}
                    onChange={(e) => setLeagueName(e.target.value)}
                    maxLength={50}
                    data-testid="input-league-name-quick"
                  />
                  {leagueName.trim().length > 50 && (
                    <p className="text-xs text-destructive">League name must be 50 characters or less</p>
                  )}
                  {leagues && leagues.some(league => league.name.toLowerCase() === leagueName.trim().toLowerCase()) && (
                    <p className="text-xs text-amber-600 dark:text-amber-400">
                      ⚠️ You already have a league with this name
                    </p>
                  )}
                </div>
                <Button 
                  type="submit" 
                  className="w-full"
                  disabled={!leagueName.trim() || leagueName.trim().length > 50 || createLeagueMutation.isPending}
                  data-testid="button-create-league-quick"
                >
                  {createLeagueMutation.isPending ? "Creating..." : "Create League"}
                </Button>
              </form>
            </DialogContent>
          </Dialog>

          <Dialog open={joinDialogOpen} onOpenChange={setJoinDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" className="flex-1 sm:flex-none">
                <UserPlus className="w-4 h-4 mr-2" />
                Join League
              </Button>
            </DialogTrigger>
            <DialogContent aria-describedby="join-league-quick-desc">
              <DialogHeader>
                <DialogTitle>Join League</DialogTitle>
                <DialogDescription id="join-league-quick-desc">
                  Enter the 6-character league code to join an existing league.
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleJoinLeague} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="joinCode">League Code</Label>
                  <Input
                    id="joinCode"
                    placeholder="Enter 6-character code"
                    value={joinCode}
                    onChange={(e) => setJoinCode(e.target.value)}
                    maxLength={6}
                  />
                </div>
                <Button 
                  type="submit" 
                  className="w-full"
                  disabled={!joinCode.trim() || joinLeagueMutation.isPending}
                >
                  {joinLeagueMutation.isPending ? "Joining..." : "Join League"}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {/* Your Leagues */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Trophy className="w-5 h-5 text-primary" />
              Your Leagues
            </CardTitle>
          </CardHeader>
          <CardContent>
            {leaguesLoading ? (
              <div className="text-center py-8">
                <div className="w-6 h-6 animate-spin rounded-full border border-muted-foreground border-t-transparent mx-auto" />
                <p className="text-sm text-muted-foreground mt-2">Loading leagues...</p>
              </div>
            ) : leagues.length === 0 ? (
              <div className="text-center py-8">
                <div className="text-sm text-muted-foreground mb-4">
                  No leagues yet — create or join one above to get started!
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                {leagues.map((league) => (
                  <div key={league.id} className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <div className="font-medium">{league.name}</div>
                        <Badge variant="outline" className="text-xs">
                          <Users className="w-3 h-3 mr-1" />
                          {league.memberCount}/{league.maxTeams}
                        </Badge>
                        {league.draftStarted && (
                          <Badge variant="default" className="text-xs bg-green-600">
                            <Play className="w-3 h-3 mr-1" />
                            Draft Active
                          </Badge>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Updated {new Date(league.updatedAt).toLocaleDateString()}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      {league.draftStarted && league.draftId ? (
                        <Button 
                          size="sm" 
                          onClick={() => goToDraft(league.id, league.draftId!)}
                          className="bg-green-600 hover:bg-green-700"
                        >
                          <Play className="w-4 h-4 mr-1" />
                          Resume Draft
                        </Button>
                      ) : (
                        <Button 
                          size="sm" 
                          variant="outline"
                          onClick={() => goToLeague(league.id)}
                        >
                          Go to League
                          <ChevronRight className="w-4 h-4 ml-1" />
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Analytics Section - Placeholder for future features */}
        {hasLeague && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardContent className="p-4 text-center">
                <BarChart3 className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
                <div className="text-sm text-muted-foreground">Season Analytics</div>
                <div className="text-xs text-muted-foreground mt-1">Coming Soon</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <TrendingUp className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
                <div className="text-sm text-muted-foreground">Skins Won</div>
                <div className="text-xs text-muted-foreground mt-1">Coming Soon</div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Debug Panels - Only loaded when enabled */}
        {enableDebugUI && DebugPanels ? <DebugPanels /> : null}
      </div>
    </MainLayout>
  );
}