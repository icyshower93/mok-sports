import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
// import { Separator } from "@/components/ui/separator";
import { Clock, Users, Trophy, Zap, Shield, Star } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

interface NflTeam {
  id: string;
  code: string;
  name: string;
  city: string;
  conference: 'AFC' | 'NFC';
  division: string;
  logoUrl: string;
}

interface DraftPick {
  id: string;
  round: number;
  pickNumber: number;
  user: {
    id: string;
    name: string;
    avatar: string | null;
  };
  nflTeam: NflTeam;
  isAutoPick: boolean;
}

interface DraftState {
  draft: {
    id: string;
    status: string;
    currentRound: number;
    currentPick: number;
    totalRounds: number;
    pickTimeLimit: number;
    draftOrder: string[];
  };
  currentUserId: string | null;
  timeRemaining: number;
  picks: DraftPick[];
  availableTeams: NflTeam[];
  isUserTurn: boolean;
  canMakePick: boolean;
}

export default function DraftPage() {
  const [location, navigate] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  // Extract draft ID from URL params
  const draftId = new URLSearchParams(location.split('?')[1] || '').get('id');
  const [selectedTeam, setSelectedTeam] = useState<string | null>(null);

  // Redirect if no draft ID
  useEffect(() => {
    if (!draftId) {
      navigate('/dashboard');
    }
  }, [draftId, navigate]);

  // Fetch draft state with polling for real-time updates
  const { data: draftData, isLoading, error } = useQuery({
    queryKey: ['draft', draftId],
    queryFn: () => apiRequest(`/api/drafts/${draftId}`).then(r => r.json()),
    enabled: !!draftId,
    refetchInterval: 2000, // Poll every 2 seconds for real-time updates
  });

  // Fetch available teams
  const { data: teamsData } = useQuery({
    queryKey: ['draft-teams', draftId],
    queryFn: () => apiRequest(`/api/drafts/${draftId}/available-teams`).then(r => r.json()),
    enabled: !!draftId,
    refetchInterval: 5000,
  });

  // Make pick mutation
  const makePickMutation = useMutation({
    mutationFn: async (nflTeamId: string) => {
      const response = await fetch(`/api/drafts/${draftId}/pick`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nflTeamId }),
        credentials: 'include'
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to make pick');
      }
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Pick made successfully!",
        description: "Your team has been drafted.",
      });
      setSelectedTeam(null);
      queryClient.invalidateQueries({ queryKey: ['draft', draftId] });
      queryClient.invalidateQueries({ queryKey: ['draft-teams', draftId] });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to make pick",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleMakePick = () => {
    if (selectedTeam) {
      makePickMutation.mutate(selectedTeam);
    }
  };

  if (!draftId) return null;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background to-secondary/20 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 bg-fantasy-purple/10 rounded-full flex items-center justify-center mx-auto mb-4">
            <Zap className="w-8 h-8 text-fantasy-purple animate-pulse" />
          </div>
          <p className="text-muted-foreground">Loading draft room...</p>
        </div>
      </div>
    );
  }

  if (error || !draftData) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background to-secondary/20 flex items-center justify-center">
        <Card className="max-w-md">
          <CardContent className="p-6 text-center">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Shield className="w-8 h-8 text-red-600" />
            </div>
            <h2 className="text-xl font-semibold mb-2">Draft Not Found</h2>
            <p className="text-muted-foreground mb-4">
              The draft you're looking for doesn't exist or you don't have permission to view it.
            </p>
            <Button onClick={() => navigate('/dashboard')}>
              Return to Dashboard
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const state: DraftState = draftData.state;
  const isCurrentUser = draftData.isCurrentUser;
  const teams = teamsData?.teams || {};

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getConferenceColor = (conference: string) => {
    return conference === 'AFC' ? 'bg-blue-500' : 'bg-red-500';
  };

  const renderTeamGrid = (conferenceTeams: Record<string, NflTeam[]>) => {
    return Object.entries(conferenceTeams).map(([division, divisionTeams]) => (
      <div key={division} className="mb-6">
        <h4 className="text-sm font-semibold text-muted-foreground mb-3 uppercase tracking-wide">
          {division}
        </h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {divisionTeams.map((team) => (
            <Button
              key={team.id}
              variant={selectedTeam === team.id ? "default" : "outline"}
              className={`p-3 h-auto justify-start ${
                selectedTeam === team.id ? 'ring-2 ring-fantasy-purple' : ''
              }`}
              onClick={() => setSelectedTeam(team.id)}
              disabled={!state?.canMakePick || !isCurrentUser}
            >
              <div className="flex items-center space-x-3">
                <img 
                  src={team.logoUrl} 
                  alt={`${team.name} logo`}
                  className="w-8 h-8"
                  onError={(e) => {
                    e.currentTarget.style.display = 'none';
                  }}
                />
                <div className="text-left">
                  <div className="font-semibold text-sm">{team.city}</div>
                  <div className="text-xs text-muted-foreground">{team.name}</div>
                </div>
              </div>
            </Button>
          ))}
        </div>
      </div>
    ));
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-secondary/20">
      <div className="container mx-auto px-4 py-6">
        <div className="max-w-7xl mx-auto">
          
          {/* Header */}
          <div className="text-center mb-6">
            <h1 className="text-3xl font-bold text-foreground mb-2">Draft Room</h1>
            <div className="flex items-center justify-center space-x-4 text-sm text-muted-foreground">
              <div className="flex items-center space-x-1">
                <Trophy className="w-4 h-4" />
                <span>Round {state.draft.currentRound}/{state.draft.totalRounds}</span>
              </div>
              <div className="flex items-center space-x-1">
                <Users className="w-4 h-4" />
                <span>Pick {state.draft.currentPick}</span>
              </div>
              <Badge variant={state.draft.status === 'active' ? 'default' : 'secondary'}>
                {state.draft.status.toUpperCase()}
              </Badge>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* Current Pick & Timer */}
            <div className="lg:col-span-1 space-y-4">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg flex items-center space-x-2">
                    <Clock className="w-5 h-5" />
                    <span>Current Pick</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {state.currentUserId && (
                    <div className="text-center">
                      <div className="text-2xl font-bold mb-2">
                        {formatTime(state.timeRemaining)}
                      </div>
                      <Progress 
                        value={(state.timeRemaining / state.draft.pickTimeLimit) * 100} 
                        className="mb-3" 
                      />
                      {isCurrentUser ? (
                        <Badge variant="default" className="text-sm">
                          <Star className="w-3 h-3 mr-1" />
                          Your Turn!
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-sm">
                          Waiting for pick...
                        </Badge>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Draft Picks History */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg">Recent Picks</CardTitle>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-64">
                    <div className="space-y-2">
                      {state.picks.slice(-10).reverse().map((pick) => (
                        <div key={pick.id} className="flex items-center space-x-3 p-2 rounded-lg bg-secondary/50">
                          <img 
                            src={pick.nflTeam.logoUrl} 
                            alt={`${pick.nflTeam.name} logo`}
                            className="w-6 h-6"
                            onError={(e) => {
                              e.currentTarget.style.display = 'none';
                            }}
                          />
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium truncate">
                              {pick.nflTeam.city} {pick.nflTeam.name}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              R{pick.round} - {pick.user.name}
                              {pick.isAutoPick && ' (Auto)'}
                            </div>
                          </div>
                          <div className={`w-2 h-2 rounded-full ${getConferenceColor(pick.nflTeam.conference)}`} />
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>
            </div>

            {/* Team Selection */}
            <div className="lg:col-span-2">
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg">Available Teams</CardTitle>
                    <div className="text-sm text-muted-foreground">
                      {(teamsData as any)?.availableCount || 0} / {(teamsData as any)?.totalTeams || 32} remaining
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  {isCurrentUser && state?.canMakePick && (
                    <div className="mb-4 p-3 bg-fantasy-purple/10 rounded-lg border border-fantasy-purple/20">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">
                          {selectedTeam ? 'Team selected - ready to draft!' : 'Select a team to draft'}
                        </span>
                        <Button 
                          onClick={handleMakePick}
                          disabled={!selectedTeam || makePickMutation.isPending}
                          size="sm"
                        >
                          {makePickMutation.isPending ? 'Drafting...' : 'Draft Team'}
                        </Button>
                      </div>
                    </div>
                  )}

                  <ScrollArea className="h-96">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {/* AFC Conference */}
                      <div>
                        <div className="flex items-center space-x-2 mb-4">
                          <div className="w-3 h-3 rounded-full bg-blue-500" />
                          <h3 className="text-lg font-semibold">AFC</h3>
                        </div>
                        {teams.AFC && renderTeamGrid(teams.AFC)}
                      </div>

                      {/* NFC Conference */}
                      <div>
                        <div className="flex items-center space-x-2 mb-4">
                          <div className="w-3 h-3 rounded-full bg-red-500" />
                          <h3 className="text-lg font-semibold">NFC</h3>
                        </div>
                        {teams.NFC && renderTeamGrid(teams.NFC)}
                      </div>
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}