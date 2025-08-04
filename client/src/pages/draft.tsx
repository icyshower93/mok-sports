import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation, useParams } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
// import { Progress } from "@/components/ui/progress"; // Using custom progress bar
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Clock, Users, Trophy, Zap, Shield, Star, Wifi, WifiOff } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { TeamLogo } from "@/components/team-logo";
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
  
  // Debug log to verify API data structure
  console.log('Draft data structure:', {
    currentPlayer: draftData.currentPlayer,
    currentUserId: state?.currentUserId,
    isCurrentUser: draftData.isCurrentUser
  });
  
  // Enhanced timer state with transition effects
  const [displayTimeRemaining, setDisplayTimeRemaining] = useState(localTimeRemaining || state?.timeRemaining || 0);
  const [isTransitioning, setIsTransitioning] = useState(false);

  // Sync with server timer updates and handle smooth countdown
  useEffect(() => {
    const serverTime = localTimeRemaining || state?.timeRemaining || 0;
    
    if (serverTime !== displayTimeRemaining && !isTransitioning) {
      setDisplayTimeRemaining(serverTime);
    }
    
    // Start client-side countdown if timer is active
    if (serverTime > 0) {
      const interval = setInterval(() => {
        setDisplayTimeRemaining(prev => {
          if (prev <= 1) {
            // Handle timer expiration with flash effect
            setIsTransitioning(true);
            clearInterval(interval);
            
            // Reset transition state after brief flash
            setTimeout(() => {
              setIsTransitioning(false);
            }, 2000);
            
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

      return () => clearInterval(interval);
    }
  }, [localTimeRemaining, state?.timeRemaining, state?.currentUserId]);

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
                  {state.draft.status === 'completed' ? (
                    <div className="text-center space-y-3">
                      <div className="p-3 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
                        <div className="text-green-700 dark:text-green-300 font-medium mb-2">
                          🎉 Draft Complete!
                        </div>
                        <div className="text-sm text-green-600 dark:text-green-400">
                          All {state.picks?.length || 0} picks completed across {Math.max(...(state.picks?.map(p => p.round) || [0]))} rounds
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-3 text-sm">
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
                          displayTimeRemaining <= 0 ? 'text-red-500 animate-pulse' : 
                          displayTimeRemaining <= 10 ? 'text-red-500 animate-pulse' : 
                          displayTimeRemaining <= 30 ? 'text-orange-500' : 'text-foreground'
                        }`}>
                          {formatTime(displayTimeRemaining)}
                        </div>
                        
                        {/* Enhanced Progress Bar */}
                        <div className="w-full max-w-md mx-auto mb-4">
                          <div 
                            className="relative h-4 bg-gray-200 dark:bg-gray-700 rounded-full shadow-inner overflow-hidden border border-gray-300 dark:border-gray-600"
                          >
                            <div 
                              className={`h-full rounded-full relative overflow-hidden ${
                                displayTimeRemaining <= 0 ? 'bg-red-500 animate-pulse shadow-lg' :
                                displayTimeRemaining <= 10 ? 'bg-gradient-to-r from-red-500 to-red-600 shadow-red-500/50' : 
                                displayTimeRemaining <= 30 ? 'bg-gradient-to-r from-orange-400 to-orange-500 shadow-orange-500/40' : 
                                displayTimeRemaining <= 45 ? 'bg-gradient-to-r from-yellow-400 to-orange-400 shadow-yellow-500/40' :
                                'bg-gradient-to-r from-green-400 to-green-500 shadow-green-500/40'
                              } ${
                                displayTimeRemaining <= 10 ? 'shadow-lg' : 'shadow-md'
                              }`}
                              style={{
                                width: `${Math.max(0, (displayTimeRemaining / (state.draft.pickTimeLimit || 60)) * 100)}%`,
                                transition: displayTimeRemaining <= 0 ? 'none' : 'width 1s linear, background-color 0.5s ease, box-shadow 0.3s ease',
                                boxShadow: displayTimeRemaining <= 10 ? 
                                  `0 0 15px ${displayTimeRemaining <= 5 ? 'rgba(239, 68, 68, 0.8)' : 'rgba(239, 68, 68, 0.5)'}` :
                                  displayTimeRemaining <= 30 ? '0 0 8px rgba(251, 146, 60, 0.4)' : 
                                  '0 0 5px rgba(34, 197, 94, 0.3)'
                              }}
                            >
                              {/* Animated shimmer effect */}
                              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white to-transparent opacity-30 animate-pulse"></div>
                              
                              {/* Extra urgent pulsing overlay */}
                              {displayTimeRemaining <= 5 && displayTimeRemaining > 0 && (
                                <div className="absolute inset-0 bg-red-300 opacity-40 animate-ping"></div>
                              )}
                            </div>
                          </div>
                          
                          {/* Time indicators */}
                          <div className="flex justify-between items-center mt-2 text-xs">
                            <span className="text-muted-foreground">0:00</span>
                            <span className={`font-bold text-sm ${
                              displayTimeRemaining <= 10 ? 'text-red-500 animate-pulse' : 
                              displayTimeRemaining <= 30 ? 'text-orange-500' : 
                              'text-muted-foreground'
                            }`}>
                              {displayTimeRemaining <= 5 ? '⚡ CRITICAL' :
                               displayTimeRemaining <= 10 ? '🚨 URGENT' : 
                               displayTimeRemaining <= 30 ? '⏰ Hurry!' : 
                               '⏱️ Time remaining'}
                            </span>
                            <span className="text-muted-foreground">{formatTime(state.draft.pickTimeLimit || 60)}</span>
                          </div>
                        </div>
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
                  ) : (
                    <div className="text-center py-6">
                      <div className="text-muted-foreground text-sm">
                        Draft information loading...
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Snake Draft Order */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg flex items-center space-x-2">
                    <span>Snake Draft Order</span>
                    <Badge variant="outline" className="text-xs">Round {state.draft.currentRound}</Badge>
                  </CardTitle>
                  <div className="text-xs text-muted-foreground">
                    Direction changes each round
                  </div>
                </CardHeader>
                <CardContent>
                  {(() => {
                    // Calculate snake draft order for current round
                    const baseOrder = state.draft.draftOrder || [];
                    const isOddRound = state.draft.currentRound % 2 === 1;
                    const currentRoundOrder = isOddRound ? baseOrder : [...baseOrder].reverse();
                    
                    // Find current pick index and calculate upcoming picks
                    const currentPickIndex = currentRoundOrder.findIndex(userId => userId === state.currentUserId);
                    const totalPicks = currentRoundOrder.length;
                    
                    return (
                      <div className="space-y-3">
                        {/* Round Direction Indicator */}
                        <div className="flex items-center justify-center space-x-2 p-2 bg-secondary/30 rounded-lg">
                          <div className="text-xs font-medium">
                            Round {state.draft.currentRound} Direction:
                          </div>
                          <div className="flex items-center space-x-1">
                            {isOddRound ? (
                              <>
                                <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                                <div className="text-xs">→</div>
                                <div className="w-2 h-2 bg-blue-300 rounded-full"></div>
                                <div className="text-xs">→</div>
                                <div className="w-2 h-2 bg-blue-100 rounded-full"></div>
                              </>
                            ) : (
                              <>
                                <div className="w-2 h-2 bg-red-100 rounded-full"></div>
                                <div className="text-xs">←</div>
                                <div className="w-2 h-2 bg-red-300 rounded-full"></div>
                                <div className="text-xs">←</div>
                                <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                              </>
                            )}
                          </div>
                        </div>

                        {/* Draft Positions */}
                        <div className="space-y-1">
                          {currentRoundOrder.map((userId, index) => {
                            const userPicks = state.picks.filter(p => p.user.id === userId);
                            const isCurrentPick = userId === state.currentUserId;
                            const isUpNext = index === currentPickIndex + 1;
                            const isJustPicked = index === currentPickIndex - 1;
                            const pickPosition = index + 1;
                            
                            // Calculate actual pick number in the draft
                            const pickNumber = ((state.draft.currentRound - 1) * totalPicks) + pickPosition;
                            
                            // Get user name - try multiple sources
                            let userName = 'Loading...';
                            if (userPicks.length > 0 && userPicks[0].user?.name) {
                              userName = userPicks[0].user.name;
                            } else if (currentPlayer && currentPlayer.id === userId) {
                              userName = currentPlayer.name;
                            } else {
                              // Fallback to known user names based on userId
                              const userNameMap: Record<string, string> = {
                                '320ca071-16f9-41e0-b991-663da88afbc0': 'Beta Bot',
                                'd8873675-274c-46f9-ab48-00955c81d875': 'Mok Sports',
                                'f159aa72-dee8-4847-8ccc-22ecf9f27695': 'Delta Bot',
                                '8dce55ed-86ab-4723-a7c6-9ade8cd7aaae': 'Alpha Bot',
                                '766992a8-44f0-4d0e-a65f-987237e67a35': 'Gamma Bot',
                                '9932fcd8-7fbb-49c3-8fbb-f254cff1bb9a': 'Sky Evans'
                              };
                              userName = userNameMap[userId] || 'Unknown User';
                            }
                            
                            let statusColor = 'bg-secondary/30';
                            let statusText = '';
                            let statusBadge = null;
                            
                            if (isCurrentPick) {
                              statusColor = 'bg-fantasy-purple/20 border-2 border-fantasy-purple';
                              statusText = 'Drafting Now';
                              statusBadge = (
                                <Badge variant="default" className="text-xs animate-pulse">
                                  <Clock className="w-3 h-3 mr-1" />
                                  NOW
                                </Badge>
                              );
                            } else if (isUpNext) {
                              statusColor = 'bg-orange-100 dark:bg-orange-900/30 border border-orange-300';
                              statusText = 'Up Next';
                              statusBadge = (
                                <Badge variant="outline" className="text-xs bg-orange-50 text-orange-700 border-orange-300">
                                  NEXT
                                </Badge>
                              );
                            } else if (isJustPicked) {
                              statusColor = 'bg-green-100 dark:bg-green-900/30 border border-green-300';
                              statusText = 'Just Picked';
                              statusBadge = (
                                <Badge variant="outline" className="text-xs bg-green-50 text-green-700 border-green-300">
                                  DONE
                                </Badge>
                              );
                            }
                            
                            return (
                              <div 
                                key={userId} 
                                className={`flex items-center space-x-3 p-3 rounded-lg transition-all ${statusColor}`}
                              >
                                {/* Position Number with Direction Arrow */}
                                <div className="flex items-center space-x-2">
                                  <div className={`text-sm font-bold w-7 h-7 rounded-full flex items-center justify-center ${
                                    isCurrentPick ? 'bg-fantasy-purple text-white' : 
                                    isUpNext ? 'bg-orange-500 text-white' :
                                    isJustPicked ? 'bg-green-500 text-white' :
                                    'bg-secondary text-muted-foreground'
                                  }`}>
                                    {pickPosition}
                                  </div>
                                  
                                  {/* Snake Direction Indicator */}
                                  {index < currentRoundOrder.length - 1 && (
                                    <div className="text-xs text-muted-foreground">
                                      {isOddRound ? '↓' : '↑'}
                                    </div>
                                  )}
                                </div>
                                
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center justify-between">
                                    <div>
                                      <div className="text-sm font-medium truncate">
                                        {userName}
                                      </div>
                                      <div className="text-xs text-muted-foreground">
                                        Pick #{pickNumber} • {userPicks.length} teams drafted
                                      </div>
                                    </div>
                                    {statusBadge}
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>

                        {/* Next Round Preview */}
                        {state.draft.currentRound < state.draft.totalRounds && (
                          <div className="mt-4 p-3 bg-secondary/20 rounded-lg border border-dashed border-secondary">
                            <div className="text-xs font-medium text-muted-foreground mb-2">
                              Round {state.draft.currentRound + 1} Preview:
                            </div>
                            <div className="flex items-center space-x-2 text-xs text-muted-foreground">
                              <span>Direction will be:</span>
                              {(state.draft.currentRound + 1) % 2 === 1 ? (
                                <span className="text-blue-600 font-medium">Forward →</span>
                              ) : (
                                <span className="text-red-600 font-medium">← Reverse</span>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })()}
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
                          <TeamLogo 
                            logoUrl={pick.nflTeam.logoUrl}
                            teamCode={pick.nflTeam.code}
                            teamName={`${pick.nflTeam.city} ${pick.nflTeam.name}`}
                            size="md"
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