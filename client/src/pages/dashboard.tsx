import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { getFirstName } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { MainLayout } from "@/components/layout/main-layout";
import {
  Trophy,
  Users,
  Plus,
  UserPlus,
  Crown,
  Copy,
  Check,
  TrendingUp,
  Star,
  Zap,
  Target,
  Calendar,
  Award,
} from "lucide-react";

interface League {
  id: string;
  name: string;
  joinCode: string;
  maxTeams: number;
  memberCount: number;
  isCreator: boolean;
  createdAt: string;
}

export default function DashboardPage() {
  const { user, logout } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [joinDialogOpen, setJoinDialogOpen] = useState(false);
  const [leagueName, setLeagueName] = useState("");
  const [maxTeams, setMaxTeams] = useState("6");
  const [joinCode, setJoinCode] = useState("");
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  if (!user) return null;

  const firstName = getFirstName(user.name);

  const handleLogout = async () => {
    await logout();
  };

  // Fetch user's leagues
  const { data: leagues = [], isLoading: leaguesLoading } = useQuery<League[]>({
    queryKey: ["/api/leagues/user"],
  });

  // Create league mutation
  const createLeagueMutation = useMutation({
    mutationFn: (data: { name: string; maxTeams: number }) =>
      apiRequest("POST", "/api/leagues", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/leagues/user"] });
      setCreateDialogOpen(false);
      setLeagueName("");
      setMaxTeams("6");
      toast({
        title: "League created!",
        description: "Your new league is ready for members to join.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to create league",
        description: error.message || "Something went wrong",
        variant: "destructive",
      });
    },
  });

  // Join league mutation
  const joinLeagueMutation = useMutation({
    mutationFn: (data: { joinCode: string }) =>
      apiRequest("POST", "/api/leagues/join", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/leagues/user"] });
      setJoinDialogOpen(false);
      setJoinCode("");
      toast({
        title: "Joined league!",
        description: "You've successfully joined the league.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to join league",
        description: error.message || "Something went wrong",
        variant: "destructive",
      });
    },
  });

  const handleCreateLeague = () => {
    if (!leagueName.trim()) {
      toast({
        title: "League name required",
        description: "Please enter a name for your league",
        variant: "destructive",
      });
      return;
    }

    createLeagueMutation.mutate({
      name: leagueName.trim(),
      maxTeams: parseInt(maxTeams),
    });
  };

  const handleJoinLeague = () => {
    if (!joinCode.trim()) {
      toast({
        title: "Join code required",
        description: "Please enter a league join code",
        variant: "destructive",
      });
      return;
    }

    joinLeagueMutation.mutate({
      joinCode: joinCode.trim().toUpperCase(),
    });
  };

  const copyJoinCode = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code);
      setCopiedCode(code);
      setTimeout(() => setCopiedCode(null), 2000);
      toast({
        title: "Code copied!",
        description: "Join code copied to clipboard",
      });
    } catch (err) {
      toast({
        title: "Failed to copy",
        description: "Unable to copy join code",
        variant: "destructive",
      });
    }
  };

  return (
    <MainLayout>
      <div className="py-6 space-y-8">
        {/* Hero Section with Quick Actions */}
        <div className="fantasy-card fantasy-gradient-green p-6 text-white">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between">
            <div className="mb-4 md:mb-0">
              <h1 className="text-2xl md:text-3xl font-bold mb-2">
                Welcome back, {firstName}! 🏆
              </h1>
              <p className="text-white/90 text-lg">Ready to dominate your leagues?</p>
            </div>
            <div className="flex flex-col sm:flex-row gap-3">
              <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
              <DialogTrigger asChild>
                <Button className="bg-white text-fantasy-green hover:bg-white/90 font-semibold shadow-lg">
                  <Plus className="w-5 h-5 mr-2" />
                  Create League
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-md">
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
                      maxLength={50}
                    />
                  </div>
                  <div>
                    <Label htmlFor="max-teams">Number of Teams</Label>
                    <Select value={maxTeams} onValueChange={setMaxTeams}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {[2, 4, 6, 8, 10, 12, 14, 16, 18, 20].map((num) => (
                          <SelectItem key={num} value={num.toString()}>
                            {num} teams
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex space-x-3 pt-4">
                    <Button
                      variant="outline"
                      onClick={() => setCreateDialogOpen(false)}
                      className="flex-1"
                    >
                      Cancel
                    </Button>
                    <Button
                      onClick={handleCreateLeague}
                      disabled={createLeagueMutation.isPending}
                      className="flex-1 bg-trust-blue hover:bg-trust-blue/90"
                    >
                      {createLeagueMutation.isPending ? "Creating..." : "Create"}
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>

            <Dialog open={joinDialogOpen} onOpenChange={setJoinDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" className="bg-white/10 border-white/30 text-white hover:bg-white/20 font-semibold">
                  <UserPlus className="w-5 h-5 mr-2" />
                  Join League
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-md">
                <DialogHeader>
                  <DialogTitle>Join League</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="join-code">League Join Code</Label>
                    <Input
                      id="join-code"
                      value={joinCode}
                      onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                      placeholder="Enter 6-character code"
                      maxLength={6}
                      className="uppercase"
                    />
                  </div>
                  <div className="flex space-x-3 pt-4">
                    <Button
                      variant="outline"
                      onClick={() => setJoinDialogOpen(false)}
                      className="flex-1"
                    >
                      Cancel
                    </Button>
                    <Button
                      onClick={handleJoinLeague}
                      disabled={joinLeagueMutation.isPending}
                      className="flex-1 bg-fantasy-green hover:bg-fantasy-green/90"
                    >
                      {joinLeagueMutation.isPending ? "Joining..." : "Join"}
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
            </div>
          </div>
        </div>

        {/* Quick Stats Dashboard */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div className="fantasy-card fantasy-card-hover p-4 text-center">
            <div className="w-12 h-12 bg-fantasy-green/10 rounded-xl flex items-center justify-center mx-auto mb-3">
              <Trophy className="w-6 h-6 text-fantasy-green" />
            </div>
            <p className="text-2xl font-bold text-foreground">{leagues.length}</p>
            <p className="text-sm text-muted-foreground">Active Leagues</p>
          </div>
          <div className="fantasy-card fantasy-card-hover p-4 text-center">
            <div className="w-12 h-12 bg-trust-blue/10 rounded-xl flex items-center justify-center mx-auto mb-3">
              <Crown className="w-6 h-6 text-trust-blue" />
            </div>
            <p className="text-2xl font-bold text-foreground">{leagues.filter(l => l.isCreator).length}</p>
            <p className="text-sm text-muted-foreground">As Commissioner</p>
          </div>
          <div className="fantasy-card fantasy-card-hover p-4 text-center">
            <div className="w-12 h-12 bg-accent-gold/10 rounded-xl flex items-center justify-center mx-auto mb-3">
              <Star className="w-6 h-6 text-accent-gold" />
            </div>
            <p className="text-2xl font-bold text-foreground">-</p>
            <p className="text-sm text-muted-foreground">Top Finish</p>
          </div>
          <div className="fantasy-card fantasy-card-hover p-4 text-center">
            <div className="w-12 h-12 bg-fantasy-purple/10 rounded-xl flex items-center justify-center mx-auto mb-3">
              <TrendingUp className="w-6 h-6 text-fantasy-purple" />
            </div>
            <p className="text-2xl font-bold text-foreground">-</p>
            <p className="text-sm text-muted-foreground">Win Rate</p>
          </div>
        </div>

        {/* Your Leagues Section */}
        <div>
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-foreground">Your Leagues</h2>
            <div className="flex space-x-3">
              <Button 
                onClick={() => setCreateDialogOpen(true)}
                className="bg-fantasy-green hover:bg-fantasy-green/90 text-white font-semibold shadow-lg"
              >
                <Plus className="w-4 h-4 mr-2" />
                Create
              </Button>
              <Button 
                onClick={() => setJoinDialogOpen(true)}
                variant="outline"
                className="border-fantasy-green text-fantasy-green hover:bg-fantasy-green hover:text-white font-semibold"
              >
                <UserPlus className="w-4 h-4 mr-2" />
                Join
              </Button>
            </div>
          </div>

          {leaguesLoading ? (
            <div className="fantasy-card">
              <div className="flex items-center justify-center py-16">
                <div className="animate-spin rounded-full h-8 w-8 border-2 border-fantasy-green border-t-transparent"></div>
                <span className="ml-3 text-muted-foreground">Loading your leagues...</span>
              </div>
            </div>
          ) : leagues.length === 0 ? (
            <div className="fantasy-card p-12 text-center">
              <div className="w-20 h-20 bg-muted rounded-full flex items-center justify-center mx-auto mb-6">
                <Users className="w-10 h-10 text-muted-foreground" />
              </div>
              <h3 className="text-xl font-semibold text-foreground mb-3">Ready to compete?</h3>
              <p className="text-muted-foreground mb-8 max-w-md mx-auto">
                Join your friends in fantasy leagues or create your own to become the commissioner.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Button 
                  onClick={() => setCreateDialogOpen(true)}
                  className="bg-fantasy-green hover:bg-fantasy-green/90 text-white font-semibold px-8 py-3"
                >
                  <Plus className="w-5 h-5 mr-2" />
                  Create Your First League
                </Button>
                <Button 
                  onClick={() => setJoinDialogOpen(true)}
                  variant="outline"
                  className="border-2 border-fantasy-green text-fantasy-green hover:bg-fantasy-green hover:text-white font-semibold px-8 py-3"
                >
                  <UserPlus className="w-5 h-5 mr-2" />
                  Join Existing League
                </Button>
              </div>
            </div>
          ) : (
            <div className="grid gap-4">
              {leagues.map((league, index) => {
                const gradients = [
                  'fantasy-gradient-green',
                  'fantasy-gradient-gold', 
                  'fantasy-gradient-purple'
                ];
                const gradient = gradients[index % gradients.length];
                
                return (
                  <div
                    key={league.id}
                    className="fantasy-card fantasy-card-hover overflow-hidden"
                  >
                    <div className={`h-2 ${gradient}`}></div>
                    <div className="p-6">
                      <div className="flex flex-col md:flex-row md:items-center md:justify-between">
                        <div className="flex items-center space-x-4 mb-4 md:mb-0">
                          <div className={`w-14 h-14 ${gradient} rounded-xl flex items-center justify-center shadow-lg`}>
                            <Users className="w-7 h-7 text-white" />
                          </div>
                          <div>
                            <div className="flex items-center space-x-3 mb-1">
                              <h3 className="text-xl font-bold text-foreground">{league.name}</h3>
                              {league.isCreator && (
                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-accent-gold/10 text-accent-gold">
                                  <Crown className="w-3 h-3 mr-1" />
                                  Commissioner
                                </span>
                              )}
                            </div>
                            <p className="text-muted-foreground">
                              {league.memberCount}/{league.maxTeams} teams • 
                              {league.memberCount === league.maxTeams ? (
                                <span className="text-fantasy-green font-medium ml-1">Full</span>
                              ) : (
                                <span className="text-trust-blue font-medium ml-1">
                                  {league.maxTeams - league.memberCount} spots left
                                </span>
                              )}
                            </p>
                          </div>
                        </div>
                        
                        <div className="flex items-center space-x-4">
                          <div className="text-center">
                            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">
                              League Code
                            </p>
                            <div className="flex items-center space-x-2">
                              <code className="px-3 py-2 bg-muted rounded-lg text-sm font-mono font-bold text-foreground border-2 border-dashed border-border">
                                {league.joinCode}
                              </code>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => copyJoinCode(league.joinCode)}
                                className="p-2 hover:bg-muted rounded-lg transition-colors"
                              >
                                {copiedCode === league.joinCode ? (
                                  <Check className="w-4 h-4 text-fantasy-green" />
                                ) : (
                                  <Copy className="w-4 h-4 text-muted-foreground" />
                                )}
                              </Button>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </MainLayout>
  );
}
