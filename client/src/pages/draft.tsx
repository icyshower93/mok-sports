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
import { apiRequest, AuthTokenManager } from "@/lib/queryClient";
import { useDraftWebSocket } from "@/hooks/use-draft-websocket";
import { useAuth } from "@/hooks/use-auth";
import { trackModuleError } from "@/debug-tracker";

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
  console.log('[Draft] Component render started - TIME:', Date.now());
  console.log('[Draft] FIRST DEBUG LINE - Component starting');
  
  const [location, navigate] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user, isLoading: authLoading, isAuthenticated } = useAuth();
  
  // EMERGENCY DEBUG - Check if this line is reached  
  console.log('[Draft] EMERGENCY DEBUG: Auth loaded, authLoading:', authLoading, 'user:', !!user, 'isAuthenticated:', isAuthenticated, 'rendered at:', new Date().toISOString());
  console.log('[Draft] RENDER TIMING - Time since component start:', Date.now() - performance.now());
  
  // Extract draft ID from URL params using wouter
  const params = useParams();
  const draftId = (params as any).draftId;
  const [selectedTeam, setSelectedTeam] = useState<string | null>(null);
  
  // Server timer state - single source of truth
  const [serverTime, setServerTime] = useState<number>(0);

  console.log('[Draft] All useState hooks declared');

  // Initialize WebSocket connection for real-time timer updates
  const { connectionStatus, isConnected, lastMessage } = useDraftWebSocket(draftId);

  // Redirect if no draft ID
  useEffect(() => {
    if (!draftId) {
      navigate('/dashboard');
    }
  }, [draftId, navigate]);

  // Fetch draft state with polling for real-time updates
  const { data: draftData, isLoading, error } = useQuery({
    queryKey: ['draft', draftId], // Remove timestamp to allow proper caching
    queryFn: async () => {
      console.log('[Draft] === STARTING DRAFT FETCH ===');
      console.log('[Draft] Draft ID:', draftId);
      console.log('[Draft] Auth status - User:', user?.name, 'Authenticated:', isAuthenticated, 'Loading:', authLoading);
      console.log('[Draft] Token available:', !!AuthTokenManager.getToken());
      console.log('[Draft] Current URL:', window.location.href);
      console.log('[Draft] Current pathname:', window.location.pathname);
      
      try {
        console.log('[Draft] Making API request to:', `/api/drafts/${draftId}`);
        
        // Use the apiRequest function to include authentication headers
        const response = await apiRequest('GET', `/api/drafts/${draftId}`);
        
        console.log('[Draft] Response received:', {
          status: response.status,
          statusText: response.statusText,
          headers: Object.fromEntries(response.headers.entries())
        });
        
        const data = await response.json();
        console.log('[Draft] Successfully fetched draft data:', data);
        console.log('[Draft] === DRAFT FETCH SUCCESS ===');
        return data;
      } catch (error) {
        console.error('[Draft] === DRAFT FETCH ERROR ===');
        console.error('[Draft] Error fetching draft data:', error);
        console.error('[Draft] Error type:', typeof error);
        console.error('[Draft] Error constructor:', error?.constructor?.name);
        
        // Track the error for PWA debugging
        trackModuleError(error, 'draft-fetch');
        
        console.error('[Draft] Full error details:', {
          message: error instanceof Error ? error.message : 'Unknown error',
          stack: error instanceof Error ? error.stack : 'No stack trace',
          user: user?.name,
          hasToken: !!AuthTokenManager.getToken(),
          isAuthenticated,
          authLoading,
          draftId,
          currentUrl: window.location.href
        });
        
        // Try to make a direct fetch to see what's happening
        try {
          console.log('[Draft] Attempting direct fetch for debugging...');
          const directResponse = await fetch(`/api/drafts/${draftId}`, {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json',
              ...AuthTokenManager.getAuthHeaders()
            },
            credentials: 'include'
          });
          
          console.log('[Draft] Direct fetch response:', {
            status: directResponse.status,
            statusText: directResponse.statusText,
            headers: Object.fromEntries(directResponse.headers.entries())
          });
          
          const directText = await directResponse.text();
          console.log('[Draft] Direct fetch response body:', directText);
          
          // Store the response for PWA debugging
          try {
            sessionStorage.setItem('mok-last-direct-fetch', JSON.stringify({
              status: directResponse.status,
              statusText: directResponse.statusText,
              headers: Object.fromEntries(directResponse.headers.entries()),
              body: directText,
              timestamp: new Date().toISOString()
            }));
          } catch (e) {
            console.warn('[Draft] Could not store direct fetch result');
          }
        } catch (directError) {
          console.error('[Draft] Direct fetch also failed:', directError);
          trackModuleError(directError, 'direct-fetch');
        }
        
        throw error;
      }
    },
    enabled: !!draftId && !authLoading, // Wait for auth to load before making requests
    refetchInterval: 5000, // Reduced polling - WebSocket handles timer updates
    staleTime: 0, // Never trust cached data - always stale
    gcTime: 0, // React Query v5: disable caching completely
    retry: (failureCount, error) => {
      // Don't retry on authentication errors
      if (error instanceof Error && error.message.includes('401')) {
        console.log('[Draft] Authentication error, not retrying');
        return false;
      }
      console.log(`[Draft] Retrying fetch, attempt ${failureCount + 1}`);
      return failureCount < 3;
    }
  });

  // Log errors for debugging
  if (error) {
    console.error('Draft fetch error:', error);
  }

  // WebSocket timer updates - single source of truth
  useEffect(() => {
    if (lastMessage?.type === 'timer_update') {
      console.log('[Draft] Received timer update via WebSocket:', lastMessage.data?.timeRemaining);
      setServerTime(lastMessage.data?.timeRemaining || 0);
    }
  }, [lastMessage]);

  // Initialize timer from server data when first loaded
  useEffect(() => {
    if (draftData?.state?.timeRemaining !== undefined) {
      setServerTime(draftData.state.timeRemaining);
      console.log('[Draft] Initialized timer from server:', draftData.state.timeRemaining);
    }
  }, [draftData?.state?.timeRemaining]);

  // Display timer from WebSocket updates or fallback to server data
  const displayTime = serverTime || draftData?.state?.timeRemaining || 0;

  // Local countdown disabled - use server data only for now
  // This prevents conflicts between local countdown and server sync

  // Fetch available teams
  const { data: teamsData } = useQuery({
    queryKey: ['draft-teams', draftId],
    queryFn: async () => {
      // Use the apiRequest function to include authentication headers
      const response = await apiRequest('GET', `/api/drafts/${draftId}/available-teams`);
      return response.json();
    },
    enabled: !!draftId,
    refetchInterval: 5000,
  });

  // Make pick mutation
  const makePickMutation = useMutation({
    mutationFn: async (nflTeamId: string) => {
      // Use the apiRequest function to include authentication headers
      const response = await apiRequest('POST', `/api/drafts/${draftId}/pick`, { nflTeamId });
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

  // Timer expiration monitoring (simplified)
  useEffect(() => {
    console.log('[Draft] Timer expiration useEffect called');
  }, [displayTime, draftData?.state?.timeRemaining]);

  console.log('[Draft] All hooks declared, starting conditional logic');
  console.log('[Draft] RENDER DEBUG - authLoading:', authLoading, 'isLoading:', isLoading, 'error:', !!error, 'draftData:', !!draftData, 'isAuthenticated:', isAuthenticated, 'Time:', Date.now());

  const handleMakePick = () => {
    if (selectedTeam) {
      makePickMutation.mutate(selectedTeam);
    }
  };

  if (!draftId) return null;

  // Show loading while auth is still loading
  if (authLoading || isLoading) {
    console.log('[Draft] RENDER: Loading state - authLoading:', authLoading, 'isLoading:', isLoading, 'draftData:', !!draftData);
    return (
      <div className="min-h-screen bg-gradient-to-br from-background to-secondary/20 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 bg-fantasy-purple/10 rounded-full flex items-center justify-center mx-auto mb-4">
            <Zap className="w-8 h-8 text-fantasy-purple animate-pulse" />
          </div>
          <p className="text-muted-foreground">Loading draft room...</p>
          <p className="text-xs text-muted-foreground mt-2">Auth: {authLoading ? 'loading' : 'ready'} | Data: {isLoading ? 'loading' : 'ready'}</p>
        </div>
      </div>
    );
  }

  if (error || !draftData) {
    console.error('Draft error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    // Enhanced debug information for troubleshooting
    console.log('[Draft Debug] Full error details:', {
      error,
      errorMessage,
      draftId,
      connectionStatus,
      hasToken: !!AuthTokenManager.getToken(),
      tokenPreview: AuthTokenManager.getToken()?.substring(0, 20) + '...',
    });
    
    return (
      <div className="min-h-screen bg-gradient-to-br from-background to-secondary/20 flex items-center justify-center">
        <Card className="max-w-md">
          <CardContent className="p-6 text-center">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Shield className="w-8 h-8 text-red-600" />
            </div>
            <h2 className="text-xl font-semibold mb-2">Draft Connection Issue</h2>
            <p className="text-muted-foreground mb-4">
              {errorMessage.includes('404') ? 
                'No draft exists for this league. The draft may need to be created first.' :
                errorMessage.includes('403') || errorMessage.includes('401') ?
                'Authentication issue detected. The system should auto-authenticate in development mode.' :
                'Unable to load the draft room. Please try again.'
              }
            </p>
            <div className="text-xs text-muted-foreground mb-4 p-2 bg-secondary rounded">
              <strong>Debug info:</strong><br/>
              Draft ID: {draftId}<br/>
              Error: {errorMessage}<br/>
              WebSocket: {connectionStatus}<br/>
              Has Token: {!!AuthTokenManager.getToken() ? 'Yes' : 'No'}<br/>
              Mode: Development (Auto-auth enabled)
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

  // DEBUG LOGGING AND CRITICAL TIMER SYNC FIX
  console.log('🔍 [TIMER DEBUG] Server Time:', state.timeRemaining);
  console.log('🔍 [TIMER DEBUG] Display Time:', displayTime);
  console.log('🔍 [TIMER DEBUG] Current Player:', currentPlayer?.name);
  
  // CRITICAL FIX: Force timer sync with server data when different
  if (state.timeRemaining !== displayTime && state.timeRemaining > 0) {
    console.log('🔄 [TIMER SYNC] Forcing timer sync from API:', state.timeRemaining);
    setDisplayTime(state.timeRemaining);
  }

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getConferenceColor = (conference: string) => {
    return conference === 'AFC' ? 'bg-blue-500' : 'bg-red-500';
  };

  // Create stable conference team renderer (FIXED: prevent re-render loops)
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
                          displayTime <= 0 ? 'text-red-500 animate-pulse' : 
                          displayTime <= 10 ? 'text-red-500 animate-pulse' : 
                          displayTime <= 30 ? 'text-orange-500' : 'text-foreground'
                        }`}>
                          {formatTime(displayTime)}
                        </div>
                        
                        {/* Enhanced Progress Bar */}
                        <div className="w-full max-w-md mx-auto mb-4">
                          <div 
                            className="relative h-4 bg-gray-200 dark:bg-gray-700 rounded-full shadow-inner overflow-hidden border border-gray-300 dark:border-gray-600"
                          >
                            <div 
                              className={`h-full rounded-full relative overflow-hidden ${
                                displayTime <= 0 ? 'bg-red-500 animate-pulse shadow-lg' :
                                displayTime <= 10 ? 'bg-gradient-to-r from-red-500 to-red-600 shadow-red-500/50' : 
                                displayTime <= 30 ? 'bg-gradient-to-r from-orange-400 to-orange-500 shadow-orange-500/40' : 
                                displayTime <= 45 ? 'bg-gradient-to-r from-yellow-400 to-orange-400 shadow-yellow-500/40' :
                                'bg-gradient-to-r from-green-400 to-green-500 shadow-green-500/40'
                              } ${
                                displayTime <= 10 ? 'shadow-lg' : 'shadow-md'
                              }`}
                              style={{
                                width: `${Math.max(0, (displayTime / (state.draft.pickTimeLimit || 60)) * 100)}%`,
                                transition: 'width 1s linear, background-color 0.5s ease, box-shadow 0.3s ease',
                                boxShadow: displayTime <= 10 ? 
                                  `0 0 15px ${displayTime <= 5 ? 'rgba(239, 68, 68, 0.8)' : 'rgba(239, 68, 68, 0.5)'}` :
                                  displayTime <= 30 ? '0 0 8px rgba(251, 146, 60, 0.4)' : 
                                  '0 0 5px rgba(34, 197, 94, 0.3)'
                              }}
                            >
                              {/* Animated shimmer effect */}
                              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white to-transparent opacity-30 animate-pulse"></div>
                              
                              {/* Extra urgent pulsing overlay */}
                              {displayTime <= 5 && displayTime > 0 && (
                                <div className="absolute inset-0 bg-red-300 opacity-40 animate-ping"></div>
                              )}
                            </div>
                          </div>
                          
                          {/* Time indicators */}
                          <div className="flex justify-between items-center mt-2 text-xs">
                            <span className="text-muted-foreground">0:00</span>
                            <span className={`font-bold text-sm ${
                              displayTime <= 10 ? 'text-red-500 animate-pulse' : 
                              displayTime <= 30 ? 'text-orange-500' : 
                              'text-muted-foreground'
                            }`}>
                              {displayTime <= 5 ? '⚡ CRITICAL' :
                               displayTime <= 10 ? '🚨 URGENT' : 
                               displayTime <= 30 ? '⏰ Hurry!' : 
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