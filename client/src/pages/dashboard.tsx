import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { MainLayout } from "@/components/layout/main-layout";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, UserPlus, RefreshCw, Bell } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import { usePushNotifications } from "@/hooks/use-push-notifications";


interface League {
  id: string;
  name: string;
  joinCode: string;
  maxTeams: number;
  memberCount: number;
  isCreator: boolean;
}

export default function DashboardPage() {
  // All hooks must be declared at the very top, before any conditionals
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();
  const { requestPermission, permission, isSupported } = usePushNotifications();

  
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [joinDialogOpen, setJoinDialogOpen] = useState(false);
  const [leagueName, setLeagueName] = useState("");
  const [joinCode, setJoinCode] = useState("");

  // Query for user leagues
  const userLeaguesQuery = useQuery<League[]>({
    queryKey: ['/api/leagues/user'],
    enabled: !!user,
  });

  // Create league mutation
  const createLeagueMutation = useMutation({
    mutationFn: async (data: { name: string; maxTeams: number }) => {
      const response = await fetch('/api/leagues', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(data),
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to create league');
      }
      
      return response.json();
    },
    onSuccess: (newLeague) => {
      queryClient.invalidateQueries({ queryKey: ["/api/leagues"] });
      queryClient.invalidateQueries({ queryKey: ["/api/leagues/user"] });
      setCreateDialogOpen(false);
      setLeagueName("");
      toast({
        title: "League Created!",
        description: `Your league "${newLeague.name}" has been created successfully.`,
      });
      setLocation(`/league/waiting?id=${newLeague.id}`);
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
    mutationFn: async (code: string) => {
      const response = await fetch('/api/leagues/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ joinCode: code }),
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to join league');
      }
      
      return response.json();
    },
    onSuccess: (result) => {
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

  // Auto-redirect disabled - users should manually choose league action

  // Handle form submissions
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
    joinLeagueMutation.mutate(joinCode.trim());
  };



  // Early returns after all hooks
  if (!user) {
    return null;
  }

  if (userLeaguesQuery.isLoading) {
    return (
      <MainLayout>
        <div className="min-h-[70vh] flex items-center justify-center">
          <div className="text-center">
            <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-4 text-fantasy-green" />
            <p className="text-muted-foreground">Checking your leagues...</p>
          </div>
        </div>
      </MainLayout>
    );
  }



  const firstName = user.name.split(" ")[0];
  const userLeagues = userLeaguesQuery.data || [];

  return (
    <>

      <MainLayout>
        <div className="max-w-4xl mx-auto space-y-8">
        {/* Welcome Section */}
        <div className="text-center space-y-4">
          <h1 className="text-4xl font-bold text-foreground">
            Welcome back, {firstName}!
          </h1>
          <p className="text-xl text-muted-foreground">
            Ready to draft your dream team?
          </p>
        </div>

        {/* Debug notification section - temporary */}
        <div className="text-center mb-4">
          <Button 
            onClick={requestPermission} 
            variant="outline" 
            size="sm" 
            className="text-xs"
          >
            <Bell className="w-3 h-3 mr-1" />
            Test Notification Permission ({permission}) - {isSupported ? 'Supported' : 'Not supported'}
          </Button>
        </div>

        {/* Action Cards */}
        <div className="grid md:grid-cols-2 gap-6 max-w-2xl mx-auto">
          {/* Create League Card */}
          <div className="bg-card border border-border rounded-lg p-6 space-y-4">
            <div className="text-center space-y-3">
              <div className="w-16 h-16 bg-fantasy-green/10 rounded-full flex items-center justify-center mx-auto">
                <Plus className="w-8 h-8 text-fantasy-green" />
              </div>
              <h3 className="text-xl font-semibold text-foreground">Create League</h3>
            </div>
            
            <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
              <DialogTrigger asChild>
                <Button className="w-full bg-fantasy-green hover:bg-fantasy-green/90 text-white">
                  Create New League
                </Button>
              </DialogTrigger>
              <DialogContent>
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
                      placeholder="Enter league name..."
                      autoFocus
                    />
                  </div>
                  <div className="bg-muted/50 p-3 rounded-lg">
                    <p className="text-sm text-muted-foreground">
                      <strong>League Settings:</strong> 6 teams maximum (preset)
                    </p>
                  </div>
                  <Button
                    onClick={handleCreateLeague}
                    disabled={createLeagueMutation.isPending}
                    className="w-full bg-fantasy-green hover:bg-fantasy-green/90 text-white"
                  >
                    {createLeagueMutation.isPending ? (
                      <>
                        <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                        Creating...
                      </>
                    ) : (
                      "Create League"
                    )}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>

          {/* Join League Card */}
          <div className="bg-card border border-border rounded-lg p-6 space-y-4">
            <div className="text-center space-y-3">
              <div className="w-16 h-16 bg-trust-blue/10 rounded-full flex items-center justify-center mx-auto">
                <UserPlus className="w-8 h-8 text-trust-blue" />
              </div>
              <h3 className="text-xl font-semibold text-foreground">Join League</h3>
            </div>
            
            <Dialog open={joinDialogOpen} onOpenChange={setJoinDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" className="w-full border-trust-blue text-trust-blue hover:bg-trust-blue/10">
                  Join Existing League
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Join League</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="join-code">League Join Code</Label>
                    <Input
                      id="join-code"
                      value={joinCode}
                      onChange={(e) => setJoinCode(e.target.value)}
                      placeholder="Enter join code..."
                      autoFocus
                    />
                  </div>
                  <Button
                    onClick={handleJoinLeague}
                    disabled={joinLeagueMutation.isPending}
                    className="w-full bg-trust-blue hover:bg-trust-blue/90 text-white"
                  >
                    {joinLeagueMutation.isPending ? (
                      <>
                        <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                        Joining...
                      </>
                    ) : (
                      "Join League"
                    )}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>


      </div>
    </MainLayout>
    </>
  );
}