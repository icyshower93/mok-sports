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
  const [maxTeams, setMaxTeams] = useState("6");
  const [joinCode, setJoinCode] = useState("");

  if (!user) {
    return null;
  }

  const firstName = user.name.split(" ")[0];

  // Create league mutation
  const createLeagueMutation = useMutation({
    mutationFn: async (data: { name: string; maxTeams: number }) => {
      const response = await fetch('/api/leagues', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
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
      setCreateDialogOpen(false);
      setLeagueName("");
      setMaxTeams("6");
      toast({
        title: "League Created!",
        description: `Your league "${newLeague.name}" has been created successfully.`,
      });
      // Redirect to league waiting area
      window.location.href = `/league/waiting?id=${newLeague.id}`;
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
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ joinCode: code }),
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to join league');
      }
      
      return response.json();
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
      <div className="min-h-[70vh] flex items-center justify-center">
        <div className="fantasy-card fantasy-gradient-green p-8 md:p-12 text-white text-center max-w-2xl mx-auto">
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold mb-4 md:mb-6">
            Welcome to Mok Sports! 🏆
          </h1>
          <p className="text-white/90 text-lg md:text-xl mb-8 md:mb-12">
            Get started by creating your first league or joining an existing one
          </p>
          
          <div className="flex flex-col gap-4 sm:gap-6 justify-center">
            {/* Create League Dialog */}
            <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
              <DialogTrigger asChild>
                <Button className="bg-white text-fantasy-green hover:bg-white/90 font-bold shadow-xl px-6 py-4 sm:px-12 sm:py-6 text-lg sm:text-xl rounded-2xl w-full sm:w-auto min-h-[60px]">
                  <Plus className="w-6 h-6 sm:w-8 sm:h-8 mr-3 sm:mr-4 flex-shrink-0" />
                  <span className="whitespace-nowrap">Create Your League</span>
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
                      autoFocus={false}
                      tabIndex={-1}
                      onFocus={(e) => e.target.setAttribute('tabindex', '0')}
                    />
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
                <Button className="bg-white/10 border-2 border-white text-white hover:bg-white hover:text-fantasy-green font-bold shadow-xl px-6 py-4 sm:px-12 sm:py-6 text-lg sm:text-xl rounded-2xl w-full sm:w-auto min-h-[60px]">
                  <UserPlus className="w-6 h-6 sm:w-8 sm:h-8 mr-3 sm:mr-4 flex-shrink-0" />
                  <span className="whitespace-nowrap">Join a League</span>
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
                      autoFocus={false}
                      tabIndex={-1}
                      onFocus={(e) => e.target.setAttribute('tabindex', '0')}
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