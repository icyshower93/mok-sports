import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { getFirstName } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  Trophy,
  Users,
  Plus,
  UserPlus,
  Bell,
  LogOut,
  Crown,
  Copy,
  Check,
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
    <div className="min-h-screen bg-light-gray">
      {/* Top Navigation */}
      <nav className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-3">
              <div className="flex items-center justify-center w-8 h-8 bg-fantasy-green rounded-lg">
                <Trophy className="w-4 h-4 text-white" />
              </div>
              <h1 className="text-xl font-bold text-dark-gray">Mok Sports</h1>
            </div>

            <div className="flex items-center space-x-4">
              <Button variant="ghost" size="sm">
                <Bell className="w-4 h-4 text-muted-gray" />
              </Button>
              <div className="flex items-center space-x-3">
                <Avatar className="w-8 h-8">
                  <AvatarImage src={user.avatar} alt={user.name} />
                  <AvatarFallback>{user.name.charAt(0)}</AvatarFallback>
                </Avatar>
                <span className="text-sm font-medium text-dark-gray hidden sm:block">
                  {user.name}
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleLogout}
                  className="text-muted-gray hover:text-error-red transition-colors"
                >
                  <LogOut className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </div>
        </div>
      </nav>

      {/* Dashboard Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Welcome Section */}
        <div className="mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-2xl sm:text-3xl font-bold text-dark-gray mb-2">
              Welcome back, {firstName}!
            </h2>
            <p className="text-muted-gray">Ready to dominate your leagues?</p>
          </div>
          <div className="mt-4 sm:mt-0 flex space-x-3">
            <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
              <DialogTrigger asChild>
                <Button className="bg-trust-blue hover:bg-trust-blue/90 text-white">
                  <Plus className="w-4 h-4 mr-2" />
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
                <Button className="bg-fantasy-green hover:bg-fantasy-green/90 text-white">
                  <UserPlus className="w-4 h-4 mr-2" />
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

        {/* Your Leagues */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Users className="w-5 h-5 mr-2 text-fantasy-green" />
              Your Leagues
            </CardTitle>
          </CardHeader>
          <CardContent>
            {leaguesLoading ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-2 border-fantasy-green border-t-transparent"></div>
                <span className="ml-3 text-muted-gray">Loading leagues...</span>
              </div>
            ) : leagues.length === 0 ? (
              <div className="text-center py-12">
                <Users className="w-12 h-12 text-muted-gray mx-auto mb-4" />
                <h3 className="text-lg font-medium text-dark-gray mb-2">No leagues yet</h3>
                <p className="text-muted-gray mb-6">Create your first league or join an existing one to get started.</p>
                <div className="flex justify-center space-x-3">
                  <Button 
                    onClick={() => setCreateDialogOpen(true)}
                    className="bg-trust-blue hover:bg-trust-blue/90"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Create League
                  </Button>
                  <Button 
                    onClick={() => setJoinDialogOpen(true)}
                    variant="outline"
                  >
                    <UserPlus className="w-4 h-4 mr-2" />
                    Join League
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                {leagues.map((league) => (
                  <div
                    key={league.id}
                    className="flex flex-col sm:flex-row sm:items-center justify-between p-4 border border-gray-200 rounded-lg hover:shadow-md transition-shadow"
                  >
                    <div className="flex items-center space-x-4 mb-3 sm:mb-0">
                      <div className="w-10 h-10 bg-gradient-to-br from-fantasy-green to-trust-blue rounded-lg flex items-center justify-center">
                        <Users className="w-5 h-5 text-white" />
                      </div>
                      <div>
                        <div className="flex items-center space-x-2">
                          <h4 className="font-semibold text-dark-gray">{league.name}</h4>
                          {league.isCreator && (
                            <Crown className="w-4 h-4 text-accent-gold" title="League Creator" />
                          )}
                        </div>
                        <p className="text-sm text-muted-gray">
                          {league.memberCount}/{league.maxTeams} teams
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-3">
                      <div className="text-center">
                        <p className="text-xs text-muted-gray font-medium">JOIN CODE</p>
                        <div className="flex items-center space-x-2">
                          <code className="px-2 py-1 bg-gray-100 rounded text-sm font-mono">
                            {league.joinCode}
                          </code>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => copyJoinCode(league.joinCode)}
                            className="p-1 h-auto"
                          >
                            {copiedCode === league.joinCode ? (
                              <Check className="w-4 h-4 text-fantasy-green" />
                            ) : (
                              <Copy className="w-4 h-4 text-muted-gray" />
                            )}
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
