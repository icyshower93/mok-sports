import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation, useParams } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Clock, Users, Trophy, Zap, Shield, Star, Wifi, WifiOff } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { useDraftWebSocket } from "@/hooks/use-draft-websocket";

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
  
  // Extract draft ID from URL params using wouter
  const params = useParams();
  const draftId = (params as any).draftId;
  const [selectedTeam, setSelectedTeam] = useState<string | null>(null);
  
  // Local timer state for smooth countdown
  const [localTimeRemaining, setLocalTimeRemaining] = useState<number>(0);
  const [lastServerUpdate, setLastServerUpdate] = useState<number>(Date.now());

  // Initialize WebSocket connection for real-time updates
  const { connectionStatus, isConnected } = useDraftWebSocket(draftId);

  // Redirect if no draft ID
  useEffect(() => {
    if (!draftId) {
      navigate('/dashboard');
    }
  }, [draftId, navigate]);

  // Fetch draft state with polling for real-time updates
  const { data: draftData, isLoading, error } = useQuery({
    queryKey: ['draft', draftId],
    queryFn: async () => {
      const response = await fetch(`/api/drafts/${draftId}`, {
        credentials: 'include'
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error(`Draft fetch failed (${response.status}):`, errorText);
        throw new Error(errorText || 'Failed to fetch draft');
      }
      
      return response.json();
    },
    enabled: !!draftId,
    refetchInterval: 5000 // Poll every 5 seconds (reduced since we have local timer)
  });

  // Update local timer when we get new server data
  useEffect(() => {
    if (draftData?.state?.timeRemaining !== undefined) {
      setLocalTimeRemaining(draftData.state.timeRemaining);
      setLastServerUpdate(Date.now());
    }
  }, [draftData?.state?.timeRemaining]);

  // Local countdown timer for smooth second-by-second updates
  useEffect(() => {
    const interval = setInterval(() => {
      setLocalTimeRemaining(prev => {
        const elapsed = Math.floor((Date.now() - lastServerUpdate) / 1000);
        const newTime = (draftData?.state?.timeRemaining || 0) - elapsed;
        return Math.max(0, newTime);
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [lastServerUpdate, draftData?.state?.timeRemaining]);

  // Fetch available teams
  const { data: teamsData } = useQuery({
    queryKey: ['draft-teams', draftId],
    queryFn: async () => {
      const response = await fetch(`/api/drafts/${draftId}/available-teams`, {
        credentials: 'include'
      });
      if (!response.ok) throw new Error('Failed to fetch teams');
      return response.json();
    },
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
    console.error('Draft error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    return (
      <div className="min-h-screen bg-gradient-to-br from-background to-secondary/20 flex items-center justify-center">
        <Card className="max-w-md">
          <CardContent className="p-6 text-center">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Shield className="w-8 h-8 text-red-600" />
            </div>
            <h2 className="text-xl font-semibold mb-2">Draft Not Found</h2>
            <p className="text-muted-foreground mb-4">
              {errorMessage.includes('404') ? 
                'No draft exists for this league. The draft may need to be created first.' :
                errorMessage.includes('403') ?
                'You are not authorized to view this draft.' :
                'Unable to load the draft room. Please try again.'
              }
            </p>
            <div className="text-xs text-muted-foreground mb-4 p-2 bg-secondary rounded">
              <strong>Debug info:</strong><br/>
              Draft ID: {draftId}<br/>
              Error: {errorMessage}<br/>
              WebSocket: {connectionStatus}
            </div>
            <div className="space-y-2">
              <Button onClick={() => navigate('/dashboard')} variant="outline">
                Return to Dashboard
              </Button>
              <Button onClick={() => window.location.reload()}>
                Try Again
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const state: DraftState = draftData.state;
  const isCurrentUser = draftData.isCurrentUser;
  const currentPlayer = draftData.currentPlayer;
  const teams = teamsData?.teams || {};
  
  // Use local timer for smooth countdown, fallback to server data
  const displayTimeRemaining = localTimeRemaining || state?.timeRemaining || 0;

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getConferenceColor = (conference: string) => {
    return conference === 'AFC' ? 'bg-blue-500' : 'bg-red-500';
  };

  const renderConferenceTeams = (conference: 'AFC' | 'NFC') => {
    // Get all teams from available teams and picks to create comprehensive list
    const allTeams = [...(state.availableTeams || [])];
    const draftedTeams = state.picks?.map(p => p.nflTeam) || [];
    
    // Combine available and drafted teams for complete view
    const conferenceTeams = [...allTeams, ...draftedTeams]
      .filter(team => team.conference === conference)
      .reduce((acc, team) => {
        if (!acc.some(t => t.id === team.id)) {
          acc.push(team);
        }
        return acc;
      }, [] as NflTeam[]);

    // Group by division
    const divisions = conferenceTeams.reduce((acc, team) => {
      if (!acc[team.division]) acc[team.division] = [];
      acc[team.division].push(team);
      return acc;
    }, {} as Record<string, NflTeam[]>);

    return Object.entries(divisions).map(([division, divisionTeams]) => (
      <div key={division} className="mb-6">
        <h4 className="text-sm font-semibold text-muted-foreground mb-3 uppercase tracking-wide">
          {division}
        </h4>
        <div className="grid grid-cols-1 gap-2">
          {divisionTeams.map((team) => {
            const isDrafted = state.picks?.some(p => p.nflTeam.id === team.id);
            const draftedBy = isDrafted ? state.picks?.find(p => p.nflTeam.id === team.id) : null;
            const isAvailable = state.availableTeams?.some(t => t.id === team.id);
            
            return (
              <Button
                key={team.id}
                variant={selectedTeam === team.id ? "default" : "outline"}
                className={`p-3 h-auto justify-start relative ${
                  selectedTeam === team.id ? 'ring-2 ring-fantasy-purple' : ''
                } ${isDrafted ? 'opacity-60' : ''}`}
                onClick={() => isAvailable && setSelectedTeam(team.id)}
                disabled={!state?.canMakePick || !isCurrentUser || isDrafted}
              >
                <div className="flex items-center space-x-3 w-full">
                  <img 
                    src={team.logoUrl} 
                    alt={`${team.name} logo`}
                    className="w-8 h-8"
                    onError={(e) => {
                      e.currentTarget.style.display = 'none';
                    }}
                  />
                  <div className="text-left flex-1">
                    <div className="font-semibold text-sm">{team.city}</div>
                    <div className="text-xs text-muted-foreground">{team.name}</div>
                  </div>
                  
                  {isDrafted && draftedBy && (
                    <div className="text-right">
                      <div className="text-xs font-medium text-red-600">DRAFTED</div>
                      <div className="text-xs text-muted-foreground">
                        R{draftedBy.round} - {draftedBy.user.name}
                      </div>
                    </div>
                  )}
                  
                  {isAvailable && !isDrafted && (
                    <div className="text-xs text-green-600 font-medium">
                      Available
                    </div>
                  )}
                </div>
              </Button>
            );
          })}
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
                    <div className="text-center space-y-3">
                      {/* Current Player */}
                      <div className="p-3 bg-secondary/50 rounded-lg">
                        <div className="text-sm text-muted-foreground mb-1">Currently Drafting</div>
                        <div className="flex items-center justify-center space-x-2">
                          {currentPlayer?.avatar && (
                            <img 
                              src={currentPlayer.avatar} 
                              alt={currentPlayer.name} 
                              className="w-6 h-6 rounded-full"
                            />
                          )}
                          <div className="font-semibold">
                            {currentPlayer?.name || 'Finding player...'}
                          </div>
                        </div>
                      </div>
                      
                      {/* Timer */}
                      <div>
                        <div className={`text-3xl font-bold mb-2 font-mono ${
                          displayTimeRemaining <= 10 ? 'text-red-500 animate-pulse' : 
                          displayTimeRemaining <= 30 ? 'text-orange-500' : 'text-foreground'
                        }`}>
                          {formatTime(displayTimeRemaining)}
                        </div>
                        <Progress 
                          value={(displayTimeRemaining / (state.draft.pickTimeLimit || 60)) * 100} 
                          className={`mb-3 ${displayTimeRemaining <= 10 ? 'bg-red-100' : ''}`}
                        />
                        {isCurrentUser ? (
                          <Badge variant="default" className="text-sm">
                            <Star className="w-3 h-3 mr-1" />
                            Your Turn!
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-sm">
                            <Clock className="w-3 h-3 mr-1" />
                            Waiting for {currentPlayer?.name || 'player'}...
                          </Badge>
                        )}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Draft Order */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg">Draft Order</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {state.draft.draftOrder?.map((userId, index) => {
                      const userPicks = state.picks.filter(p => p.user.id === userId);
                      const isCurrentPick = userId === state.currentUserId;
                      
                      return (
                        <div 
                          key={userId} 
                          className={`flex items-center space-x-3 p-2 rounded-lg ${
                            isCurrentPick ? 'bg-fantasy-purple/10 border border-fantasy-purple' : 'bg-secondary/30'
                          }`}
                        >
                          <div className={`text-sm font-bold w-6 h-6 rounded-full flex items-center justify-center ${
                            isCurrentPick ? 'bg-fantasy-purple text-white' : 'bg-secondary text-muted-foreground'
                          }`}>
                            {index + 1}
                          </div>
                          
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium truncate">
                              {userPicks[0]?.user?.name || 'Loading...'}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {userPicks.length} picks
                            </div>
                          </div>
                          
                          {isCurrentPick && (
                            <Badge variant="default" className="text-xs">
                              <Clock className="w-3 h-3 mr-1" />
                              Now
                            </Badge>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>

              {/* Recent Picks */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg">Recent Picks</CardTitle>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-48">
                    <div className="space-y-2">
                      {state.picks.slice(-8).reverse().map((pick) => (
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
                    <CardTitle className="text-lg">NFL Teams</CardTitle>
                    <div className="text-sm text-muted-foreground">
                      {state.availableTeams?.length || 0} available • {state.picks?.length || 0} drafted
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
                    <Tabs defaultValue="afc" className="w-full">
                      <TabsList className="grid w-full grid-cols-2 mb-4">
                        <TabsTrigger value="afc">
                          AFC ({(state.availableTeams?.filter(team => team.conference === 'AFC')?.length || 0)} available)
                        </TabsTrigger>
                        <TabsTrigger value="nfc">
                          NFC ({(state.availableTeams?.filter(team => team.conference === 'NFC')?.length || 0)} available)
                        </TabsTrigger>
                      </TabsList>
                      
                      <TabsContent value="afc" className="space-y-4">
                        {renderConferenceTeams('AFC')}
                      </TabsContent>
                      
                      <TabsContent value="nfc" className="space-y-4">
                        {renderConferenceTeams('NFC')}
                      </TabsContent>
                    </Tabs>
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