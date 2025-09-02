import { useState, useEffect, useRef, startTransition, useMemo } from "react";
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
import type { DraftState, NflTeam, DraftPick } from '@shared/types/draft';

// ✅ Import shared constants from centralized draft-types (no duplication)
import { TIMER_CONSTANTS, DRAFT_UI_CONSTANTS } from '@/draft/draft-types';
import type { TeamStatus, Conference } from '@/draft/draft-types';

// Extract constants to avoid duplication
const { DEFAULT_PICK_TIME_LIMIT } = TIMER_CONSTANTS;
const { MINIMUM_SWIPE_DISTANCE, TIMER_WARNING_THRESHOLDS, NOTIFICATION_COOLDOWN, VIBRATION_PATTERNS } = DRAFT_UI_CONSTANTS;

// ✅ HOISTED helpers (functions, not const fns)
export function normalizeDraftResponse(raw: any): any {
  const state = raw?.state ?? raw ?? {};
  const participants = state.participants ?? raw.participants ?? [];
  return {
    id: raw.id ?? state.id ?? null,
    leagueId: raw.leagueId ?? state.leagueId ?? null,
    status: raw.status ?? state.status ?? state.phase ?? 'waiting',
    currentPlayerId:
      raw.currentPlayerId ?? raw.currentPlayer?.id ?? state.currentPlayerId ?? null,
    participants,
    timerSeconds:
      raw.timer?.remaining ??
      state.timer?.remaining ??
      0,
    // preserve compatibility
    state: raw.state,
    draft: raw.draft || raw.state?.draft,
    isCurrentUser: raw.isCurrentUser,
    currentPlayer: raw.currentPlayer ?? raw.state?.currentPlayer ?? null,
    league: raw.league ?? raw.state?.league ?? null
  };
}

function computeWsUrl(origin: string, draftId: string): string {
  const base = origin.replace(/^http/i, 'ws');
  return `${base}/ws/draft/${draftId}`;
}

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function getConferenceColor(conference: Conference): string {
  return conference === 'AFC' ? 'bg-red-500/10 text-red-700 dark:text-red-300' : 'bg-blue-500/10 text-blue-700 dark:text-blue-300';
}

function getTimerRingColor(displayTime: number): string {
  if (displayTime <= TIMER_WARNING_THRESHOLDS.URGENT) return 'stroke-red-500 animate-pulse';
  if (displayTime <= TIMER_WARNING_THRESHOLDS.WARNING) return 'stroke-orange-500';
  if (displayTime <= TIMER_WARNING_THRESHOLDS.CAUTION) return 'stroke-yellow-500';
  return 'stroke-green-500';
}

function getBackgroundColor(isCurrentUser: boolean, displayTime: number): string {
  if (!isCurrentUser) return '';
  if (displayTime <= TIMER_WARNING_THRESHOLDS.URGENT) return 'bg-red-50 dark:bg-red-950/20 animate-pulse';
  if (displayTime <= TIMER_WARNING_THRESHOLDS.WARNING) return 'bg-orange-50 dark:bg-orange-950/20';
  if (displayTime <= TIMER_WARNING_THRESHOLDS.CAUTION) return 'bg-yellow-50 dark:bg-yellow-950/20';
  return 'bg-green-50 dark:bg-green-950/20';
}

function getTeamStatus(team: NflTeam, picksSafe: DraftPick[], isCurrentUser: boolean, state: DraftState, userId?: string): TeamStatus {
  const isDrafted = picksSafe.some(p => p.nflTeam.id === team.id);
  if (isDrafted) return 'taken';
  
  // Check division conflict for current user (must match conference + division)
  if (isCurrentUser && state?.canMakePick) {
    const userPicks = picksSafe.filter(p => p.user.id === userId) || [];
    const hasDivisionConflict = userPicks.some(
      p => `${p.nflTeam.conference} ${p.nflTeam.division}` === `${team.conference} ${team.division}`
    );
    if (hasDivisionConflict) return 'conflict';
  }
  
  return 'available';
}

