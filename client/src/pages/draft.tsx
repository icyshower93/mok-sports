import { useState, useEffect, useRef, startTransition, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation, useParams } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Clock, Users, Trophy, Zap, Shield, Star, Wifi, WifiOff, Play, ArrowLeft, CheckCircle, Circle, Search, X, Sparkles, Target, ChevronUp, ChevronDown, RotateCcw, Plus } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { TeamLogo } from "@/components/team-logo";
import { apiRequest } from "@/features/query/api";
import { apiFetch } from "@/lib/api";
import { useDraftWebSocket } from "@/hooks/use-draft-websocket";
import { useAuth } from "@/features/auth/useAuth";
import { endpoints, wsUrl } from "@/lib/endpoints";
import type { DraftState, NflTeam, DraftPick } from '@shared/types/draft';

// Import shared constants from centralized draft-types
import { TIMER_CONSTANTS, DRAFT_UI_CONSTANTS } from '@/draft/draft-types';
import type { TeamStatus, Conference } from '@/draft/draft-types';

// Extract constants to avoid duplication
const { DEFAULT_PICK_TIME_LIMIT } = TIMER_CONSTANTS;
const { MINIMUM_SWIPE_DISTANCE, TIMER_WARNING_THRESHOLDS, NOTIFICATION_COOLDOWN, VIBRATION_PATTERNS } = DRAFT_UI_CONSTANTS;

