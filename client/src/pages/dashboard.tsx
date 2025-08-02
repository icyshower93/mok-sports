import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { MainLayout } from "@/components/layout/main-layout";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, UserPlus } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface League {
  id: number;
  name: string;
  joinCode: string;
  maxTeams: number;
  memberCount: number;
  isCreator: boolean;
}

export default function DashboardPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [joinDialogOpen, setJoinDialogOpen] = useState(false);
  const [leagueName, setLeagueName] = useState("");
  const [maxTeams, setMaxTeams] = useState("8");
  const [joinCode, setJoinCode] = useState("");

  if (!user) {
    return null;
  }

  const firstName = user.name.split(" ")[0];

  // Create league mutation
  const createLeagueMutation = useMutation({
    mutationFn: async (data: { name: string; maxTeams: number }) => {
      return apiRequest(`/api/leagues`, {
        method: "POST",
        body: JSON.stringify(data),
      });
    },
    onSuccess: (newLeague) => {
      queryClient.invalidateQueries({ queryKey: ["/api/leagues"] });
      setCreateDialogOpen(false);
      setLeagueName("");
      setMaxTeams("8");
      toast({
        title: "League Created!",
        description: `Your league "${newLeague.name}" has been created successfully.`,
      });
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
      return apiRequest(`/api/leagues/join`, {
        method: "POST",
        body: JSON.stringify({ joinCode: code }),
      });
    },
    onSuccess: (league) => {
      queryClient.invalidateQueries({ queryKey: ["/api/leagues"] });
      setJoinDialogOpen(false);
      setJoinCode("");
      toast({
        title: "Joined League!",  
        description: `Successfully joined "${league.name}".`,
      });
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

    createLeagueMutation.mutate({ 
      name: leagueName.trim(), 
      maxTeams: parseInt(maxTeams) 
    });
  };

  const handleJoinLeague = () => {
    if (!joinCode.trim()) {
      toast({
        title: "Error", 
        description: "Please enter a league code",
        variant: "destructive",
      });
      return;
    }

    joinLeagueMutation.mutate(joinCode.trim());
  };

  return (
    <MainLayout>
      <div className="min-h-[80vh] flex items-center justify-center px-4">
        <div className="fantasy-card fantasy-gradient-green p-12 text-white text-center max-w-2xl mx-auto">
          <h1 className="text-4xl md:text-5xl font-bold mb-6">
            Welcome to Mok Sports! 🏆
          </h1>
          <p className="text-white/90 text-xl mb-12">
            Get started by creating your first league or joining an existing one
          </p>
          
          <div className="flex flex-col sm:flex-row gap-6 justify-center">
            {/* Create League Dialog */}
            <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
              <DialogTrigger asChild>
                <Button className="bg-white text-fantasy-green hover:bg-white/90 font-bold shadow-xl px-12 py-6 text-xl rounded-2xl">
                  <Plus className="w-8 h-8 mr-4" />
                  Create Your League
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
                    <select
                      id="max-teams"
                      value={maxTeams}
                      onChange={(e) => setMaxTeams(e.target.value)}
                      className="w-full px-3 py-2 border border-border rounded-md bg-background text-foreground"
                    >
                      <option value="8">8 Teams</option>
                      <option value="10">10 Teams</option>
                      <option value="12">12 Teams</option>
                      <option value="14">14 Teams</option>
                      <option value="16">16 Teams</option>
                    </select>
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
                      className="flex-1 bg-fantasy-green hover:bg-fantasy-green/90"
                    >
                      {createLeagueMutation.isPending ? "Creating..." : "Create"}
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
            
            {/* Join League Dialog */}
            <Dialog open={joinDialogOpen} onOpenChange={setJoinDialogOpen}>
              <DialogTrigger asChild>
                <Button className="bg-white/10 border-3 border-white text-white hover:bg-white hover:text-fantasy-green font-bold shadow-xl px-12 py-6 text-xl rounded-2xl">
                  <UserPlus className="w-8 h-8 mr-4" />
                  Join a League
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-md">
                <DialogHeader>
                  <DialogTitle>Join League</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="join-code">League Code</Label>
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
    </MainLayout>
  );
}