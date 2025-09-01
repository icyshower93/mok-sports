import { useState, useEffect, useRef, startTransition } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation, useParams } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
// import { Progress } from "@/components/ui/progress"; // Using custom progress bar
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Clock, Users, Trophy, Zap, Shield, Star, Wifi, WifiOff, Play, ArrowLeft, CheckCircle, Circle, Search, X, Sparkles, Target, ChevronUp, ChevronDown, RotateCcw, Plus } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { TeamLogo } from "@/components/team-logo";
import { apiRequest } from "@/features/query/api";
import { useResilientWebSocket } from "@/hooks/use-resilient-websocket";
import { useAuth } from "@/features/auth/useAuth";
// Debug import removed
import type { DraftState, NflTeam, DraftPick } from '@shared/types/draft';

export default function DraftPage() {
  // CRITICAL: All early returns must happen BEFORE any hooks to prevent Rules of Hooks violations
  const params = useParams();
  const urlDraftId = (params as any).draftId;
  
  // ALL HOOKS MUST BE CALLED CONSISTENTLY - cannot return early after calling hooks
  // Fixed: Handle null case with conditional rendering instead of early return
  
  const [location, navigate] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user, isLoading: authLoading, isAuthenticated } = useAuth();
  
  // Extract draft ID from URL params using wouter - SINGLE SOURCE OF TRUTH
  const [actualDraftId, setActualDraftId] = useState<string | null>(urlDraftId);
  const [selectedTeam, setSelectedTeam] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState<string>('');
  
  // Modern UI state management
  const [showCelebration, setShowCelebration] = useState(false);
  const [panelsCollapsed, setPanelsCollapsed] = useState(true);
  const [currentConference, setCurrentConference] = useState<'AFC' | 'NFC'>('AFC');
  const [touchStartX, setTouchStartX] = useState<number>(0);
  const [showFAB, setShowFAB] = useState(false);
  
  // Fetch user's leagues to get the current draft ID
  const { data: leagueData } = useQuery({
    queryKey: ['/api/leagues/user'],
    queryFn: async () => {
      return await apiRequest('GET', '/api/leagues/user');
    },
    enabled: !!user && !authLoading,
    staleTime: 1000 * 10, // Cache for 10 seconds
  });
  
  // Enhanced timer state for smooth countdown
  const [serverTime, setServerTime] = useState<number>(0);
  const [localTime, setLocalTime] = useState<number>(0);
  const [lastServerUpdate, setLastServerUpdate] = useState<number>(0);
  const [isCountingDown, setIsCountingDown] = useState<boolean>(false);
  
  // Prevent notification spam
  const [lastNotificationTime, setLastNotificationTime] = useState<number>(0);
  const [hasNotifiedForThisTurn, setHasNotifiedForThisTurn] = useState<boolean>(false);

  // Mobile UX utilities with better error handling
  const vibrate = (pattern: number | number[]) => {
    try {
      if ('vibrate' in navigator && navigator.vibrate) {
        const result = navigator.vibrate(pattern);
        console.log('[VIBRATION]', result ? 'Success' : 'Failed', pattern);
        return result;
      } else {
        console.log('[VIBRATION] API not supported on this device');
        return false;
      }
    } catch (error) {
      console.error('[VIBRATION] Error:', error);
      return false;
    }
  };

  const requestNotificationPermission = async () => {
    if ('Notification' in window && 'serviceWorker' in navigator) {
      if (Notification.permission === 'default') {
        await Notification.requestPermission();
      }
    }
  };

  const sendNotification = (title: string, options?: NotificationOptions) => {
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification(title, {
        icon: '/icon-192x192.png',
        badge: '/icon-192x192.png',
        ...options
      });
    }
  };



  // Request notification permission on mount
  useEffect(() => {
    requestNotificationPermission();
  }, []);

  // Auto-redirect to correct draft if URL has wrong draft ID
  useEffect(() => {
    if (!leagueData || !urlDraftId || authLoading) return;
    
    // Find the league that contains this user and has an active draft
    const activeLeague = leagueData.find((league: any) => 
      league.draftId && league.draftStatus === 'active'
    );
    
    if (activeLeague?.draftId && activeLeague.draftId !== urlDraftId) {
      // Clear cache and redirect to the correct draft
      queryClient.clear();
      navigate(`/draft/${activeLeague.draftId}`, { replace: true });
      return;
    } else if (activeLeague?.draftId) {
      setActualDraftId(activeLeague.draftId);
    }
  }, [leagueData, urlDraftId, user?.id, navigate, queryClient, authLoading]);

  // Use the actual draft ID for all operations - SINGLE SOURCE OF TRUTH
  const draftId = actualDraftId;
  
  // Cancel any queries when draftId changes to prevent race conditions
  useEffect(() => {
    if (draftId) {
      // Cancel any in-flight queries for other draft IDs
      queryClient.cancelQueries({ 
        predicate: (query) => {
          const key = query.queryKey;
          return Array.isArray(key) && key.some(k => 
            typeof k === 'string' && k.includes('/api/drafts/') && !k.includes(draftId)
          );
        }
      });
      
      // Reset draft-related state when ID changes
      setSelectedTeam(null);
      setShowCelebration(false);
      setHasNotifiedForThisTurn(false);
      setLastNotificationTime(0);
    }
  }, [draftId, queryClient]);

  // WebSocket connection - keyed by draftId for proper cleanup on route changes
  const wsUrl = draftId ? `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}/api/drafts/ws/${draftId}` : null;
  const { status: connectionStatus, message: lastMessage } = useResilientWebSocket(wsUrl);
  const isConnected = connectionStatus === 'open';

  // Handle null urlDraftId case in main render (Rules of Hooks compliance)

  // CRITICAL: Declare variables BEFORE any useEffect that uses them
  // Move these after draftData is available from the query
  // Variables will be defined below after the query is declared

  // Redirect if no draft ID
  useEffect(() => {
    if (!draftId) {
      navigate('/dashboard');
    }
  }, [draftId, navigate]);

  // Fetch draft state with polling for real-time updates
  const { data: draftData, isLoading, error } = useQuery({
    queryKey: ['draft', draftId, 'state'], // Include 'state' for specificity
    queryFn: async ({ signal }) => {
      console.log('[Draft] === STARTING DRAFT FETCH ===');
      console.log('[Draft] Draft ID:', draftId);
      console.log('[Draft] Auth status - User:', user?.name, 'Authenticated:', isAuthenticated, 'Loading:', authLoading);
      // Token logging removed to avoid circular imports
      console.log('[Draft] Current URL:', window.location.href);
      console.log('[Draft] Current pathname:', window.location.pathname);
      
      try {
        console.log('[Draft] Making API request to:', `/api/drafts/${draftId}`);
        
        // Use direct fetch with credentials and signal for cancellation
        const response = await fetch(`/api/drafts/${draftId}`, {
          method: 'GET',
          credentials: 'include', // Use cookies for auth instead of Bearer token
          signal, // Add signal for query cancellation
          headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json'
          }
        });
        
        console.log('[Draft] Response received:', {
          status: response.status,
          statusText: response.statusText,
          ok: response.ok,
          headers: Object.fromEntries(response.headers.entries())
        });
        
        if (!response.ok) {
          const errorText = await response.text();
          console.error('[Draft] API Error Response:', errorText);
          throw new Error(`HTTP ${response.status}: ${errorText}`);
        }
        
        const data = await response.json();
        console.log('[Draft] Successfully fetched draft data:', data);
        console.log('[Draft] === DRAFT FETCH SUCCESS ===');
        return data;
      } catch (error) {
        console.error('[Draft] === DRAFT FETCH ERROR ===');
        console.error('[Draft] Error fetching draft data:', error);
        console.error('[Draft] Error type:', typeof error);
        console.error('[Draft] Error constructor:', error?.constructor?.name);
        
        // Error tracking removed
        
        console.error('[Draft] Full error details:', {
          message: error instanceof Error ? error.message : 'Unknown error',
          stack: error instanceof Error ? error.stack : 'No stack trace',
          user: user?.name,
          // hasToken: omitted to avoid circular imports
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
              'Authorization': `Bearer ${document.cookie.split('token=')[1]?.split(';')[0] || ''}` // Fallback auth
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
          // Error tracking removed
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

  // CRITICAL: Declare variables after query is defined to prevent temporal dead zone errors  
  const state: DraftState = (draftData?.state ?? {}) as DraftState;
  const isCurrentUser = draftData?.isCurrentUser || false;

  // Derived, null-safe handles
  const draft = draftData?.state?.draft ?? null;
  const draftStatus = draft?.status ?? 'not_started';
  const timeRemainingSafe = draftData?.state?.timeRemaining ?? 0;
  const picksSafe = state?.picks ?? [];
  const availableTeamsSafe = state?.availableTeams ?? [];
  const draftOrderSafe = draft?.draftOrder ?? [];
  const currentRoundSafe = draft?.currentRound ?? 1;
  const totalRoundsSafe = draft?.totalRounds ?? (draftOrderSafe.length || 1);
  const pickTimeLimitSafe = draft?.pickTimeLimit ?? 120;

  // Log errors for debugging
  if (error) {
    console.error('Draft fetch error:', error);
  }

  // SMOOTH TIMER SYSTEM: RAF-based stable timer with refs for jank-free countdown
  
  // Refs for stable timer tracking (no re-renders)
  const serverTimeAtUpdateRef = useRef(0);      // seconds remaining at last server tick
  const clientTsAtUpdateRef = useRef(0);        // performance.now() at last server tick
  const rafRef = useRef<number | null>(null);
  const [zeroSince, setZeroSince] = useState<number | null>(null);
  
  // Handle server timer updates (WebSocket or API) with mobile alerts
  useEffect(() => {
    const newServerTime = lastMessage?.type === 'timer_update' ? 
      lastMessage.data?.timeRemaining : 
      draftData?.state?.timeRemaining;

    if (newServerTime !== undefined && newServerTime !== serverTime) {
      console.log('[SMOOTH TIMER] Server update received:', newServerTime);
      
      // Mobile UX: Vibration alerts for timer warnings
      if (isCurrentUser) {
        if (newServerTime <= 30 && newServerTime > 25 && serverTime > 30) {
          console.log('[VIBRATION] 30s warning triggered');
          vibrate(100); // Short vibration at 30s
        } else if (newServerTime <= 10 && newServerTime > 5 && serverTime > 10) {
          console.log('[VIBRATION] 10s warning triggered');
          vibrate([100, 50, 100]); // Double vibration at 10s
        } else if (newServerTime <= 5 && newServerTime > 0 && serverTime > 5) {
          console.log('[VIBRATION] 5s urgent warning triggered');
          vibrate([200, 100, 200, 100, 200]); // Urgent pattern at 5s
        }
      }
      
      // PREDICTIVE TIMER FIX: If we receive a "fresh" timer (55+ seconds), immediately switch
      const isFreshTimer = newServerTime >= 55 && serverTime < 10;
      
      if (isFreshTimer) {
        console.log('[SMOOTH TIMER] 🎯 Fresh timer detected - immediate transition');
        // Mobile UX: Notify user it's their turn (ONLY ONCE)
        if (isCurrentUser && !hasNotifiedForThisTurn) {
          const now = Date.now();
          // Prevent duplicate notifications within 30 seconds
          if (now - lastNotificationTime > 30000) {
            vibrate([300, 100, 300]); // Strong "your turn" vibration
            sendNotification('Your Draft Pick!', {
              body: 'It\'s your turn to draft a team',
              tag: 'draft-turn',
              requireInteraction: true
            });
            setLastNotificationTime(now);
            setHasNotifiedForThisTurn(true);
          }
        }
      }
      
      // Update refs immediately (no re-renders needed)
      serverTimeAtUpdateRef.current = newServerTime;
      clientTsAtUpdateRef.current = performance.now();
      
      // Prevent snap-backs: only update UI if new time is <= current local time
      const newUiTime = Math.min(newServerTime, localTime || newServerTime);
      setServerTime(newServerTime);
      setLocalTime(newUiTime);
      setIsCountingDown(newServerTime > 0 && draftData?.state?.draft?.status === 'active');
      
      // Reset zero tracking on fresh updates
      if (newServerTime > 0) {
        setZeroSince(null);
      }
    }
  }, [lastMessage, draftData, serverTime, isCurrentUser, hasNotifiedForThisTurn, lastNotificationTime, localTime]);
  
  // Reset notification flag when it's no longer user's turn
  useEffect(() => {
    if (!isCurrentUser && hasNotifiedForThisTurn) {
      setHasNotifiedForThisTurn(false);
    }
  }, [isCurrentUser, hasNotifiedForThisTurn]);

  // Single stable RAF loop - no interval recreation
  useEffect(() => {
    if (!isCountingDown) {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
      return;
    }

    const tick = () => {
      const elapsed = (performance.now() - clientTsAtUpdateRef.current) / 1000;
      // Non-increasing, no snap-backs
      const raw = serverTimeAtUpdateRef.current - elapsed;
      const est = raw > 0 ? raw : 0;

      setLocalTime(prev => {
        // Prevent time from jumping up (snap-backs)
        const newTime = est > (prev || 0) ? (prev || 0) : est;
        
        // Track when we hit zero for grace period
        if (newTime <= 0 && prev > 0) {
          setZeroSince(performance.now());
        }
        
        return newTime;
      });

      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    };
  }, [isCountingDown]);
  
  // Handle zero state with grace period
  useEffect(() => {
    if (localTime > 0) {
      if (zeroSince !== null) setZeroSince(null);
      return;
    }
    
    // If we've shown 0 for > 1.5s and no draft state change, consider stopping
    if (zeroSince !== null) {
      const timeSinceZero = (performance.now() - zeroSince) / 1000;
      if (timeSinceZero > 1.5 && isCountingDown) {
        console.log('[SMOOTH TIMER] Grace period expired, stopping countdown');
        setIsCountingDown(false);
      }
    }
  }, [localTime, zeroSince, isCountingDown]);
  
  // Handle tab visibility to correct drift on resume
  useEffect(() => {
    const onVis = () => {
      if (!document.hidden) {
        // On resume, reset the client timestamp to correct any drift
        clientTsAtUpdateRef.current = performance.now();
        console.log('[SMOOTH TIMER] Tab resumed, correcting timer drift');
      }
    };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, []);

  // Display logic with smooth transitions and integer rounding
  const displayTime = (() => {
    const rawTime = isCountingDown ? localTime : (serverTime || draftData?.state?.timeRemaining || 0);
    
    // Smooth to integer if showing whole seconds (avoids 59.999 → 59 flicker)
    return Math.floor(rawTime + 1e-6);
  })();
  
  console.log('[SMOOTH TIMER] Display time:', displayTime.toFixed(1), 'isCountingDown:', isCountingDown, 'localTime:', localTime.toFixed(1));

  // Variables moved earlier in the file to prevent compilation errors

  // Mobile UX helper functions
  const getTimerRingColor = () => {
    if (displayTime <= 5) return 'stroke-red-500 animate-pulse';
    if (displayTime <= 10) return 'stroke-orange-500';
    if (displayTime <= 30) return 'stroke-yellow-500';
    return 'stroke-green-500';
  };

  const getBackgroundColor = () => {
    if (!isCurrentUser) return '';
    if (displayTime <= 5) return 'bg-red-50 dark:bg-red-950/20 animate-pulse';
    if (displayTime <= 10) return 'bg-orange-50 dark:bg-orange-950/20';
    if (displayTime <= 30) return 'bg-yellow-50 dark:bg-yellow-950/20';
    return 'bg-green-50 dark:bg-green-950/20';
  };

  // Team availability status helper
  const getTeamStatus = (team: NflTeam) => {
    const isDrafted = picksSafe.some(p => p.nflTeam.id === team.id);
    if (isDrafted) return 'taken';
    
    // Check division conflict for current user (must match conference + division)
    if (isCurrentUser && state?.canMakePick) {
      const userPicks = picksSafe.filter(p => p.user.id === user?.id) || [];
      const hasDivisionConflict = userPicks.some(
        p => `${p.nflTeam.conference} ${p.nflTeam.division}` === `${team.conference} ${team.division}`
      );
      if (hasDivisionConflict) return 'conflict';
    }
    
    return 'available';
  };

  // Swipe gesture handlers
  const handleTouchStart = (e: React.TouchEvent) => {
    setTouchStartX(e.touches[0].clientX);
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    const touchEndX = e.changedTouches[0].clientX;
    const diff = touchStartX - touchEndX;
    
    if (Math.abs(diff) > 50) { // Minimum swipe distance
      if (diff > 0 && currentConference === 'AFC') {
        setCurrentConference('NFC');
      } else if (diff < 0 && currentConference === 'NFC') {
        setCurrentConference('AFC');
      }
    }
  };

  // Show FAB when it's user's turn
  useEffect(() => {
    setShowFAB(isCurrentUser && state?.canMakePick && !!selectedTeam);
  }, [isCurrentUser, state?.canMakePick, selectedTeam]);

  // Auto-expand panels when user's turn approaches
  useEffect(() => {
    if (displayTime <= 30 && isCurrentUser) {
      setPanelsCollapsed(false);
    }
  }, [displayTime, isCurrentUser]);

  // TIMER FIX: Use actual draft timer limit instead of hardcoded 60
  const draftTimerLimit = pickTimeLimitSafe
  const progressPercentage = displayTime > 0 ? Math.min(1.0, displayTime / draftTimerLimit) : 0;
  
  // Debug logging for timer sync
  console.log(`[TIMER SYNC] Display: ${displayTime.toFixed(1)}s, Limit: ${draftTimerLimit}s, Progress: ${(progressPercentage * 100).toFixed(1)}%`);

  // Fetch available teams
  const { data: teamsData } = useQuery({
    queryKey: ['draft', draftId, 'teams'],
    queryFn: async ({ signal }) => {
      // Use the apiRequest function to include authentication headers
      return await apiRequest('GET', `/api/drafts/${draftId}/available-teams`);
    },
    enabled: !!draftId,
    refetchInterval: 5000,
    staleTime: 0,
    gcTime: 0,
  });

  // Make pick mutation - HARDENED: Single transition with optimized invalidation
  const makePickMutation = useMutation({
    mutationFn: async (nflTeamId: string) => {
      return await apiRequest('POST', `/api/drafts/${draftId}/pick`, { nflTeamId });
    },
    onSuccess: (data) => {
      // HARDENING: Single transition with batched invalidations
      startTransition(() => {
        queryClient.invalidateQueries({ 
          predicate: (query) => {
            const k = String((query.queryKey?.[0] ?? '') as string);
            return k.startsWith('/api/draft') || 
                   k.startsWith('/api/scoring') || 
                   k.startsWith('/api/leagues') ||
                   (query.queryKey[0] === 'draft' && query.queryKey[1] === draftId);
          }
        });
      });
      
      setSelectedTeam(null);
      toast({
        title: "Pick made successfully!",
        description: "Your team has been drafted.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to make pick",
        description: error.message,
        variant: "destructive",
      });
    },
    retry: 0 // No retries to prevent duplicate submissions
  });

  console.log('[Draft] All hooks declared, starting conditional logic');
  console.log('[Draft] RENDER DEBUG - authLoading:', authLoading, 'isLoading:', isLoading, 'error:', !!error, 'draftData:', !!draftData, 'isAuthenticated:', isAuthenticated, 'Time:', Date.now());

  // Handle null urlDraftId case in main render (no early returns allowed)

  const handleMakePick = () => {
    if (selectedTeam && !makePickMutation.isPending) { // Prevent double-clicks during submission
      makePickMutation.mutate(selectedTeam, {
        onSuccess: () => {
          // RACE CONDITION FIX: Delay state updates to prevent DOM conflicts
          setTimeout(() => {
            // Trigger celebration animation
            setShowCelebration(true);
            setTimeout(() => setShowCelebration(false), 2000);
            
            // Enhanced haptic feedback for successful pick
            vibrate([200, 100, 200, 100, 400]);
          }, 50); // Small delay to prevent DOM conflicts
          
          setSelectedTeam(null);
          toast({
            title: "🎉 Pick successful!",
            description: "Your team has been drafted."
          });
        },
        onError: (error: any) => {
          toast({
            title: "Pick failed",
            description: error.message || "Failed to draft team. Please try again."
          });
        }
      });
    }
  };

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
      // Auth token details omitted to avoid circular imports
    });
    
    return (
      <div className="min-h-screen bg-gradient-to-br from-background to-secondary/20 flex items-center justify-center">
        <Card className="w-full">
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

            <div className="space-y-2">
              <Button onClick={() => startTransition(() => navigate('/'))} variant="outline">
                Return to Home
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

  // REMOVED: Duplicate timer sync that was causing infinite re-render loop
  // The timer sync is already handled in the main timer useEffect hook

  // Variables moved earlier to prevent temporal dead zone errors
  // const state and isCurrentUser are now declared above
  const currentPlayer = draftData?.currentPlayer || null;
  const teams = teamsData?.teams || {};

  // DEBUG LOGGING AND CRITICAL TIMER SYNC FIX
  if (draftData?.state) {
    console.log('🔍 [TIMER DEBUG] Server Time:', state?.timeRemaining);
    console.log('🔍 [TIMER DEBUG] Display Time:', displayTime);
    console.log('🔍 [TIMER DEBUG] Current Player:', currentPlayer?.name);
  }

  const formatTime = (seconds: number) => {
    const totalSeconds = Math.max(0, seconds);
    const mins = Math.floor(totalSeconds / 60);
    const secs = Math.floor(totalSeconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Timer phase stability to prevent React DOM mismatches
  const timerPhase =
    draftStatus !== 'active' ? draftStatus :
    displayTime > 0 ? 'countdown' : 'transition';

  const getConferenceColor = (conference: string) => {
    return conference === 'AFC' ? 'bg-blue-500' : 'bg-red-500';
  };

  // Filter teams by search term
  const filterTeams = (teams: NflTeam[]) => {
    if (!searchTerm) return teams;
    const term = searchTerm.toLowerCase();
    return teams.filter(team => 
      team.city.toLowerCase().includes(term) ||
      team.name.toLowerCase().includes(term) ||
      team.code.toLowerCase().includes(term) ||
      team.division.toLowerCase().includes(term)
    );
  };

  // Create stable conference team renderer with search (FIXED: prevent re-render loops)
  const renderConferenceTeams = (conference: 'AFC' | 'NFC') => {
    // Get all teams from available teams and picks to create comprehensive list
    const allTeams = [...(availableTeamsSafe || [])];
    const draftedTeams = picksSafe?.map(p => p.nflTeam) || [];
    
    // Combine available and drafted teams for complete view
    let conferenceTeams = [...allTeams, ...draftedTeams]
      .filter(team => team.conference === conference)
      .reduce((acc, team) => {
        if (!acc.some(t => t.id === team.id)) {
          acc.push(team);
        }
        return acc;
      }, [] as NflTeam[]);

    // Apply search filter
    conferenceTeams = filterTeams(conferenceTeams);

    // Group by division
    const divisions = conferenceTeams.reduce((acc, team) => {
      if (!acc[team.division]) acc[team.division] = [];
      acc[team.division].push(team);
      return acc;
    }, {} as Record<string, NflTeam[]>);

    return Object.entries(divisions).map(([division, divisionTeams]) => (
      <div key={division} className="mb-6">
        <h4 className="text-xs font-medium text-muted-foreground mb-3 uppercase tracking-wider">
          {division}
        </h4>
        <div className="grid grid-cols-1 gap-2">
          {divisionTeams.map((team) => {
            const isDrafted = picksSafe?.some(p => p.nflTeam.id === team.id);
            const draftedBy = isDrafted ? picksSafe?.find(p => p.nflTeam.id === team.id) : null;
            const isAvailable = availableTeamsSafe?.some(t => t.id === team.id);
            
            return (
              <button
                key={team.id}
                className={`w-full p-3 rounded-lg border transition-all duration-150 text-left ${
                  selectedTeam === team.id 
                    ? 'border-primary bg-primary/5 shadow-sm' 
                    : isDrafted 
                    ? 'border-border bg-muted/30 opacity-60 cursor-not-allowed'
                    : 'border-border hover:border-primary/50 hover:bg-muted/50'
                } ${!state?.canMakePick || !isCurrentUser || isDrafted ? 'cursor-not-allowed' : 'cursor-pointer'}`}
                onClick={() => isAvailable && !isDrafted && setSelectedTeam(team.id)}
                disabled={!state?.canMakePick || !isCurrentUser || isDrafted}
              >
                <div className="flex items-center space-x-3">
                  <div className="relative">
                    <TeamLogo 
                      logoUrl={team.logoUrl}
                      teamCode={team.code}
                      teamName={`${team.city} ${team.name}`}
                      size="lg"
                    />
                    {/* Team Availability Status Indicator */}
                    <div className={`absolute -top-1 -right-1 w-3 h-3 rounded-full border-2 border-background ${
                      isDrafted ? 'bg-red-500' :
                      (() => {
                        const status = getTeamStatus(team);
                        return status === 'conflict' ? 'bg-orange-500 animate-pulse' : 'bg-green-500';
                      })()
                    }`} />
                  </div>
                  
                  <div className="flex-1">
                    <div className="font-medium text-sm flex items-center space-x-2">
                      <span>{team.city} {team.name}</span>
                      {getTeamStatus(team) === 'conflict' && isCurrentUser && (
                        <Target className="w-3 h-3 text-orange-500" />
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground">{team.division}</div>
                    {getTeamStatus(team) === 'conflict' && isCurrentUser && (
                      <div className="text-xs text-orange-600 mt-1">
                        Division limit reached
                      </div>
                    )}
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    {isDrafted && draftedBy ? (
                      <div className="text-right">
                        <div className="text-xs font-medium text-muted-foreground flex items-center space-x-1">
                          <Circle className="w-3 h-3 fill-red-500 text-red-500" />
                          <span>Taken</span>
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {draftedBy.user.name} (R{draftedBy.round})
                        </div>
                      </div>
                    ) : selectedTeam === team.id ? (
                      <div className="flex items-center space-x-2">
                        <CheckCircle className="w-4 h-4 text-green-500" />
                        <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                      </div>
                    ) : null}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    ));
  };

  return (
    <div className="min-h-screen bg-background relative">
      {/* Celebration Animation Overlay */}
      {showCelebration && (
        <div className="fixed inset-0 z-50 pointer-events-none flex items-center justify-center">
          <div className="text-6xl animate-bounce">
            <Sparkles className="w-24 h-24 text-yellow-500" />
          </div>
          <div className="absolute inset-0 bg-gradient-to-r from-yellow-400 via-red-500 to-pink-500 opacity-20 animate-pulse" />
        </div>
      )}

      {/* Modern Sticky Header with Glassmorphism */}
      <div className="sticky top-0 z-40 bg-background/80 backdrop-blur-xl border-b border-border/50 px-4 lg:px-8 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => startTransition(() => navigate('/league/waiting'))}
              className="p-2 hover:bg-secondary/50 transition-all duration-200"
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div>
              <h1 className="text-xl font-bold">Draft Room</h1>
              <div className="text-sm text-muted-foreground">
                {draftData?.league?.name || 'Loading...'}
              </div>
            </div>
          </div>
          
          {/* Enhanced Timer & Status Bar */}
          <div className="flex items-center space-x-4">
            {/* Current Picker Info */}
            {state?.currentUserId && currentPlayer && (
              <div className="hidden sm:flex items-center space-x-2 px-3 py-1.5 bg-secondary/30 rounded-full">
                {currentPlayer.avatar && (
                  <img 
                    src={currentPlayer.avatar} 
                    alt={currentPlayer.name}
                    className={`w-6 h-6 rounded-full transition-all duration-300 ${
                      isCurrentUser ? 'ring-2 ring-green-400 animate-pulse' : ''
                    }`}
                  />
                )}
                <div className="text-xs">
                  <div className={`font-medium ${isCurrentUser ? 'text-green-600' : 'text-foreground'}`}>
                    {isCurrentUser ? 'Your turn!' : currentPlayer.name}
                  </div>
                </div>
              </div>
            )}

            {/* Enhanced Timer Circle */}
            {draftStatus === 'active' && (
              <div className="relative">
                <svg className="w-12 h-12 transform -rotate-90">
                  <circle
                    cx="24"
                    cy="24"
                    r="20"
                    stroke="currentColor"
                    strokeWidth="3"
                    fill="none"
                    className="text-secondary opacity-25"
                  />
                  <circle
                    cx="24"
                    cy="24"
                    r="20"
                    stroke="currentColor"
                    strokeWidth="3"
                    fill="none"
                    strokeDasharray={`${2 * Math.PI * 20}`}
                    strokeDashoffset={`${2 * Math.PI * 20 * (1 - progressPercentage)}`}
                    className={`transition-all duration-500 ${getTimerRingColor()} ${
                      displayTime <= 10 ? 'animate-pulse' : ''
                    } ${displayTime <= 5 ? 'drop-shadow-lg' : ''}`}
                    strokeLinecap="round"
                    style={{
                      animation: displayTime <= 30 ? 'pulse 2s ease-in-out infinite' : undefined
                    }}
                  />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className={`text-sm font-bold transition-colors duration-300 ${
                    displayTime <= 5 ? 'text-red-600 animate-pulse' :
                    displayTime <= 10 ? 'text-orange-600' :
                    displayTime <= 30 ? 'text-yellow-600' :
                    'text-foreground'
                  }`}>
                    {Math.max(0, Math.ceil(displayTime))}
                  </div>
                </div>
              </div>
            )}
            
            {/* Connection Status */}
            <div className="flex items-center space-x-2">
              {isConnected ? (
                <div className="flex items-center space-x-1 text-green-600">
                  <Wifi className="w-4 h-4" />
                  <span className="text-xs font-medium hidden sm:inline">Connected</span>
                </div>
              ) : (
                <div className="flex items-center space-x-1 text-red-600">
                  <WifiOff className="w-4 h-4 animate-pulse" />
                  <span className="text-xs font-medium hidden sm:inline">Disconnected</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Progress Bar for Mobile */}
        {draftStatus === 'active' && (
          <div className="sm:hidden mt-3 w-full bg-secondary/30 rounded-full h-2 overflow-hidden">
            <div 
              className={`h-full rounded-full transition-all duration-500 ${
                displayTime <= 10 ? 'bg-red-500 animate-pulse' : 
                displayTime <= 30 ? 'bg-orange-500' : 
                'bg-green-500'
              }`}
              style={{ width: `${Math.max(0, progressPercentage * 100)}%` }}
            />
          </div>
        )}
      </div>

      {/* Screen Flash Effect for Urgency (always mounted to avoid DOM churn) */}
      <div
        aria-hidden
        className={`fixed inset-0 pointer-events-none z-30 border-4 transition-all duration-300 ${
          isCurrentUser && displayTime <= 10
            ? (displayTime <= 5
                ? 'border-red-500 animate-pulse opacity-100'
                : 'border-orange-500 opacity-100')
            : 'border-transparent opacity-0'
        }`}
      />

      <div className="container mx-auto px-4 py-6">
        <div className="max-w-7xl mx-auto">
          
          {/* Modern Header */}
          <div className="mb-8">
            <div className="text-center mb-4">
              <h1 className="text-2xl font-semibold text-foreground mb-1">Draft Room</h1>
              <div className="flex items-center justify-center space-x-6 text-sm text-muted-foreground">
                <div className="flex items-center space-x-1">
                  <span>Round {currentRoundSafe} of {totalRoundsSafe}</span>
                </div>
                <div className="h-1 w-1 bg-muted-foreground rounded-full" />
                <div className="flex items-center space-x-1">
                  <span>Pick {draft?.currentPick ?? 1}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Completed Draft - Mobile Optimized Layout */}
          {draftStatus === 'completed' ? (
            <div className="space-y-4">
              {/* Header - Mobile Optimized */}
              <Card className="w-full">
                <CardContent className="p-4">
                  <div className="text-center space-y-4">
                    <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
                      <div className="text-green-700 dark:text-green-300 font-bold text-lg mb-1">
                        🎉 Draft Complete!
                      </div>
                      <div className="text-sm text-green-600 dark:text-green-400">
                        All {picksSafe?.length || 0} picks completed across {Math.max(...(picksSafe?.map(p => p.round) || [0]))} rounds
                      </div>
                    </div>
                    
                    <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
                      <Button 
                        onClick={() => {
                          // Record completed draft league for stable tab
                          if (draftData?.draft?.leagueId) {
                            localStorage.setItem('lastDraftLeagueId', draftData.draft.leagueId);
                          }
                          
                          // NAVIGATION FIX: Navigate first, then invalidate queries
                          navigate(`/league/${draftData?.draft?.leagueId}/waiting`);
                          
                          // Delay query invalidation to after navigation completes
                          setTimeout(() => {
                            queryClient.invalidateQueries({
                              predicate: (q) => String(q.queryKey?.[0] ?? '').startsWith('/api/user/stable/')
                            });
                          }, 100);
                        }}
                        variant="outline"
                        className="flex-1 sm:flex-none"
                        size="lg"
                      >
                        <ArrowLeft className="w-4 h-4 mr-2" />
                        Back to League
                      </Button>
                      <Button 
                        onClick={() => {
                          // Record completed draft league for stable tab
                          if (draftData?.draft?.leagueId) {
                            localStorage.setItem('lastDraftLeagueId', draftData.draft.leagueId);
                          }
                          
                          // NAVIGATION FIX: Navigate first, then invalidate queries to prevent page refresh
                          navigate('/');
                          
                          // Delay query invalidation to after navigation completes
                          setTimeout(() => {
                            queryClient.invalidateQueries({
                              predicate: (q) => String(q.queryKey?.[0] ?? '').startsWith('/api/user/stable/')
                            });
                            queryClient.invalidateQueries({ queryKey: ['/api/user/leagues'] });
                          }, 100);
                        }}
                        variant="default"
                        className="flex-1 sm:flex-none"
                        size="lg"
                      >
                        <Trophy className="w-4 h-4 mr-2" />
                        Main
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
                  
              {/* Draft Results - Mobile Optimized */}
              <Card className="w-full">
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg text-center">Final Draft Results</CardTitle>
                </CardHeader>
                <CardContent className="p-4">
                  {/* League Members and Their Teams - Mobile Layout */}
                  <div className="space-y-4">
                    {draftOrderSafe?.map((userId: string) => {
                      const userPicks = picksSafe?.filter(p => p.user.id === userId) || [];
                      const user = userPicks[0]?.user;
                      
                      if (!user) return null;
                      
                      return (
                        <div key={userId} className="p-3 bg-secondary/20 rounded-lg border">
                          <div className="flex items-center space-x-3 mb-3">
                            {user.avatar && (
                              <img 
                                src={user.avatar} 
                                alt={user.name} 
                                className="w-8 h-8 rounded-full"
                              />
                            )}
                            <div className="font-semibold text-lg">{user.name}</div>
                          </div>
                          {/* Mobile-Friendly Team Grid */}
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            {userPicks.map((pick) => (
                              <div 
                                key={pick.id} 
                                className="flex items-center space-x-2 p-2 bg-background/60 rounded-lg border text-sm"
                              >
                                <img 
                                  src={pick.nflTeam.logoUrl} 
                                  alt={pick.nflTeam.name}
                                  className="w-6 h-6 flex-shrink-0"
                                />
                                <div className="min-w-0 flex-1">
                                  <div className="font-medium truncate">{pick.nflTeam.name}</div>
                                  <div className="text-xs text-muted-foreground">
                                    Round {pick.round} {pick.isAutoPick ? '(Auto)' : ''}
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
                    
              {/* Free Agent Teams - Mobile Optimized */}
              {availableTeamsSafe && availableTeamsSafe.length > 0 && (
                <Card className="w-full">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg text-center">Free Agent Teams</CardTitle>
                  </CardHeader>
                  <CardContent className="p-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {availableTeamsSafe.slice(0, 4).map((team) => (
                        <div 
                          key={team.id} 
                          className="flex items-center space-x-3 p-3 bg-muted/30 rounded-lg border"
                        >
                          <img 
                            src={team.logoUrl} 
                            alt={team.name}
                            className="w-8 h-8 flex-shrink-0"
                          />
                          <div className="min-w-0 flex-1">
                            <div className="font-medium truncate">{team.name}</div>
                            <div className="text-xs text-muted-foreground">{team.conference}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
              
              {/* Draft Stats - Mobile Optimized */}
              <Card className="w-full">
                <CardContent className="p-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="text-center p-4 bg-secondary/30 rounded-lg">
                      <div className="text-2xl font-bold">{picksSafe?.filter(p => !p.isAutoPick).length || 0}</div>
                      <div className="text-xs text-muted-foreground">Manual Picks</div>
                    </div>
                    <div className="text-center p-4 bg-secondary/30 rounded-lg">
                      <div className="text-2xl font-bold">{picksSafe?.filter(p => p.isAutoPick).length || 0}</div>
                      <div className="text-xs text-muted-foreground">Auto Picks</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          ) : (
            /* Normal Draft Layout */
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
                  {draftStatus === 'not_started' ? (
                    <div className="text-center space-y-3">
                      <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                        <div className="text-blue-700 dark:text-blue-300 font-medium mb-2">
                          ⏳ Waiting for Draft to Start
                        </div>
                        <div className="text-sm text-blue-600 dark:text-blue-400 mb-3">
                          The league creator will start the draft when ready
                        </div>
                        <div className="flex items-center justify-center space-x-2 text-xs text-blue-500 dark:text-blue-400">
                          <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
                          <span>Connected - real-time updates enabled</span>
                        </div>
                      </div>
                  ) : draftStatus === 'starting' ? (
                    <div className="text-center space-y-3">
                      <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
                        <div className="text-green-700 dark:text-green-300 font-medium mb-2">
                          🚀 Draft Starting!
                        </div>
                        <div className="text-sm text-green-600 dark:text-green-400 mb-3">
                          Draft starts in
                        </div>
                        
                        {/* Countdown Display */}
                        <div className="text-4xl font-bold text-green-600 dark:text-green-400 mb-2 font-mono" aria-live="polite">
                          {formatTime(displayTime)}
                        </div>
                        
                        <div className="flex items-center justify-center space-x-2 text-xs text-green-500 dark:text-green-400">
                          <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                          <span>Draft starting soon</span>
                        </div>
                      </div>
                    </div>
                      
                      {/* Show start button if current user is creator */}
                      {user?.id === draftData?.league?.creatorId && (
                        <Button
                          onClick={async () => {
                            try {
                              const response = await fetch(`/api/drafts/${draftId}/start`, {
                                method: 'POST',
                                credentials: 'include'
                              });
                              if (response.ok) {
                                toast({
                                  title: "Draft Started!",
                                  description: "The timer is now running for the first pick."
                                });
                              }
                            } catch (error) {
                              toast({
                                title: "Failed to start draft",
                                description: "Please try again."
                              });
                            }
                          }}
                          className="w-full"
                          size="lg"
                        >
                          <Play className="w-4 h-4 mr-2" />
                          Start Draft
                        </Button>
                      )}
                    </div>
                  ) : state?.currentUserId ? (
                    <div className="text-center space-y-3">
                      {/* Current Player - Modern Style */}
                      <div className="flex items-center justify-center space-x-3 mb-4">
                        {currentPlayer?.avatar && (
                          <img 
                            src={currentPlayer.avatar} 
                            alt={currentPlayer.name} 
                            className="w-8 h-8 rounded-full border-2 border-background shadow-sm"
                          />
                        )}
                        <div className="text-center">
                          <div className="text-sm text-muted-foreground">On the clock</div>
                          <div className="font-medium text-foreground">
                            {currentPlayer?.name || 'Loading...'}
                          </div>
                        </div>
                      </div>
                      
                      {/* Timer - Keyed by phase to prevent React DOM mismatches */}
                      <div key={timerPhase}>
                        <div className={`text-3xl font-bold mb-3 font-mono transition-colors duration-300 ${
                          displayTime <= 0 ? 'text-red-500 animate-pulse' : 
                          displayTime <= 10 ? 'text-red-500 animate-pulse' : 
                          displayTime <= 30 ? 'text-orange-500' : 'text-foreground'
                        }`} aria-live="polite">
                          {draftStatus === 'completed' ? (
                            <span className="text-green-600 font-medium">
                              Draft Complete
                            </span>
                          ) : displayTime <= 0 && localTime === 0 && !isCountingDown ? (
                            <span className="text-muted-foreground">
                              —
                            </span>
                          ) : (
                            formatTime(displayTime)
                          )}
                        </div>
                        
                        {/* Clean Progress Bar */}
                        <div className="w-full mb-4">
                          <div className="relative h-2 bg-muted rounded-full overflow-hidden">
                            <div 
                              className={`h-full rounded-full transition-all duration-1000 ease-linear ${
                                displayTime <= 10 ? 'bg-red-500' : 
                                displayTime <= 30 ? 'bg-orange-500' : 
                                'bg-primary'
                              }`}
                              style={{
                                width: `${Math.max(0, (displayTime / pickTimeLimitSafe) * 100)}%`
                              }}
                            />
                          </div>
                          
                          {/* Clean time display */}
                          <div className="flex justify-between items-center mt-2 text-xs text-muted-foreground">
                            <span>0:00</span>
                            <span className={`font-medium ${
                              displayTime <= 10 ? 'text-red-500' : 
                              displayTime <= 30 ? 'text-orange-500' : 
                              'text-foreground'
                            }`}>
                              {displayTime <= 10 ? 'Time running out' : 'Time remaining'}
                            </span>
                            <span>{formatTime(pickTimeLimitSafe)}</span>
                          </div>
                        </div>
                        {isCurrentUser ? (
                          <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100 border-green-200 dark:border-green-800">
                            <Clock className="w-3 h-3 mr-1" />
                            Your pick
                          </Badge>
                        ) : (
                          <Badge variant="secondary" className="text-sm">
                            <Clock className="w-3 h-3 mr-1" />
                            {currentPlayer?.name || 'Player'} is picking
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
                    <Badge variant="outline" className="text-xs">Round {currentRoundSafe}</Badge>
                  </CardTitle>
                  <div className="text-xs text-muted-foreground">
                    Direction changes each round
                  </div>
                </CardHeader>
                <CardContent>
                  {(() => {
                    // Calculate snake draft order for current round
                    const baseOrder = draftOrderSafe || [];
                    const isOddRound = currentRoundSafe % 2 === 1;
                    const currentRoundOrder = isOddRound ? baseOrder : [...baseOrder].reverse();
                    
                    // Find current pick index and calculate upcoming picks
                    const currentPickIndex = currentRoundOrder.findIndex((userId: string) => userId === state?.currentUserId);
                    const totalPicks = currentRoundOrder.length;
                    
                    return (
                      <div className="space-y-3">
                        {/* Round Direction Indicator */}
                        <div className="flex items-center justify-center space-x-2 p-2 bg-secondary/30 rounded-lg">
                          <div className="text-xs font-medium">
                            Round {currentRoundSafe} Direction:
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
                          {currentRoundOrder.map((userId: string, index: number) => {
                            const userPicks = picksSafe.filter(p => p.user.id === userId);
                            const isCurrentPick = userId === state?.currentUserId;
                            const isUpNext = index === currentPickIndex + 1;
                            const isJustPicked = index === currentPickIndex - 1;
                            const pickPosition = index + 1;
                            
                            // Calculate actual pick number in the draft
                            const pickNumber = ((currentRoundSafe - 1) * totalPicks) + pickPosition;
                            
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
                        {currentRoundSafe < totalRoundsSafe && (
                          <div className="mt-4 p-3 bg-secondary/20 rounded-lg border border-dashed border-secondary">
                            <div className="text-xs font-medium text-muted-foreground mb-2">
                              Round {currentRoundSafe + 1} Preview:
                            </div>
                            <div className="flex items-center space-x-2 text-xs text-muted-foreground">
                              <span>Direction will be:</span>
                              {(currentRoundSafe + 1) % 2 === 1 ? (
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
                      {picksSafe.slice(-8).reverse().map((pick) => (
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
                      {availableTeamsSafe?.length || 0} available • {picksSafe?.length || 0} drafted
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  {isCurrentUser && state?.canMakePick && (
                    <div className="mb-4 p-3 bg-fantasy-purple/10 rounded-lg border border-fantasy-purple/20">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">
                          {selectedTeam ? 'Team selected' : 'Select a team to draft'}
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

                  {/* Vibration Test Button (Development) */}
                  {(() => { try { return import.meta.env.DEV; } catch { return false; } })() && (
                    <div className="mb-4 p-2 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg border border-yellow-200">
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-yellow-800 dark:text-yellow-200">Vibration Test</span>
                        <Button 
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            console.log('[VIBRATION TEST] Testing vibration...');
                            const result = vibrate([200, 100, 200]);
                            console.log('[VIBRATION TEST] Result:', result);
                            
                            // Also test if HTTPS is the issue
                            console.log('[VIBRATION TEST] Protocol:', window.location.protocol);
                            console.log('[VIBRATION TEST] Navigator vibrate:', 'vibrate' in navigator);
                            console.log('[VIBRATION TEST] User agent:', navigator.userAgent);
                          }}
                        >
                          Test Vibration
                        </Button>
                      </div>
                    </div>
                  )}

                  {/* Quick Team Search */}
                  <div className="relative mb-4">
                    <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <input
                      type="text"
                      placeholder="Search teams, cities, divisions..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="w-full pl-9 pr-10 py-2 border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent"
                      data-testid="input-team-search"
                    />
                    {searchTerm && (
                      <button
                        onClick={() => setSearchTerm('')}
                        className="absolute right-3 top-3 text-muted-foreground hover:text-foreground"
                        data-testid="button-clear-search"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    )}
                  </div>

                  <ScrollArea className="h-96">
                    {/* Modern Swipe-Enabled Conference Selection */}
                    <div 
                      className="w-full"
                      onTouchStart={handleTouchStart}
                      onTouchEnd={handleTouchEnd}
                    >
                      {/* Conference Toggle with Visual Indicators */}
                      <div className="grid w-full grid-cols-2 mb-4 bg-secondary/20 rounded-lg p-1">
                        <button
                          onClick={() => setCurrentConference('AFC')}
                          className={`py-2 px-4 rounded-md text-sm font-medium transition-all duration-200 ${
                            currentConference === 'AFC' 
                              ? 'bg-background shadow-sm text-foreground' 
                              : 'text-muted-foreground hover:text-foreground'
                          }`}
                        >
                          AFC ({(filterTeams(availableTeamsSafe?.filter(team => team.conference === 'AFC') || [])?.length || 0)} available)
                        </button>
                        <button
                          onClick={() => setCurrentConference('NFC')}
                          className={`py-2 px-4 rounded-md text-sm font-medium transition-all duration-200 ${
                            currentConference === 'NFC' 
                              ? 'bg-background shadow-sm text-foreground' 
                              : 'text-muted-foreground hover:text-foreground'
                          }`}
                        >
                          NFC ({(filterTeams(availableTeamsSafe?.filter(team => team.conference === 'NFC') || [])?.length || 0)} available)
                        </button>
                      </div>
                      
                      {/* Swipe Indicator */}
                      <div className="flex justify-center mb-3">
                        <div className="text-xs text-muted-foreground flex items-center space-x-2">
                          <ChevronUp className="w-3 h-3 rotate-180" />
                          <span>Swipe to switch conferences</span>
                          <ChevronUp className="w-3 h-3" />
                        </div>
                      </div>

                      {/* Conference Content with Smooth Transitions */}
                      <div className="transition-all duration-300 ease-in-out">
                        <div className="space-y-4">
                          {renderConferenceTeams(currentConference)}
                        </div>
                      </div>
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>
            </div>

          </div>
            )}
        </div>

        {/* Draft Completion Navigation */}
        {draftData?.state?.draft?.status === 'completed' && (
          <div className="mt-8 mx-4 lg:mx-8">
            <Card className="border-green-500 bg-green-50 dark:bg-green-950/30">
              <CardContent className="pt-6">
                <div className="text-center space-y-4">
                  <div className="flex items-center justify-center space-x-2">
                    <Trophy className="w-6 h-6 text-green-600" />
                    <h3 className="text-xl font-bold text-green-700 dark:text-green-400">Draft Completed!</h3>
                  </div>
                  <p className="text-sm text-green-600 dark:text-green-300">
                    All picks have been made. Your fantasy season is ready to begin!
                  </p>
                  <div className="flex flex-col sm:flex-row gap-3 justify-center">
                    <Button 
                      onClick={() => {
                        // Force refresh user leagues data and navigate to main
                        queryClient.invalidateQueries({ queryKey: ['/api/user/leagues'] });
                        navigate('/main');
                      }}
                      size="lg"
                      className="bg-green-600 hover:bg-green-700"
                    >
                      <Trophy className="w-4 h-4 mr-2" />
                      Go to Main App
                    </Button>
                    <Button 
                      onClick={() => {
                        const currentLeague = leagueData?.find((l: any) => l.draftId === draftData?.state?.draft?.id);
                        if (currentLeague) {
                          navigate(`/league/waiting?id=${currentLeague.id}`);
                        }
                      }}
                      variant="outline"
                      size="lg"
                    >
                      <ArrowLeft className="w-4 h-4 mr-2" />
                      Back to League
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Floating Action Button (FAB) for Draft Pick */}
        {showFAB && (
          <div className="fixed bottom-6 right-6 z-40">
            <Button
              onClick={handleMakePick}
              disabled={makePickMutation.isPending}
              size="lg"
              className="h-14 w-14 rounded-full shadow-lg bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white border-0 transition-all duration-300 hover:scale-105"
            >
              {makePickMutation.isPending ? (
                <RotateCcw className="w-6 h-6 animate-spin" />
              ) : (
                <Plus className="w-6 h-6" />
              )}
            </Button>
            
            {/* FAB Tooltip */}
            <div className="absolute bottom-16 right-0 bg-black/90 text-white text-xs px-3 py-2 rounded-lg whitespace-nowrap opacity-0 pointer-events-none transition-opacity duration-200 hover:opacity-100">
              Draft Selected Team
            </div>
          </div>
        )}

      </div>
    </div>
  );
}