// Normalize draft payload into consistent shape (simplified)
function normalizeDraft(raw: any) {
  const s = raw?.state ?? raw ?? {};
  return {
    id: raw.id ?? s.id ?? null,
    leagueId: raw.leagueId ?? s.leagueId ?? null,
    status: raw.status ?? s.status ?? s.phase ?? "waiting",
    currentPlayerId: raw.currentPlayerId ?? raw.currentPlayer?.id ?? s.currentPlayerId ?? null,
    participants: raw.participants ?? s.participants ?? [],
    picks: raw.picks ?? s.picks ?? [],
    availableTeams: raw.availableTeams ?? s.availableTeams ?? [],
    currentRound: raw.currentRound ?? s.currentRound ?? 1,
    currentPick: raw.currentPick ?? s.currentPick ?? 1,
    canMakePick: raw.canMakePick ?? s.canMakePick ?? false,
    pickTimeLimit: raw.pickTimeLimit ?? s.pickTimeLimit ?? DEFAULT_PICK_TIME_LIMIT,
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

function getTeamStatus(team: NflTeam, picksSafe: DraftPick[], isCurrentUser: boolean, state: any, userId?: string): TeamStatus {
  const isDrafted = picksSafe.some(p => p.nflTeam.id === team.id);
  if (isDrafted) return 'taken';
  
  // Check division conflict for current user
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

async function requestNotificationPermissionFromUser(): Promise<void> {
  if ('Notification' in window && 'serviceWorker' in navigator) {
    if (Notification.permission === 'default') {
      await Notification.requestPermission();
    }
  }
}

// React component
export default function DraftPage() {
  const { draftId } = useParams();
  const auth = useAuth();
  const { user } = auth;

  // Simple draft state management (normalized)
  const [draftData, setDraftData] = useState<any | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [displaySeconds, setDisplaySeconds] = useState(0);

  const [location, navigate] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [selectedTeam, setSelectedTeam] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState<string>('');
  
  // UI state management
  const [showCelebration, setShowCelebration] = useState(false);
  const [panelsCollapsed, setPanelsCollapsed] = useState(true);
  const [currentConference, setCurrentConference] = useState<Conference>('AFC');
  const [touchStartX, setTouchStartX] = useState<number>(0);
  const [showFAB, setShowFAB] = useState(false);
  const [starting, setStarting] = useState(false);
  
  // Timer state
  const [timer, setTimer] = useState<number>(0);
  
  // Prevent notification spam
  const [lastNotificationTime, setLastNotificationTime] = useState<number>(0);
  const [hasNotifiedForThisTurn, setHasNotifiedForThisTurn] = useState<boolean>(false);

  // Simple WebSocket connection with 3 parameters
  useDraftWebSocket(draftId, user?.id, {
    onDraftState: (state) => {
      console.log('[Draft] WS draft_state => hydrating', state);
      if (state) {
        const normalized = normalizeDraft(state);
        setDraftData(normalized);
        setIsLoading(false);
      }
    },
    onTimerUpdate: ({ display }) => setDisplaySeconds(display),
  });

  // Simple fallback fetch
  useEffect(() => {
    if (!draftId || !user?.id || draftData) return;
    
    fetch(endpoints.draft(draftId))
      .then(res => res.json())
      .then(data => {
        console.log('[Draft] Fetched draft data:', data);
        if (data) {
          const normalized = normalizeDraft(data);
          setDraftData(normalized);
          setIsLoading(false);
        }
      })
      .catch(err => console.error('[Draft] Failed to fetch:', err));
  }, [draftId, user?.id, draftData]);

  // Request notification permission on mount
  useEffect(() => {
    requestNotificationPermissionFromUser();
  }, []);

  // Make draft pick mutation
  const makePick = useMutation({
    mutationFn: async (teamId: string) => {
      return await apiRequest('POST', `/api/drafts/${draftId}/pick`, { nflTeamId: teamId });
    },
    onSuccess: () => {
      setSelectedTeam(null);
      toast({
        title: "Draft pick made!",
        description: "Your team has been selected.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Draft pick failed",
        description: error?.message || "Failed to make draft pick",
        variant: "destructive"
      });
    }
  });

  // Early loading state
  if (isLoading || !draftData) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading draft...</p>
        </div>
      </div>
    );
  }

  // Normalized draft data
  const normalized = draftData;
  const draftStatus = normalized.status;
  const currentPlayerId = normalized.currentPlayerId;
  const isCurrentUser = currentPlayerId === user?.id;
  const picksSafe = normalized.picks || [];
  const availableTeamsSafe = normalized.availableTeams || [];
  const currentRoundSafe = normalized.currentRound || 1;
  const canMakePick = normalized.canMakePick && isCurrentUser;

  // Use timer from WebSocket or fallback to local timer
  const displayTime = displaySeconds || timer;

  // Filter teams by search and conference
  const filteredTeams = useMemo(() => {
    const searchFiltered = filterTeamsBySearch(availableTeamsSafe, searchTerm);
    return searchFiltered.filter(team => team.conference === currentConference);
  }, [availableTeamsSafe, searchTerm, currentConference]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-green-50 dark:from-gray-900 dark:to-gray-800">
      <div className="container mx-auto px-4 py-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate('/')}
            className="flex items-center gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Leagues
          </Button>
          
          <div className="text-center">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              Draft Room
            </h1>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Round {currentRoundSafe}, Pick {normalized.currentPick || 1}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 text-sm text-gray-600 dark:text-gray-400">
              <Clock className="h-4 w-4" />
              {formatTime(displayTime)}
            </div>
          </div>
        </div>

        {/* Current turn indicator */}
        {isCurrentUser && canMakePick && (
          <Card className={`mb-6 ${getBackgroundColor(true, displayTime)}`}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`w-3 h-3 rounded-full ${displayTime <= 10 ? 'bg-red-500 animate-pulse' : 'bg-green-500'}`} />
                  <span className="font-semibold">It's your turn to pick!</span>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-bold">{formatTime(displayTime)}</div>
                  <div className="text-sm text-gray-600">remaining</div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Team Selection */}
          <div className="lg:col-span-2">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>Available Teams</CardTitle>
                  <div className="flex items-center gap-2">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                      <input
                        type="text"
                        placeholder="Search teams..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-10 pr-4 py-2 border rounded-md text-sm"
                      />
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <Tabs value={currentConference} onValueChange={(v) => setCurrentConference(v as Conference)}>
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="AFC">AFC</TabsTrigger>
                    <TabsTrigger value="NFC">NFC</TabsTrigger>
                  </TabsList>
                  
                  <TabsContent value={currentConference} className="mt-4">
                    <ScrollArea className="h-96">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {filteredTeams.map((team) => {
                          const status = getTeamStatus(team, picksSafe, isCurrentUser, normalized, user?.id);
                          const isDisabled = status !== 'available' || !canMakePick;
                          
                          return (
                            <Card
                              key={team.id}
                              className={`cursor-pointer transition-all hover:shadow-md ${
                                selectedTeam === team.id ? 'ring-2 ring-primary' : ''
                              } ${
                                isDisabled ? 'opacity-50 cursor-not-allowed' : ''
                              }`}
                              onClick={() => {
                                if (!isDisabled) {
                                  setSelectedTeam(team.id);
                                }
                              }}
                            >
                              <CardContent className="p-4">
                                <div className="flex items-center gap-3">
                                  <TeamLogo logoUrl={team.logoUrl} teamCode={team.code} teamName={team.name} size="sm" />
                                  <div className="flex-1">
                                    <div className="font-semibold">{team.city} {team.name}</div>
                                    <div className="text-sm text-gray-600">{team.division}</div>
                                  </div>
                                  <div>
                                    {status === 'taken' && (
                                      <Badge variant="secondary">Taken</Badge>
                                    )}
                                    {status === 'conflict' && (
                                      <Badge variant="destructive">Division Conflict</Badge>
                                    )}
                                    {status === 'available' && selectedTeam === team.id && (
                                      <CheckCircle className="h-5 w-5 text-green-500" />
                                    )}
                                  </div>
                                </div>
                              </CardContent>
                            </Card>
                          );
                        })}
                      </div>
                    </ScrollArea>
                  </TabsContent>
                </Tabs>

                {/* Draft button */}
                {selectedTeam && canMakePick && (
                  <div className="mt-4 pt-4 border-t">
                    <Button
                      onClick={() => makePick.mutate(selectedTeam)}
                      disabled={makePick.isPending}
                      className="w-full"
                    >
                      {makePick.isPending ? 'Drafting...' : 'Draft Selected Team'}
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Draft Board */}
          <div>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Trophy className="h-5 w-5" />
                  Draft Board
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-96">
                  <div className="space-y-2">
                    {(normalized.participants || []).map((participant: any, index: number) => {
                      const userPicks = picksSafe.filter((pick: any) => pick.user.id === participant.id);
                      const isCurrentPicker = currentPlayerId === participant.id;
                      
                      return (
                        <div
                          key={participant.id}
                          className={`p-3 rounded-lg border ${
                            isCurrentPicker ? 'bg-primary/10 border-primary' : 'bg-gray-50 dark:bg-gray-800'
                          }`}
                        >
                          <div className="flex items-center justify-between mb-2">
                            <div className="font-semibold flex items-center gap-2">
                              {isCurrentPicker && (
                                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                              )}
                              {participant.name}
                            </div>
                            <Badge variant={isCurrentPicker ? "default" : "secondary"}>
                              {userPicks.length}/5
                            </Badge>
                          </div>
                          
                          <div className="space-y-1">
                            {userPicks.map((pick: any) => (
                              <div key={pick.id} className="flex items-center gap-2 text-sm">
                                <TeamLogo logoUrl={pick.nflTeam.logoUrl} teamCode={pick.nflTeam.code} teamName={pick.nflTeam.name} size="sm" />
                                <span>{pick.nflTeam.city} {pick.nflTeam.name}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}