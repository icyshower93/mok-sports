import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { MainLayout } from "@/components/layout/main-layout";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, UserPlus } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import { usePushNotifications } from "@/hooks/use-push-notifications";
import { NotificationPrompt } from "@/components/notification-prompt";

export default function DashboardPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();
  const { permission } = usePushNotifications();
  
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [joinDialogOpen, setJoinDialogOpen] = useState(false);
  const [leagueName, setLeagueName] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [showNotificationPrompt, setShowNotificationPrompt] = useState(false);

  // Show notification prompt for newly logged in users
  useEffect(() => {
    if (user && permission === 'default') {
      const loginTime = sessionStorage.getItem('login-time');
      const promptShown = sessionStorage.getItem('notification-prompt-shown');
      
      if (loginTime && !promptShown) {
        const timeSinceLogin = Date.now() - parseInt(loginTime);
        if (timeSinceLogin < 5 * 60 * 1000) {
          setShowNotificationPrompt(true);
          sessionStorage.setItem('notification-prompt-shown', 'true');
        }
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
        description: `"${result.league.name}" has been created successfully.`,
      });
      setLocation(`/league/waiting?id=${result.league.id}`);
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
      <div className="min-h-screen flex flex-col items-center justify-center px-4 py-8">
        <div className="w-full max-w-lg space-y-8">
          {/* Welcome Header */}
          <div className="text-center space-y-4">
            <div className="relative">
              <h1 className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-fantasy-green to-accent text-transparent bg-clip-text">
                Welcome, {firstName}!
              </h1>
              <div className="absolute -inset-1 bg-gradient-to-r from-fantasy-green/20 to-accent/20 blur-xl opacity-30 animate-pulse"></div>
            </div>
            <p className="text-lg text-muted-foreground max-w-md mx-auto">
              Ready to draft entire teams? Create your league and dominate the competition.
            </p>
          </div>
          
          {/* Notification Prompt */}
          {showNotificationPrompt && (
            <div className="mb-6">
              <NotificationPrompt
                onPermissionGranted={() => {
                  setShowNotificationPrompt(false);
                  showWelcomeNotification();
                }}
                onDismiss={() => setShowNotificationPrompt(false)}
              />
            </div>
          )}

          {/* Main Action Buttons */}
          <div className="space-y-6">
            {/* Create League Button */}
            <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
              <DialogTrigger asChild>
                <Button 
                  className="w-full h-16 text-lg font-bold bg-gradient-to-r from-fantasy-green to-fantasy-green/80 hover:from-fantasy-green/90 hover:to-fantasy-green/70 text-white shadow-xl hover:shadow-2xl transition-all duration-300 ease-out hover:scale-105 border-0"
                  size="lg"
                >
                  <Plus className="w-7 h-7 mr-3" />
                  Create League
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-md">
                <DialogHeader>
                  <DialogTitle className="text-xl font-bold">Create New League</DialogTitle>
                </DialogHeader>
                <div className="space-y-6">
                  <div>
                    <Label htmlFor="league-name" className="text-sm font-medium">League Name</Label>
                    <Input
                      id="league-name"
                      value={leagueName}
                      onChange={(e) => setLeagueName(e.target.value)}
                      placeholder="Enter league name"
                      className="mt-2 h-12 text-lg border-2 focus:border-fantasy-green transition-colors"
                      autoFocus={false}
                      inputMode="none"
                      autoComplete="off"
                    />
                  </div>
                  <Button
                    onClick={handleCreateLeague}
                    disabled={createLeagueMutation.isPending}
                    className="w-full h-12 font-semibold bg-fantasy-green hover:bg-fantasy-green/90"
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
                  className="w-full h-16 text-lg font-bold border-2 border-accent/30 hover:border-accent/60 text-foreground bg-card/50 hover:bg-card/80 shadow-lg hover:shadow-xl transition-all duration-300 ease-out hover:scale-105"
                  size="lg"
                >
                  <UserPlus className="w-7 h-7 mr-3" />
                  Join League
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-md">
                <DialogHeader>
                  <DialogTitle className="text-xl font-bold">Join Existing League</DialogTitle>
                </DialogHeader>
                <div className="space-y-6">
                  <div>
                    <Label htmlFor="join-code" className="text-sm font-medium">League Code</Label>
                    <Input
                      id="join-code"
                      value={joinCode}
                      onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                      placeholder="Enter 6-letter code"
                      maxLength={6}
                      className="mt-2 h-12 text-center text-xl font-mono tracking-wider border-2 focus:border-accent transition-colors"
                      autoFocus={false}
                      inputMode="none"
                      autoComplete="off"
                    />
                  </div>
                  <Button
                    onClick={handleJoinLeague}
                    disabled={joinLeagueMutation.isPending}
                    className="w-full h-12 font-semibold bg-accent hover:bg-accent/90"
                  >
                    {joinLeagueMutation.isPending ? "Joining..." : "Join League"}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>

          {permission === 'default' && !showNotificationPrompt && (
            <div className="mt-8">
              <NotificationPrompt
                onPermissionGranted={() => showWelcomeNotification()}
                onDismiss={() => {}}
              />
            </div>
          )}
        </div>
      </div>
    </MainLayout>
  );
}