import { useState, useEffect } from "react";
import { useLocation, useParams } from "wouter";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { 
  Trophy, 
  Clock, 
  Users, 
  Star, 
  Zap,
  Wifi,
  WifiOff,
  Timer,
  AlertTriangle,
  Check,
  User
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { TeamLogo } from "@/components/team-logo";
import { apiRequest, AuthTokenManager } from "@/lib/queryClient";
import { useDraftWebSocket } from "@/hooks/use-draft-websocket";
import { useAuth } from "@/hooks/use-auth";

interface NflTeam {
  id: string;
  name: string;
  city: string;
  code: string;
  logoUrl: string;
  conference: string;
  division: string;
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

const formatTime = (seconds: number) => {
  if (seconds < 0) return "0:00";
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

export default function DraftPageNew() {
  console.log('[DraftNew] Component started - Fresh compilation');
  
  const [location, navigate] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user, isLoading: authLoading, isAuthenticated } = useAuth();
  
  const params = useParams();
  const draftId = (params as any).draftId;
  const [selectedTeam, setSelectedTeam] = useState<string | null>(null);
  
  // Initialize WebSocket connection
  const { connectionStatus, isConnected } = useDraftWebSocket(draftId);
  
  // Main draft query with direct fetch to avoid body/method conflicts
  const { data: draftData, isLoading, error } = useQuery({
    queryKey: ['/api/drafts', draftId],
    queryFn: async () => {
      if (!draftId) return null;
      console.log('[Draft] Direct fetch for draft:', draftId);
      
      const response = await fetch(`/api/drafts/${draftId}?cache=${Date.now()}`, {
        method: 'GET',
        headers: {
          ...AuthTokenManager.getAuthHeaders(),
        },
        credentials: 'include',
      });
      
      if (!response.ok) {
        throw new Error(`Draft fetch failed: ${response.status} ${response.statusText}`);
      }
      
      const data = await response.json();
      console.log('[Draft] API Response received:', data);
      return data;
    },
    enabled: !!draftId && !authLoading,
    refetchInterval: 1000,
    refetchIntervalInBackground: true,
    staleTime: 0,
    gcTime: 0,
    networkMode: 'always'
  });

  const state = draftData?.state as DraftState;
  const serverTimer = state?.timeRemaining ?? 0;
  
  console.log(`[DraftNew] Server timer: ${serverTimer}s`);

  // Make pick mutation
  const makePickMutation = useMutation({
    mutationFn: async (nflTeamId: string) => {
      const response = await apiRequest('POST', `/api/drafts/${draftId}/pick`, { nflTeamId });
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Pick made successfully!",
        description: "Your team has been drafted.",
      });
      setSelectedTeam(null);
      queryClient.invalidateQueries({ queryKey: ['draft-new', draftId] });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to make pick",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  useEffect(() => {
    if (!draftId) {
      navigate('/dashboard');
    }
  }, [draftId, navigate]);

  const handleMakePick = () => {
    if (selectedTeam) {
      makePickMutation.mutate(selectedTeam);
    }
  };

  if (!draftId) return null;

  if (authLoading || isLoading) {
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
    return (
      <div className="min-h-screen bg-gradient-to-br from-background to-secondary/20 flex items-center justify-center">
        <div className="text-center">
          <AlertTriangle className="w-16 h-16 text-destructive mx-auto mb-4" />
          <h2 className="text-xl font-semibold mb-2">Unable to load draft</h2>
          <p className="text-muted-foreground mb-4">
            {error instanceof Error ? error.message : 'Unknown error occurred'}
          </p>
          <Button onClick={() => navigate('/dashboard')}>
            Return to Dashboard
          </Button>
        </div>
      </div>
    );
  }

  const isCurrentUser = state?.currentUserId === user?.id;
  const currentPlayer = state?.draft?.draftOrder && state?.currentUserId 
    ? state.picks?.find(p => p.user.id === state.currentUserId)?.user 
    : null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-secondary/20">
      {/* CRITICAL TEST BANNER */}
      <div className="fixed top-0 left-0 z-50 bg-green-500 text-white p-2 text-sm font-mono">
        NEW FILE - Timer: {serverTimer}s | formatTime: {formatTime(serverTimer)}
      </div>
      
      <div className="container mx-auto px-4 py-6 pt-16">
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

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            {/* Left Panel - Draft Status */}
            <div className="lg:col-span-4 space-y-6">
              
              {/* Connection Status */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg flex items-center gap-2">
                    {isConnected ? (
                      <>
                        <Wifi className="w-5 h-5 text-green-500" />
                        Connected
                      </>
                    ) : (
                      <>
                        <WifiOff className="w-5 h-5 text-red-500" />
                        Connecting...
                      </>
                    )}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">
                    Status: {connectionStatus}
                  </p>
                </CardContent>
              </Card>

              {/* Current Turn */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Timer className="w-5 h-5" />
                    Current Turn
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {state.draft.status === 'completed' ? (
                    <div className="text-center space-y-3">
                      <div className="p-4 bg-green-50 dark:bg-green-950 rounded-lg border border-green-200 dark:border-green-800">
                        <Check className="w-8 h-8 text-green-600 mx-auto mb-2" />
                        <p className="font-semibold text-green-700 dark:text-green-300">Draft Complete!</p>
                        <p className="text-sm text-muted-foreground mt-1">All picks have been made</p>
                      </div>
                      <div className="grid grid-cols-2 gap-4 mt-4">
                        <div className="text-center p-2 bg-secondary/30 rounded">
                          <div className="font-semibold">{state.picks?.filter(p => !p.isAutoPick).length || 0}</div>
                          <div className="text-muted-foreground text-xs">Manual Picks</div>
                        </div>
                        <div className="text-center p-2 bg-secondary/30 rounded">
                          <div className="font-semibold">{state.picks?.filter(p => p.isAutoPick).length || 0}</div>
                          <div className="text-muted-foreground text-xs">Auto Picks</div>
                        </div>
                      </div>
                    </div>
                  ) : state.currentUserId ? (
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
                        <div className={`text-3xl font-bold mb-3 font-mono transition-colors duration-300 ${
                          serverTimer <= 0 ? 'text-red-500 animate-pulse' : 
                          serverTimer <= 10 ? 'text-red-500 animate-pulse' : 
                          serverTimer <= 30 ? 'text-orange-500' : 'text-foreground'
                        }`}>
                          {formatTime(serverTimer)}
                        </div>
                        
                        {/* Progress Bar */}
                        <div className="w-full max-w-md mx-auto mb-4">
                          <div className="relative h-4 bg-gray-200 dark:bg-gray-700 rounded-full shadow-inner overflow-hidden border border-gray-300 dark:border-gray-600">
                            <div 
                              className={`h-full rounded-full relative overflow-hidden ${
                                serverTimer <= 0 ? 'bg-red-500 animate-pulse shadow-lg' :
                                serverTimer <= 10 ? 'bg-gradient-to-r from-red-500 to-red-600 shadow-red-500/50' : 
                                serverTimer <= 30 ? 'bg-gradient-to-r from-orange-400 to-orange-500 shadow-orange-500/40' : 
                                serverTimer <= 45 ? 'bg-gradient-to-r from-yellow-400 to-orange-400 shadow-yellow-500/40' :
                                'bg-gradient-to-r from-green-400 to-green-500 shadow-green-500/40'
                              }`}
                              style={{
                                width: `${Math.max(0, (serverTimer / (state.draft.pickTimeLimit || 60)) * 100)}%`,
                                transition: 'width 1s linear'
                              }}
                            />
                          </div>
                        </div>
                        
                        {isCurrentUser ? (
                          <Badge variant="default" className="text-sm">
                            <Star className="w-3 h-3 mr-1" />
                            Your Turn
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-sm">
                            <Clock className="w-3 h-3 mr-1" />
                            Waiting
                          </Badge>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="text-center">
                      <div className="w-12 h-12 bg-secondary rounded-full flex items-center justify-center mx-auto mb-2">
                        <User className="w-6 h-6 text-muted-foreground" />
                      </div>
                      <p className="text-muted-foreground">Waiting for draft to begin...</p>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Draft Order */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Users className="w-5 h-5" />
                    Draft Participants
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {state?.draft?.draftOrder?.map((userId, index) => {
                      const playerPick = state.picks?.find(p => p.user.id === userId);
                      const isActive = userId === state.currentUserId;
                      
                      return (
                        <div 
                          key={userId}
                          className={`flex items-center justify-between p-3 rounded-lg border ${
                            isActive ? 'bg-fantasy-purple/10 border-fantasy-purple' : 'bg-secondary/30'
                          }`}
                        >
                          <div className="flex items-center space-x-3">
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                              isActive ? 'bg-fantasy-purple text-white' : 'bg-secondary text-muted-foreground'
                            }`}>
                              {index + 1}
                            </div>
                            <div className="flex items-center space-x-2">
                              {playerPick?.user?.avatar && (
                                <img 
                                  src={playerPick.user.avatar} 
                                  alt={playerPick.user.name} 
                                  className="w-6 h-6 rounded-full"
                                />
                              )}
                              <span className={`font-medium ${isActive ? 'text-fantasy-purple' : ''}`}>
                                {playerPick?.user?.name || 'Loading...'}
                              </span>
                            </div>
                          </div>
                          
                          {isActive && (
                            <Badge variant="default" className="text-xs">
                              <Clock className="w-3 h-3 mr-1" />
                              {formatTime(serverTimer)}
                            </Badge>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>

              {/* Make Pick Button */}
              {isCurrentUser && state?.canMakePick && (
                <Card>
                  <CardContent className="pt-6">
                    <Button 
                      onClick={handleMakePick}
                      disabled={!selectedTeam || makePickMutation.isPending}
                      className="w-full"
                      size="lg"
                    >
                      {makePickMutation.isPending ? 'Making Pick...' : 
                       selectedTeam ? 'Confirm Pick' : 'Select a Team'}
                    </Button>
                  </CardContent>
                </Card>
              )}
            </div>

            {/* Right Panel - Available Teams */}
            <div className="lg:col-span-8">
              <Card>
                <CardHeader>
                  <CardTitle>Available Teams</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-6">
                    {['AFC', 'NFC'].map(conference => (
                      <div key={conference}>
                        <h3 className="font-semibold text-lg mb-3">{conference}</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                          {state.availableTeams?.filter(team => team.conference === conference).map(team => {
                            const isDrafted = state.picks?.some(p => p.nflTeam.id === team.id);
                            const isAvailable = !isDrafted;
                            
                            return (
                              <Button
                                key={team.id}
                                variant={selectedTeam === team.id ? "default" : "outline"}
                                className={`p-4 h-auto justify-start relative ${
                                  selectedTeam === team.id ? 'ring-2 ring-fantasy-purple' : ''
                                } ${isDrafted ? 'opacity-60' : ''}`}
                                onClick={() => isAvailable && setSelectedTeam(team.id)}
                                disabled={!state?.canMakePick || !isCurrentUser || isDrafted}
                              >
                                <div className="flex items-center space-x-3 w-full">
                                  <TeamLogo 
                                    logoUrl={team.logoUrl}
                                    teamCode={team.code}
                                    teamName={`${team.city} ${team.name}`}
                                    size="lg"
                                  />
                                  <div className="text-left flex-1">
                                    <div className="font-semibold text-sm">{team.city}</div>
                                    <div className="text-xs text-muted-foreground">{team.name}</div>
                                  </div>
                                  
                                  {isDrafted ? (
                                    <div className="text-xs font-medium text-red-600">DRAFTED</div>
                                  ) : (
                                    <div className="text-xs text-green-600 font-medium">Available</div>
                                  )}
                                </div>
                              </Button>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}