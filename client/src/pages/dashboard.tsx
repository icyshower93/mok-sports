import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { MainLayout } from "@/components/layout/main-layout";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, UserPlus, Bell, X, CheckCircle2, Loader2 } from "lucide-react";
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
      <div className="min-h-screen mobile-container">
        <div className="flex flex-col h-full">
          {/* Header Section */}
          <div className="text-center pt-12 pb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-primary rounded-2xl shadow-lg mb-6 animate-bounce-in">
              <Trophy className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-display text-foreground mb-3 animate-fade-in">
              Hey {firstName}! 👋
            </h1>
            <p className="text-body text-lg animate-fade-in animate-stagger-1">
              Ready to draft entire teams and dominate your league?
            </p>
          </div>
          
          {/* Notification Banner */}
          {showNotificationPrompt && (
            <div className="mb-8 animate-slide-up">
              <div className="fantasy-card p-6 bg-primary text-primary-foreground relative">
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute right-3 top-3 h-8 w-8 text-white hover:bg-white/20"
                  onClick={() => setShowNotificationPrompt(false)}
                >
                  <X className="h-4 w-4" />
                </Button>
                
                <div className="flex items-start space-x-4">
                  <div className="flex-shrink-0">
                    <div className="flex items-center justify-center w-12 h-12 bg-white/20 rounded-2xl">
                      <Bell className="w-6 h-6 text-white" />
                    </div>
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <h3 className="text-lg font-semibold text-white mb-1">
                      Stay in the Game! 🏈
                    </h3>
                    <p className="text-white/90 text-sm mb-4">
                      Get instant alerts for draft starts, trades, and league updates so you never miss the action.
                    </p>
                    
                    <Button 
                      onClick={() => {
                        setShowNotificationPrompt(false);
                        showWelcomeNotification();
                      }} 
                      className="bg-white text-primary hover:bg-white/90 font-medium px-6 py-2 rounded-xl transition-all duration-300"
                      size="sm"
                    >
                      <CheckCircle2 className="w-4 h-4 mr-2" />
                      Enable Notifications
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Main Action Section */}
          <div className="flex-1 flex flex-col justify-center space-y-6 pb-12">
            {/* Create League Button */}
            <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
              <DialogTrigger asChild>
                <div className="fantasy-card-interactive p-8 text-center animate-fade-in animate-stagger-2">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-green-500 rounded-2xl mb-4">
                    <Plus className="w-8 h-8 text-white" />
                  </div>
                  <h3 className="text-title text-foreground mb-2">Create League</h3>
                  <p className="text-body mb-6">Start your own fantasy league and invite friends</p>
                  <div className="btn-fantasy-primary inline-flex items-center justify-center w-full">
                    <span className="text-lg font-semibold">Create New League</span>
                  </div>
                </div>
              </DialogTrigger>
              <DialogContent className="fantasy-card border-0 shadow-2xl">
                <DialogHeader className="text-center pb-6">
                  <DialogTitle className="text-headline text-foreground">Create New League</DialogTitle>
                  <p className="text-body mt-2">Give your league an awesome name!</p>
                </DialogHeader>
                <div className="space-y-6">
                  <div>
                    <Label htmlFor="league-name" className="text-foreground font-semibold mb-2 block">
                      League Name
                    </Label>
                    <Input
                      id="league-name"
                      value={leagueName}
                      onChange={(e) => setLeagueName(e.target.value)}
                      placeholder="e.g., Championship Warriors"
                      className="input-fantasy"
                      autoFocus={false}
                    />
                  </div>
                  <Button
                    onClick={handleCreateLeague}
                    disabled={createLeagueMutation.isPending}
                    className="btn-fantasy-primary w-full"
                  >
                    {createLeagueMutation.isPending ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin mr-2" />
                        Creating League...
                      </>
                    ) : (
                      "Create League"
                    )}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>

            {/* Join League Button */}
            <Dialog open={joinDialogOpen} onOpenChange={setJoinDialogOpen}>
              <DialogTrigger asChild>
                <div className="fantasy-card-interactive p-8 text-center animate-fade-in animate-stagger-3">
                  <div className="inline-flex items-center justify-center w-16 h-16 bg-primary rounded-2xl mb-4">
                    <UserPlus className="w-8 h-8 text-white" />
                  </div>
                  <h3 className="text-title text-foreground mb-2">Join League</h3>
                  <p className="text-body mb-6">Enter a league code to join your friends</p>
                  <div className="btn-fantasy-secondary inline-flex items-center justify-center w-full">
                    <span className="text-lg font-semibold">Join Existing League</span>
                  </div>
                </div>
              </DialogTrigger>
              <DialogContent className="fantasy-card border-0 shadow-2xl">
                <DialogHeader className="text-center pb-6">
                  <DialogTitle className="text-headline text-foreground">Join League</DialogTitle>
                  <p className="text-body mt-2">Enter the 6-letter code from your friend</p>
                </DialogHeader>
                <div className="space-y-6">
                  <div>
                    <Label htmlFor="join-code" className="text-foreground font-semibold mb-2 block">
                      League Code
                    </Label>
                    <Input
                      id="join-code"
                      value={joinCode}
                      onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                      placeholder="ABC123"
                      maxLength={6}
                      className="input-fantasy text-center text-2xl font-mono tracking-widest"
                      autoFocus={false}
                    />
                  </div>
                  <Button
                    onClick={handleJoinLeague}
                    disabled={joinLeagueMutation.isPending}
                    className="btn-fantasy-primary w-full"
                  >
                    {joinLeagueMutation.isPending ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin mr-2" />
                        Joining League...
                      </>
                    ) : (
                      "Join League"
                    )}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>

          {/* Subtle Notification Reminder */}
          {permission === 'default' && !showNotificationPrompt && (
            <div className="pb-8">
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