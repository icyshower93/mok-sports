import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { MainLayout } from "@/components/layout/main-layout";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, UserPlus, LogOut } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import { usePushNotifications } from "@/hooks/use-push-notifications";
import { NotificationPrompt } from "@/components/notification-prompt";
import { PWADebugPanel } from "@/components/pwa-debug-panel";

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
  const { data: userLeagues } = useQuery({
    queryKey: ['/api/leagues/user'],
    enabled: !!user,
  });

  // Redirect to league waiting room if user is already in a league
  useEffect(() => {
    // Check if user explicitly wants to stay on dashboard (e.g., after leaving a league)
    const urlParams = new URLSearchParams(window.location.search);
    const shouldStay = urlParams.get('stay') === 'true';
    
    if (!shouldStay && userLeagues && Array.isArray(userLeagues) && userLeagues.length > 0) {
      // Find the most recent active league
      const activeLeague = userLeagues.find((league: any) => league.isActive && league.id);
      if (activeLeague && activeLeague.id) {
        setLocation(`/league/waiting?id=${activeLeague.id}`);
        return;
      }
    }
  }, [userLeagues, setLocation]);

  // Show notification prompt for newly logged in users (ALWAYS SHOW FOR TESTING)
  useEffect(() => {
    console.warn('[CRITICAL DEBUG] Dashboard notification prompt effect:', {
      hasUser: !!user,
      userEmail: user?.email,
      permission,
      shouldShow: user && permission === 'default'
    });
    
    if (user && permission === 'default') {
      console.warn('[CRITICAL DEBUG] Setting showNotificationPrompt to true for testing');
      setShowNotificationPrompt(true);
      // Remove session storage restrictions for testing
      // sessionStorage.setItem('notification-prompt-shown', 'true');
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
    return null;
  }

  const firstName = user.name?.split(" ")[0] || "Player";

  return (
    <MainLayout>
      <div className="min-h-screen flex flex-col items-center justify-center px-4 py-8 relative">
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
        
        <div className="w-full max-w-md space-y-8">
          {/* Welcome Header */}
          <div className="text-center space-y-2">
            <h1 className="text-3xl font-bold text-fantasy-green">
              Welcome, {firstName}!
            </h1>
            <p className="text-muted-foreground">
              Ready to draft entire teams? Let's get started.
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

          {/* Main Action Buttons */}
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

          {(permission === 'default' || permission === 'denied') && !showNotificationPrompt && (
            <div className="mt-8">
              <NotificationPrompt
                onPermissionGranted={() => showWelcomeNotification()}
                onDismiss={() => {}}
                forceShow={permission === 'denied'}
              />
            </div>
          )}
          
          {/* PWA Debug Panel for iOS testing */}
          <PWADebugPanel />
        </div>
      </div>
    </MainLayout>
  );
}