function filterTeamsBySearch(teams: NflTeam[], searchTerm: string): NflTeam[] {
  if (!searchTerm.trim()) return teams;
  
  const lowerSearch = searchTerm.toLowerCase();
  return teams.filter(team => 
    team.name.toLowerCase().includes(lowerSearch) ||
    team.city.toLowerCase().includes(lowerSearch) ||
    team.abbreviation.toLowerCase().includes(lowerSearch)
  );
}

function vibrateDevice(pattern: number | number[]): boolean {
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
}

function sendNotificationToUser(title: string, options?: NotificationOptions): void {
  if ('Notification' in window && Notification.permission === 'granted') {
    new Notification(title, {
      icon: '/icon-192x192.png',
      badge: '/icon-192x192.png',
      ...options
    });
  }
}

async function requestNotificationPermissionFromUser(): Promise<void> {
  if ('Notification' in window && 'serviceWorker' in navigator) {
    if (Notification.permission === 'default') {
      await Notification.requestPermission();
    }
  }
}

// ✅ React component last
export default function DraftPage() {
  // CRITICAL: All early returns must happen BEFORE any hooks to prevent Rules of Hooks violations
  const params = useParams();
  const urlDraftId = (params as any).draftId;
  
  // ALL HOOKS MUST BE CALLED CONSISTENTLY - cannot return early after calling hooks
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
  const [currentConference, setCurrentConference] = useState<Conference>('AFC');
  const [touchStartX, setTouchStartX] = useState<number>(0);
  const [showFAB, setShowFAB] = useState(false);
  const [starting, setStarting] = useState(false);
  
  // Enhanced timer state for smooth countdown
  const [serverTime, setServerTime] = useState<number>(0);
  const [localTime, setLocalTime] = useState<number>(0);
  const [lastServerUpdate, setLastServerUpdate] = useState<number>(0);
  const [isCountingDownState, setIsCountingDown] = useState<boolean>(false);
  
  // Prevent notification spam
  const [lastNotificationTime, setLastNotificationTime] = useState<number>(0);
  const [hasNotifiedForThisTurn, setHasNotifiedForThisTurn] = useState<boolean>(false);

  // Fetch user's leagues to get the current draft ID
  const { data: leagueData } = useQuery({
    queryKey: ['/api/leagues/user'],
    queryFn: async () => {
      return await apiRequest('GET', '/api/leagues/user');
    },
    enabled: !!user && !authLoading,
    staleTime: 1000 * 10, // Cache for 10 seconds
  });

  // Request notification permission on mount
  useEffect(() => {
    requestNotificationPermissionFromUser();
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

  // Fetch draft state with priority to establish connection rules
  const { data: draftData, isLoading, error } = useQuery({
    queryKey: ['draft', draftId, 'state'], // Include 'state' for specificity
    queryFn: async ({ signal }) => {
      console.log('[Draft] === STARTING DRAFT FETCH ===');
      console.log('[Draft] Draft ID:', draftId);
      console.log('[Draft] Auth status - User:', user?.name, 'Authenticated:', isAuthenticated, 'Loading:', authLoading);
      
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
          url: response.url
        });
        
        if (!response.ok) {
          const errorText = await response.text();
          console.error('[Draft] API Error Response:', errorText);
          throw new Error(`Draft request failed: ${response.status} ${response.statusText}`);
        }
        
        const data = await response.json();
        console.log('[Draft] ✅ Draft data received successfully:', data);
        
        // Normalize the Draft API response using hoisted function
        const normalized = normalizeDraftResponse(data);
        console.log('[Draft] 🔧 Normalized response:', normalized);
        
        return normalized;
      } catch (error) {
        console.error('[Draft] ❌ Error fetching draft data:', error);
        throw error;
      }
    },
    enabled: !!draftId && !!user && !authLoading,
    staleTime: 2000, // 2 seconds to balance real-time needs with performance
    refetchInterval: (queryData: any) => {
      // Only poll if draft is active and we're waiting for updates
      return queryData?.status === 'active' || queryData?.status === 'starting' ? 3000 : false;
    },
    retry: (failureCount, error) => {
      console.log(`[Draft] Query retry ${failureCount}, error:`, error);
      return failureCount < 3;
    }
  });

  // Simple, TDZ-proof WebSocket connection logic - only based on auth readiness and draftId
  const authReady = !authLoading && !!user;
  const canConnect = authReady && Boolean(draftId);
  const wsUrl = canConnect 
    ? useMemo(() => {
        const baseUrl = import.meta.env.VITE_WS_BASE_URL || window.location.origin;
        return computeWsUrl(baseUrl, draftId!);
      }, [draftId])
    : null;

  console.log('[Draft] WebSocket connection decision:', { 
    authReady, 
    canConnect, 
    draftId: draftId || 'none',
    wsUrl: wsUrl || 'none' 
  });
  
  const { status: connectionStatus, message: lastMessage } = useResilientWebSocket(wsUrl);
  const isConnected = connectionStatus === 'open';

  // Redirect if no draft ID
  useEffect(() => {
    if (!draftId) {
      navigate('/dashboard');
    }
  }, [draftId, navigate]);

  // NORMALIZE SERVER DATA FOR JSX - JSX only reads from normalized object (never nested state)
  // This prevents JSX from accidentally calling helpers that use uninitialized symbols
  const normalized = useMemo(() => {
    if (!draftData) {
      // Safe fallback structure when no data
      return {
        // Draft metadata
        id: draftId || '',
        status: 'not_started' as const,
        leagueId: '',
        
        // Timer data
        timerSeconds: 0,
        isCountingDown: false,
        displayTime: 0,
        
        // User and permissions
        currentPlayerId: null,
        isCurrentUser: false,
        participants: [],
        
        // Draft progress
        currentRound: 1,
        currentPick: 1,
        totalRounds: 5,
        pickTimeLimit: DEFAULT_PICK_TIME_LIMIT,
        draftOrder: [],
        
        // Data arrays
        picks: [],
        availableTeams: [],
        
        // UI state
        canMakePick: false
      };
    }
    
    // Extract safe data from potentially complex nested structure
    const state: DraftState = (draftData.state ?? {}) as DraftState;
    const draft = draftData.state?.draft ?? null;
    
    // Enhanced isCurrentUser calculation with multiple auth provider ID fields
    const myId = user?.id || (user as any)?.sub || (user as any)?.userId || (user as any)?.uid || '';
    const isCurrentUser = draftData.participants?.some(
      (p: any) =>
        p?.userId === myId ||
        p?.id === myId ||
        (p?.email && p.email === user?.email)
    ) && draftData.currentPlayerId === myId;
    
    const status = draftData.status ?? 'not_started';
    const timerSeconds = draftData.timerSeconds ?? 0;
    
    return {
      // Draft metadata
      id: draftData.id ?? draftId ?? '',
      status,
      leagueId: draftData.leagueId ?? '',
      
      // Timer data
      timerSeconds,
      isCountingDown: status === 'active',
      displayTime: timerSeconds, // Will be updated by smooth timer logic
      
      // User and permissions
      currentPlayerId: draftData.currentPlayerId ?? null,
      isCurrentUser,
      participants: draftData.participants ?? [],
      
      // Draft progress
      currentRound: draft?.currentRound ?? 1,
      currentPick: draft?.currentPick ?? 1,
      totalRounds: draft?.totalRounds ?? 5,
      pickTimeLimit: draft?.pickTimeLimit ?? DEFAULT_PICK_TIME_LIMIT,
      draftOrder: draft?.draftOrder ?? [],
      
      // Data arrays
      picks: state.picks ?? [],
      availableTeams: state.availableTeams ?? [],
      
      // UI state
      canMakePick: state.canMakePick ?? false
    };
  }, [draftData, draftId, user]);
  
  // JSX-safe aliases for backward compatibility (but prefer using normalized directly)
  const draftStatus = normalized.status;
  const isCountingDown = normalized.isCountingDown;
  const currentPlayerId = normalized.currentPlayerId;
  const isCurrentUser = normalized.isCurrentUser;
  const picksSafe = normalized.picks;
  const availableTeamsSafe = normalized.availableTeams;
  const currentRoundSafe = normalized.currentRound;
  const pickTimeLimitSafe = normalized.pickTimeLimit;

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
      draftData?.timerSeconds;

    if (newServerTime !== undefined && newServerTime !== serverTime) {
      console.log('[SMOOTH TIMER] Server update received:', newServerTime);
      
      // Mobile UX: Vibration alerts for timer warnings
      if (normalized.isCurrentUser) {
        if (newServerTime <= TIMER_WARNING_THRESHOLDS.CAUTION && newServerTime > 25 && serverTime > 30) {
          console.log('[VIBRATION] 30s warning triggered');
          vibrateDevice(VIBRATION_PATTERNS.WARNING);
        } else if (newServerTime <= TIMER_WARNING_THRESHOLDS.WARNING && newServerTime > 5 && serverTime > 10) {
          console.log('[VIBRATION] 10s warning triggered');
          vibrateDevice(VIBRATION_PATTERNS.URGENT);
        } else if (newServerTime <= TIMER_WARNING_THRESHOLDS.URGENT && newServerTime > 0 && serverTime > 5) {
          console.log('[VIBRATION] 5s urgent warning triggered');
          vibrateDevice(VIBRATION_PATTERNS.CRITICAL);
        }
      }
      
      // PREDICTIVE TIMER FIX: If we receive a "fresh" timer (55+ seconds), immediately switch
      const isFreshTimer = newServerTime >= 55 && serverTime < 10;
      
      if (isFreshTimer) {
        console.log('[SMOOTH TIMER] 🎯 Fresh timer detected - immediate transition');
        // Mobile UX: Notify user it's their turn (ONLY ONCE)
        if (normalized.isCurrentUser && !hasNotifiedForThisTurn) {
          const now = Date.now();
          // Prevent duplicate notifications within 30 seconds
          if (now - lastNotificationTime > NOTIFICATION_COOLDOWN) {
            vibrateDevice(VIBRATION_PATTERNS.YOUR_TURN);
            sendNotificationToUser('Your Draft Pick!', {
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
      
      // Reset zero tracking on fresh updates
      if (newServerTime > 0) {
        setZeroSince(null);
      }
    }
  }, [lastMessage, draftData, serverTime, isCurrentUser, hasNotifiedForThisTurn, lastNotificationTime, localTime]);
  
  // Reset notification flag when it's no longer user's turn
  useEffect(() => {
    if (!normalized.isCurrentUser && hasNotifiedForThisTurn) {
      setHasNotifiedForThisTurn(false);
    }
  }, [normalized.isCurrentUser, hasNotifiedForThisTurn]);

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

  // Display logic with smooth transitions and integer rounding - using normalized data
  const displayTime = useMemo(() => {
    const rawTime = normalized.isCountingDown ? localTime : (serverTime || normalized.timerSeconds);
    // Smooth to integer if showing whole seconds (avoids 59.999 → 59 flicker)
    return Math.floor(rawTime + 1e-6);
  }, [normalized.isCountingDown, localTime, serverTime, normalized.timerSeconds]);
  
  console.log('[TIMER DEBUG] Server Time:', serverTime);
  console.log('[TIMER DEBUG] Display Time:', displayTime);
  console.log('[TIMER DEBUG] Current Player:', currentPlayerId);
  console.log('[NORMALIZED FIELDS] Status:', draftStatus, 'CurrentPlayerId:', currentPlayerId, 'TimerSeconds:', normalized.timerSeconds, 'IsCountingDown:', isCountingDown);

  // Event handlers using hoisted functions
  const handleTouchStart = (e: React.TouchEvent) => {
    setTouchStartX(e.touches[0].clientX);
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    const touchEndX = e.changedTouches[0].clientX;
    const diff = touchStartX - touchEndX;
    
    if (Math.abs(diff) > MINIMUM_SWIPE_DISTANCE) {
      if (diff > 0 && currentConference === 'AFC') {
        setCurrentConference('NFC');
      } else if (diff < 0 && currentConference === 'NFC') {
        setCurrentConference('AFC');
      }
    }
  };

  const handleMakePick = () => {
    if (selectedTeam && normalized.isCurrentUser && normalized.canMakePick) {
      makePickMutation.mutate(selectedTeam);
    }
  };

  const onStartDraft = async () => {
    if (!draftId) return;
    
    setStarting(true);
    try {
      await apiRequest('POST', `/api/leagues/${draftData?.leagueId}/draft/start`);
      toast({
        title: "Draft started!",
        description: "The draft has begun. Good luck!",
      });
      
      // Invalidate queries to refresh data
      queryClient.invalidateQueries({ queryKey: ['draft', draftId] });
    } catch (error: any) {
      toast({
        title: "Failed to start draft",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setStarting(false);
    }
  };

  // Show FAB when it's user's turn - using normalized data
  useEffect(() => {
    setShowFAB(normalized.isCurrentUser && normalized.canMakePick && !!selectedTeam);
  }, [normalized.isCurrentUser, normalized.canMakePick, selectedTeam]);

  // Auto-expand panels when user's turn approaches
  useEffect(() => {
    if (displayTime <= TIMER_WARNING_THRESHOLDS.CAUTION && isCurrentUser) {
      setPanelsCollapsed(false);
    }
  }, [displayTime, isCurrentUser]);

  // TIMER FIX: Use actual draft timer limit instead of hardcoded value
  const draftTimerLimit = pickTimeLimitSafe;
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

  // Loading states
  if (!draftId) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <h2 className="text-xl font-semibold mb-2">No Draft Found</h2>
          <p className="text-muted-foreground mb-4">You don't have an active draft.</p>
          <Button onClick={() => navigate('/dashboard')}>
            Go to Dashboard
          </Button>
        </div>
      </div>
    );
  }

  const loadingReason = !user ? 'authentication' : 
                       authLoading ? 'authentication loading' :
                       isLoading ? 'draft data loading' :
                       !draftData ? 'no draft data' : 
                       null;

  if (loadingReason) {
    console.log('[Draft] RENDER: Loading state -', loadingReason, '- authLoading:', authLoading, 'isLoading:', isLoading, 'draftData:', !!draftData);
    
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center space-y-4">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <p className="text-sm text-muted-foreground capitalize">{loadingReason}...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <h2 className="text-xl font-semibold mb-2">Error Loading Draft</h2>
          <p className="text-muted-foreground mb-4">{error.message}</p>
          <Button onClick={() => queryClient.invalidateQueries({ queryKey: ['draft', draftId] })}>
            Try Again
          </Button>
        </div>
      </div>
    );
  }

  // Helper function for rendering teams using hoisted functions - normalized data
  const renderConferenceTeams = (conference: Conference) => {
    const allTeams = teamsData?.availableTeams || normalized.availableTeams;
    const conferenceTeams = allTeams.filter((team: NflTeam) => team.conference === conference);
    const filteredTeams = filterTeamsBySearch(conferenceTeams, searchTerm);
    
    if (filteredTeams.length === 0) {
      return (
        <div className="text-center py-8 text-muted-foreground">
          {searchTerm ? 'No teams match your search' : 'No teams available'}
        </div>
      );
    }

    // Group teams by division
    const divisions = filteredTeams.reduce((acc, team) => {
      const divisionKey = `${team.conference} ${team.division}`;
      if (!acc[divisionKey]) acc[divisionKey] = [];
      acc[divisionKey].push(team);
      return acc;
    }, {} as Record<string, NflTeam[]>);

    return (
      <div className="space-y-6">
        {Object.entries(divisions).map(([division, teams]) => (
          <div key={division}>
            <h4 className="font-medium text-sm text-muted-foreground mb-3 px-1">
              {division}
            </h4>
            <div className="grid grid-cols-1 gap-2">
              {teams.map((team) => {
                const teamStatus = getTeamStatus(team, normalized.picks, normalized.isCurrentUser, normalized, user?.id);
                const isSelected = selectedTeam === team.id;
                const isDisabled = teamStatus !== 'available' || !normalized.canMakePick || !normalized.isCurrentUser;
                
                return (
                  <button
                    key={team.id}
                    onClick={() => !isDisabled && setSelectedTeam(isSelected ? null : team.id)}
                    disabled={isDisabled}
                    data-testid={`button-select-team-${team.code.toLowerCase()}`}
                    className={`
                      w-full p-3 rounded-lg border-2 transition-all duration-200 text-left
                      ${isSelected 
                        ? 'border-primary bg-primary/10 shadow-md' 
                        : 'border-transparent hover:border-muted-foreground/20'
                      }
                      ${teamStatus === 'taken' 
                        ? 'opacity-50 cursor-not-allowed bg-muted/30' 
                        : teamStatus === 'conflict'
                        ? 'opacity-60 cursor-not-allowed bg-orange-50 dark:bg-orange-950/20 border-orange-200 dark:border-orange-800'
                        : 'hover:bg-muted/50 cursor-pointer'
                      }
                      ${!normalized.isCurrentUser || !normalized.canMakePick 
                        ? 'cursor-not-allowed opacity-75' 
                        : ''
                      }
                    `}
                  >
                    <div className="flex items-center gap-3">
                      <div className="relative flex-shrink-0">
                        <TeamLogo teamCode={team.code} size="sm" />
                        {teamStatus === 'taken' && (
                          <div className="absolute inset-0 flex items-center justify-center bg-black/20 rounded">
                            <CheckCircle className="w-4 h-4 text-white" />
                          </div>
                        )}
                        {teamStatus === 'conflict' && (
                          <div className="absolute inset-0 flex items-center justify-center bg-orange-500/20 rounded">
                            <X className="w-4 h-4 text-orange-600" />
                          </div>
                        )}
                      </div>
                      <div className="flex-1">
                        <div className="font-medium text-sm">
                          {team.city} {team.name}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {team.code} • {team.division}
                        </div>
                      </div>
                      {isSelected && (
                        <div className="flex-shrink-0">
                          <Circle className="w-5 h-5 text-primary" fill="currentColor" />
                        </div>
                      )}
                      {teamStatus === 'conflict' && (
                        <Badge variant="outline" className="text-xs border-orange-300 text-orange-600">
                          Division
                        </Badge>
                      )}
                      {teamStatus === 'taken' && (
                        <Badge variant="secondary" className="text-xs">
                          Taken
                        </Badge>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    );
  };

  // Main render - using normalized data for all JSX
  return (
    <div className={`min-h-screen transition-colors duration-300 ${getBackgroundColor(normalized.isCurrentUser, displayTime)}`}>
      {/* Header */}
      <div className="sticky top-0 z-50 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b">
        <div className="flex items-center justify-between p-4">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate('/dashboard')}
              data-testid="button-back-to-dashboard"
            >
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <div>
              <h1 className="font-semibold text-lg">Draft Room</h1>
              <p className="text-xs text-muted-foreground">
                Round {normalized.currentRound} • Pick {normalized.currentPick}
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <Badge variant={isConnected ? "default" : "destructive"} className="text-xs">
              {isConnected ? (
                <>
                  <Wifi className="w-3 h-3 mr-1" />
                  Live
                </>
              ) : (
                <>
                  <WifiOff className="w-3 h-3 mr-1" />
                  Offline
                </>
              )}
            </Badge>
          </div>
        </div>
      </div>

      {/* Timer Section */}
      {normalized.status === 'active' && (
        <div className="p-4 border-b bg-card/50">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-2xl font-bold tabular-nums">
                {formatTime(displayTime)}
              </div>
              <div className="text-sm text-muted-foreground">
                {normalized.isCurrentUser ? 'Your turn to pick!' : `Waiting for pick...`}
              </div>
            </div>
            
            <div className="relative w-16 h-16">
              <svg className="w-16 h-16 -rotate-90 transform">
                <circle
                  cx="32"
                  cy="32"
                  r="28"
                  stroke="currentColor"
                  strokeWidth="3"
                  fill="transparent"
                  className="text-muted-foreground/20"
                />
                <circle
                  cx="32"
                  cy="32"
                  r="28"
                  stroke="currentColor"
                  strokeWidth="3"
                  fill="transparent"
                  strokeDasharray={`${2 * Math.PI * 28}`}
                  strokeDashoffset={`${2 * Math.PI * 28 * (1 - progressPercentage)}`}
                  className={`transition-all duration-1000 ${getTimerRingColor(displayTime)}`}
                  strokeLinecap="round"
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <Clock className={`w-6 h-6 ${displayTime <= TIMER_WARNING_THRESHOLDS.URGENT ? 'animate-pulse text-red-500' : 'text-muted-foreground'}`} />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className="flex-1 p-4 space-y-4">
        {normalized.status === 'not_started' && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Play className="w-5 h-5" />
                Ready to Draft
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground mb-4">
                All players are ready. Start the draft when everyone is prepared.
              </p>
              <Button 
                onClick={onStartDraft}
                disabled={starting}
                className="w-full"
                data-testid="button-start-draft"
              >
                {starting ? 'Starting...' : 'Start Draft'}
              </Button>
            </CardContent>
          </Card>
        )}

        {normalized.status === 'active' && (
          <Tabs value={currentConference} onValueChange={(value) => setCurrentConference(value as 'AFC' | 'NFC')}>
            <div className="flex items-center justify-between mb-4">
              <TabsList>
                <TabsTrigger value="AFC" className={getConferenceColor('AFC')}>
                  AFC
                </TabsTrigger>
                <TabsTrigger value="NFC" className={getConferenceColor('NFC')}>
                  NFC
                </TabsTrigger>
              </TabsList>
              
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Search teams..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 pr-4 py-2 text-sm border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                  data-testid="input-search-teams"
                />
                {searchTerm && (
                  <button
                    onClick={() => setSearchTerm('')}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2"
                    data-testid="button-clear-search"
                  >
                    <X className="w-4 h-4 text-muted-foreground hover:text-foreground" />
                  </button>
                )}
              </div>
            </div>

            <TabsContent value="AFC" className="mt-0">
              <ScrollArea className="h-[60vh]" onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}>
                <div className="pr-4">
                  {renderConferenceTeams('AFC')}
                </div>
              </ScrollArea>
            </TabsContent>

            <TabsContent value="NFC" className="mt-0">
              <ScrollArea className="h-[60vh]" onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}>
                <div className="pr-4">
                  {renderConferenceTeams('NFC')}
                </div>
              </ScrollArea>
            </TabsContent>
          </Tabs>
        )}
      </div>

      {/* Floating Action Button */}
      {showFAB && (
        <div className="fixed bottom-6 right-6 z-50">
          <Button
            size="lg"
            onClick={handleMakePick}
            disabled={makePickMutation.isPending}
            className="rounded-full shadow-lg"
            data-testid="button-make-pick"
          >
            {makePickMutation.isPending ? (
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
            ) : (
              <>
                <Zap className="w-5 h-5 mr-2" />
                Draft Pick
              </>
            )}
          </Button>
        </div>
      )}

      {/* Celebration Animation */}
      {showCelebration && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="text-center space-y-4 animate-in fade-in-0 zoom-in-95 duration-500">
            <div className="text-6xl animate-bounce">🎉</div>
            <h2 className="text-2xl font-bold text-white">Pick Made!</h2>
            <p className="text-white/80">Great choice!</p>
          </div>
        </div>
      )}
    </div>
  );
}