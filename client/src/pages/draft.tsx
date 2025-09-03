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
import { apiFetch } from "@/lib/api";
import { useDraftWebSocket } from "@/hooks/use-draft-websocket-fixed";
import { useAuth } from "@/features/auth/useAuth";
import { endpoints, wsUrl } from "@/lib/endpoints";
import type { DraftState, NflTeam, DraftPick } from '@shared/types/draft';

// ✅ Import shared constants from centralized draft-types (no duplication)
import { TIMER_CONSTANTS, DRAFT_UI_CONSTANTS } from '@/draft/draft-types';
import type { TeamStatus, Conference } from '@/draft/draft-types';

// Extract constants to avoid duplication
const { DEFAULT_PICK_TIME_LIMIT } = TIMER_CONSTANTS;
const { MINIMUM_SWIPE_DISTANCE, TIMER_WARNING_THRESHOLDS, NOTIFICATION_COOLDOWN, VIBRATION_PATTERNS } = DRAFT_UI_CONSTANTS;

// ✅ Normalize every draft payload into one consistent shape
function normalizeDraft(raw: any) {
  const s = raw?.state ?? raw ?? {};
  return {
    id: raw.id ?? s.id ?? null,
    leagueId: raw.leagueId ?? s.leagueId ?? null,
    status: raw.status ?? s.status ?? s.phase ?? "waiting",
    currentPlayerId: raw.currentPlayerId ?? raw.currentPlayer?.id ?? s.currentPlayerId ?? null,
    participants: raw.participants ?? s.participants ?? [],
    timerSeconds: raw.timer?.remaining ?? s.timer?.remaining ?? 0,
  };
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
    team.code.toLowerCase().includes(lowerSearch)
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
  const urlParams = useParams();
  const urlDraftId = (urlParams as any).draftId;
  
  // ALL HOOKS MUST BE CALLED CONSISTENTLY - cannot return early after calling hooks
  const [location, navigate] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const auth = useAuth(); // Auth declared early
  
  // Store normalized draft state
  const [draftData, setDraftData] = useState<any | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [displaySeconds, setDisplaySeconds] = useState(0);
  
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
  
  // Simple timer state
  const [timer, setTimer] = useState<number>(0);
  
  // Prevent notification spam
  const [lastNotificationTime, setLastNotificationTime] = useState<number>(0);
  const [hasNotifiedForThisTurn, setHasNotifiedForThisTurn] = useState<boolean>(false);

  // Fetch user's leagues to get the current draft ID
  const { data: leagueData } = useQuery({
    queryKey: [endpoints.leaguesUser()],
    queryFn: async () => {
      return await apiRequest('GET', endpoints.leaguesUser());
    },
    enabled: !!auth.user && !auth.isLoading,
    staleTime: 1000 * 10, // Cache for 10 seconds
  });

  // Request notification permission on mount
  useEffect(() => {
    requestNotificationPermissionFromUser();
  }, []);

  // Auto-redirect to correct draft if URL has wrong draft ID
  useEffect(() => {
    if (!leagueData || !urlDraftId || auth.isLoading) return;
    
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
  }, [leagueData, urlDraftId, auth.user?.id, navigate, queryClient, auth.isLoading]);

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

  // Helper function to handle draft fetch with retry (handles create→navigate race)
  async function fetchDraftWithRetry(draftId: string, signal: AbortSignal) {
    const delays = [300, 600, 1200, 2000, 3000]; // ~7s total
    for (let i = 0; i <= delays.length; i++) {
      try {
        console.log(`[Draft] Fetch attempt ${i + 1}/${delays.length + 1} for draft:`, draftId);
        
        const res = await fetch(endpoints.draft(draftId), { 
          method: 'GET',
          credentials: 'include',
          signal,
          headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json'
          }
        });
        
        if (res.ok) {
          const raw = await res.json();
          console.log('[Draft] ✅ Draft data received successfully:', raw);
          
          // ✅ Normalize the Draft API response 
          const normalized = normalizeDraft(raw);
          console.log('[Draft] 🔧 Normalized response:', normalized);
          return normalized;
        }

        // If server uses 404 while creating, retry; otherwise break on non-404
        if (res.status !== 404) {
          const text = await res.text().catch(() => '');
          throw new Error(`Draft fetch failed: ${res.status} ${text}`);
        }
        
        console.log(`[Draft] Got 404, attempt ${i + 1}/${delays.length + 1} - draft may still be creating...`);
        if (i === delays.length) break;
        
        console.log(`[Draft] Waiting ${delays[i]}ms before retry...`);
        await new Promise(r => setTimeout(r, delays[i]));
        
      } catch (error: any) {
        // ✅ Don't retry AbortErrors
        if (error?.name === "AbortError" || error?.message?.includes("signal is aborted")) {
          throw error;
        }
        
        // If it's the last attempt or not a 404-related error, throw
        if (i === delays.length || !error?.message?.includes('404')) {
          throw error;
        }
      }
    }
    throw new Error('Draft not ready yet (timed out after ~7s)');
  }

  // Keep your fetchWithRetry as a fallback ONLY if WS never arrives
  useEffect(() => {
    if (!draftId || auth.isLoading || draftData) return; // already loaded via WS
    let cancelled = false;
    (async () => {
      try {
        const controller = new AbortController();
        const data = await fetchDraftWithRetry(draftId, controller.signal);
        if (!cancelled) {
          setDraftData(data);
          setIsLoading(false);
        }
      } catch (e) {
        console.log('[Draft] Fallback fetch failed (WS should handle it):', e);
        // optional: surface toast; but WS should normally handle it
      }
    })();
    return () => { cancelled = true; };
  }, [draftId, auth.isLoading, draftData]);

  // WebSocket connection logic - connect immediately when auth + draftId ready
  // Don't wait for draft data loading - let the socket bring the page to life
  const canConnect = !auth.isLoading && !!auth.user && Boolean(draftId);
  
  const draftWsUrl = useMemo(
    () => (canConnect && draftId ? wsUrl('/draft-ws', { draftId, userId: auth.user!.id }) : null),
    [canConnect, draftId, auth.user?.id]
  );

  console.log('[Draft] WebSocket connection decision:', { 
    authReady: !auth.isLoading && !!auth.user,
    canConnect, 
    draftId: draftId || 'none',
    wsUrl: draftWsUrl || 'none' 
  });
  
  // ✅ Use the socket to hydrate immediately when server pushes state
  const { connectionStatus, lastMessage } = useDraftWebSocket({
    draftId: canConnect ? draftId : undefined,
    userId: auth.user?.id,
    onDraftState: (state) => {
      setDraftData(state);
      setIsLoading(false); // ✅ stop loading as soon as we have authoritative state
    },
    onTimerUpdate: ({ display }) => setDisplaySeconds(display),
  });
  const isConnected = connectionStatus === 'connected';

  // Smart redirect: don't auto-leave /draft/:id while not completed
  useEffect(() => {
    const isDraftRoute = location.startsWith('/draft/');
    if (isDraftRoute) {
      const status = draftData?.status;
      if (!draftData || status === 'completed' || status === 'canceled') {
        navigate('/app', { replace: true });
      }
      return;
    }
  }, [location, draftData?.status, navigate]);

  // Keep the fallback object for compatibility (using draftData state)
  const normalized = useMemo(() => {
    if (!draftData) {
      // Safe fallback structure when no draft data
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
    
    // Use normalized draft state directly
    return draftData;
  }, [draftData, draftId]);
  
  // ✅ Render only from normalized draft state
  const draftStatus = normalized.status;
  const currentPlayerId = normalized.currentPlayerId;
  const timerFromState = normalized.timerSeconds ?? 0;
  
  // JSX-safe aliases for backward compatibility - using normalized (which is now just draft)
  const isCurrentUser = normalized.isCurrentUser;
  const picksSafe = normalized.picks;
  const availableTeamsSafe = normalized.availableTeams;
  const currentRoundSafe = normalized.currentRound;
  const pickTimeLimitSafe = normalized.pickTimeLimit;

  // Log errors for debugging
  if (error) {
    console.error('Draft fetch error:', error);
  }

  // Simple timer based on normalized state
  
  // Handle WebSocket messages - normalize before updating state
  useEffect(() => {
    if (!lastMessage) return;
    
    // ✅ Normalize WebSocket messages that contain draft state updates
    if (lastMessage.type === 'draft_state_update' || lastMessage.type === 'pick_made' || lastMessage.type === 'draft:state' || lastMessage.type === 'draft:update' || lastMessage.type === 'draft:started') {
      const payload = lastMessage.payload ?? lastMessage.data ?? lastMessage;
      if (payload) {
        const normalizedUpdate = normalizeDraft(payload);
        setDraftData(normalizedUpdate);
        console.log('[WS] Normalized draft update from WebSocket:', normalizedUpdate);
      }
    }
  }, [lastMessage]);

  // Timer: start from normalized state; don't read nested state in JSX
  useEffect(() => {
    if (!draftData || draftData.status !== 'active') return;
    let t = draftData.timerSeconds ?? DEFAULT_PICK_TIME_LIMIT;
    setTimer(t);

    const id = setInterval(() => setTimer((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(id);
  }, [draftData?.status, draftData?.timerSeconds]);
  
  // Reset notification flag when it's no longer user's turn
  useEffect(() => {
    if (!normalized.isCurrentUser && hasNotifiedForThisTurn) {
      setHasNotifiedForThisTurn(false);
    }
  }, [normalized.isCurrentUser, hasNotifiedForThisTurn]);

  // Use timer from WebSocket or fallback to local timer
  const displayTime = displaySeconds || timer;
  
  console.log('[TIMER DEBUG] Display Time:', displayTime);
  console.log('[TIMER DEBUG] Current Player:', currentPlayerId);
  console.log('[NORMALIZED FIELDS] Status:', draftStatus, 'CurrentPlayerId:', currentPlayerId, 'TimerSeconds:', displaySeconds);

  // Event handlers using hoisted functions
  function handleTouchStart(e: React.TouchEvent) {
    setTouchStartX(e.touches[0].clientX);
  }

  function handleTouchEnd(e: React.TouchEvent) {
    const touchEndX = e.changedTouches[0].clientX;
    const diff = touchStartX - touchEndX;
    
    if (Math.abs(diff) > MINIMUM_SWIPE_DISTANCE) {
      if (diff > 0 && currentConference === 'AFC') {
        setCurrentConference('NFC');
      } else if (diff < 0 && currentConference === 'NFC') {
        setCurrentConference('AFC');
      }
    }
  }

  function handleMakePick() {
    if (selectedTeam && normalized.isCurrentUser && normalized.canMakePick) {
      makePickMutation.mutate(selectedTeam);
    }
  }

  async function onStartDraft() {
    const leagueId = draftData?.leagueId || normalized?.leagueId;
    if (!leagueId || starting) return; // Idempotent check
    
    setStarting(true);
    try {
      const response = await apiFetch(endpoints.startLeagueDraft(leagueId), {
        method: 'POST'
      });
      
      if (!response.ok) {
        throw new Error(await response.text().catch(() => `Failed (${response.status})`));
      }
      
      const raw = await response.json();
      const next = normalizeDraft(raw);
      setDraftData(next); // immediate UI update (status='active', currentPlayerId set, timer>0)
      
      toast({
        title: "Draft started!",
        description: "The draft has begun. Good luck!",
      });
      
      // Invalidate queries to refresh data
      queryClient.invalidateQueries({ queryKey: ['draft', draftId] });
    } catch (error: any) {
      // ✅ Don't show toast for AbortErrors - happens during normal cancellation
      if (error?.name === "AbortError" || error?.message?.includes("signal is aborted")) {
        return;
      }
      toast({
        title: "Failed to start draft",
        description: error.message || 'Failed to start draft',
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
      return await apiRequest('GET', endpoints.draftAvailableTeams(draftId));
    },
    enabled: !!draftId,
    refetchInterval: 5000,
    staleTime: 0,
    gcTime: 0,
  });

  // Make pick mutation - HARDENED: Single transition with optimized invalidation
  const makePickMutation = useMutation({
    mutationFn: async (nflTeamId: string) => {
      return await apiRequest('POST', `${endpoints.draft(draftId)}/pick`, { nflTeamId });
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
      // ✅ Don't show toast for AbortErrors - happens during normal cancellation
      if (error?.name === "AbortError" || error?.message?.includes("signal is aborted")) {
        return;
      }
      toast({
        title: "Failed to make pick",
        description: error.message,
        variant: "destructive",
      });
    },
    retry: 0 // No retries to prevent duplicate submissions
  });

  console.log('[Draft] All hooks declared, starting conditional logic');

  // Loading states - but don't redirect if we're on a draft route
  if (!draftId) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <h2 className="text-xl font-semibold mb-2">Loading Draft...</h2>
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
        </div>
      </div>
    );
  }

  // Resilient early return - wait for all requirements before rendering main UI
  if (!draftId || auth.isLoading) {
    console.log('[Draft] RENDER: Loading state - early requirements check', { 
      draftId: !!draftId, 
      authLoading: auth.isLoading 
    });
    
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center space-y-4">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <p className="text-sm text-muted-foreground">
            {!draftId ? 'Loading draft...' : 'Authenticating...'}
          </p>
        </div>
      </div>
    );
  }

  const loadingReason = !auth.user ? 'authentication' : 
                       isLoading ? 'draft data loading' :
                       !draftData ? 'no draft data' : 
                       null;

  if (loadingReason) {
    console.log('[Draft] RENDER: Loading state -', loadingReason, '- authLoading:', auth.isLoading, 'isLoading:', isLoading, 'draftData:', !!draftData);
    
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center space-y-4">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <div>
            <p className="text-sm text-muted-foreground capitalize">{loadingReason}...</p>
            {loadingReason === 'draft data loading' && (
              <p className="text-xs text-muted-foreground/70 mt-2">
                Connecting to draft room... (retrying if needed)
              </p>
            )}
          </div>
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
  function renderConferenceTeams(conference: Conference) {
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
                const teamStatus = getTeamStatus(team, normalized.picks, normalized.isCurrentUser, normalized, auth.user?.id || '');
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
                        <TeamLogo teamCode={team.code} size="sm" logoUrl={team.logoUrl} teamName={team.name} />
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
              onClick={() => {
                // Only navigate away if draft is actually finished
                const status = draftData?.status;
                if (status === 'completed' || status === 'canceled') {
                  navigate('/app');
                } else {
                  // Show confirmation before leaving active draft
                  if (confirm('Are you sure you want to leave the draft? You can return to it later.')) {
                    navigate('/app');
                  }
                }
              }}
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