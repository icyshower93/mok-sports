import { useState, useEffect } from "react";
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

export default function DraftPageSafe() {
  // CRITICAL: ALL state declarations first to prevent temporal dead zone
  const [location, navigate] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user, isLoading: authLoading, isAuthenticated } = useAuth();
  
  const [selectedTeam, setSelectedTeam] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [showCelebration, setShowCelebration] = useState(false);
  const [panelsCollapsed, setPanelsCollapsed] = useState(true);
  const [currentConference, setCurrentConference] = useState<'AFC' | 'NFC'>('AFC');
  const [touchStartX, setTouchStartX] = useState<number>(0);
  const [showFAB, setShowFAB] = useState(false);
  const [serverTime, setServerTime] = useState<number>(0);
  const [localTime, setLocalTime] = useState<number>(0);
  const [lastServerUpdate, setLastServerUpdate] = useState<number>(0);
  const [isCountingDown, setIsCountingDown] = useState<boolean>(false);
  const [lastNotificationTime, setLastNotificationTime] = useState<number>(0);
  const [hasNotifiedForThisTurn, setHasNotifiedForThisTurn] = useState<boolean>(false);

  // Extract draft ID safely
  const params = useParams();
  const draftId = (params as any)?.draftId || null;

  // Safe early return for auth
  if (authLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <p className="text-muted-foreground">Loading authentication...</p>
        </div>
      </div>
    );
  }

  if (!user || !isAuthenticated) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-4">
          <p className="text-lg">Please log in to access the draft</p>
          <Button onClick={() => navigate('/')}>Go Home</Button>
        </div>
      </div>
    );
  }

  if (!draftId) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-4">
          <p className="text-lg">Invalid draft URL</p>
          <Button onClick={() => navigate('/')}>Go Home</Button>
        </div>
      </div>
    );
  }

  return (
    <DraftComponent
      draftId={draftId}
      user={user}
      selectedTeam={selectedTeam}
      setSelectedTeam={setSelectedTeam}
      searchTerm={searchTerm}
      setSearchTerm={setSearchTerm}
      showCelebration={showCelebration}
      setShowCelebration={setShowCelebration}
      panelsCollapsed={panelsCollapsed}
      setPanelsCollapsed={setPanelsCollapsed}
      currentConference={currentConference}
      setCurrentConference={setCurrentConference}
      touchStartX={touchStartX}
      setTouchStartX={setTouchStartX}
      showFAB={showFAB}
      setShowFAB={setShowFAB}
      serverTime={serverTime}
      setServerTime={setServerTime}
      localTime={localTime}
      setLocalTime={setLocalTime}
      lastServerUpdate={lastServerUpdate}
      setLastServerUpdate={setLastServerUpdate}
      isCountingDown={isCountingDown}
      setIsCountingDown={setIsCountingDown}
      lastNotificationTime={lastNotificationTime}
      setLastNotificationTime={setLastNotificationTime}
      hasNotifiedForThisTurn={hasNotifiedForThisTurn}
      setHasNotifiedForThisTurn={setHasNotifiedForThisTurn}
      navigate={navigate}
      toast={toast}
      queryClient={queryClient}
    />
  );
}

function DraftComponent({
  draftId,
  user,
  selectedTeam,
  setSelectedTeam,
  searchTerm,
  setSearchTerm,
  showCelebration,
  setShowCelebration,
  panelsCollapsed,
  setPanelsCollapsed,
  currentConference,
  setCurrentConference,
  touchStartX,
  setTouchStartX,
  showFAB,
  setShowFAB,
  serverTime,
  setServerTime,
  localTime,
  setLocalTime,
  lastServerUpdate,
  setLastServerUpdate,
  isCountingDown,
  setIsCountingDown,
  lastNotificationTime,
  setLastNotificationTime,
  hasNotifiedForThisTurn,
  setHasNotifiedForThisTurn,
  navigate,
  toast,
  queryClient,
}: any) {
  // Mobile UX utilities
  const vibrate = (pattern: number | number[]) => {
    try {
      if ('vibrate' in navigator && navigator.vibrate) {
        return navigator.vibrate(pattern);
      }
      return false;
    } catch (error) {
      console.error('[VIBRATION] Error:', error);
      return false;
    }
  };

  // WebSocket connection
  const { lastMessage, isConnected } = useDraftWebSocket(draftId);

  // Draft data query - simplified and safe
  const { data: draftData, error, isLoading, isError } = useQuery({
    queryKey: [`/api/draft/${draftId}/state`],
    queryFn: async () => {
      try {
        const response = await apiRequest('GET', `/api/draft/${draftId}/state`);
        if (!response.ok) {
          throw new Error(`Failed to fetch draft data: ${response.status}`);
        }
        return response.json();
      } catch (error) {
        console.error('[Draft] Data fetch error:', error);
        throw error;
      }
    },
    enabled: !!draftId,
    refetchInterval: 5000,
    staleTime: 0,
    gcTime: 0,
    retry: 3
  });

  // Safe data access
  const hasValidData = draftData && draftData.state;
  
  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <p className="text-muted-foreground">Loading draft...</p>
        </div>
      </div>
    );
  }

  if (isError || !hasValidData) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-4">
          <h2 className="text-xl font-semibold">Something went wrong</h2>
          <p className="text-muted-foreground">
            Unable to load draft data. Please try refreshing the page.
          </p>
          <div className="space-x-2">
            <Button onClick={() => window.location.reload()}>Refresh</Button>
            <Button variant="outline" onClick={() => navigate('/')}>
              Go Home
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Safe data extraction
  const state = draftData.state;
  const isCurrentUser = draftData.isCurrentUser;
  const currentPlayer = draftData.currentPlayer;

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-6">
        <div className="max-w-7xl mx-auto">
          
          {/* Header */}
          <div className="mb-8">
            <div className="text-center mb-4">
              <h1 className="text-2xl font-semibold text-foreground mb-1">Draft Room</h1>
              <div className="flex items-center justify-center space-x-6 text-sm text-muted-foreground">
                <div className="flex items-center space-x-1">
                  <span>Round {state?.draft?.currentRound || 1} of {state?.draft?.totalRounds || 5}</span>
                </div>
                <div className="h-1 w-1 bg-muted-foreground rounded-full" />
                <div className="flex items-center space-x-1">
                  <span>Pick {state?.draft?.currentPick || 1}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Draft Status */}
          {state?.draft?.status === 'completed' ? (
            <div className="text-center space-y-4">
              <Card className="w-full">
                <CardContent className="p-4">
                  <div className="text-center space-y-4">
                    <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
                      <div className="text-green-700 dark:text-green-300 font-bold text-lg mb-1">
                        🎉 Draft Complete!
                      </div>
                      <div className="text-sm text-green-600 dark:text-green-400">
                        All {state?.picks?.length || 0} picks completed
                      </div>
                    </div>
                    
                    <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
                      <Button 
                        onClick={() => navigate(`/league/${draftData?.draft?.leagueId}/waiting`)}
                        variant="outline"
                        className="flex-1 sm:flex-none"
                        size="lg"
                      >
                        <ArrowLeft className="w-4 h-4 mr-2" />
                        Back to League
                      </Button>
                      <Button 
                        onClick={() => navigate('/')}
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
            </div>
          ) : (
            <div className="text-center space-y-4">
              <Card>
                <CardContent className="p-6">
                  <div className="text-center space-y-4">
                    {state?.draft?.status === 'not_started' ? (
                      <div>
                        <h3 className="text-lg font-semibold mb-2">Waiting for Draft to Start</h3>
                        <p className="text-muted-foreground">The league creator will start the draft when ready</p>
                      </div>
                    ) : state?.draft?.status === 'active' && currentPlayer ? (
                      <div>
                        <h3 className="text-lg font-semibold mb-2">
                          {isCurrentUser ? "Your Turn!" : `${currentPlayer.name}'s Turn`}
                        </h3>
                        <p className="text-muted-foreground">
                          {isCurrentUser ? "Choose your team" : "Waiting for pick..."}
                        </p>
                      </div>
                    ) : (
                      <div>
                        <h3 className="text-lg font-semibold mb-2">Draft Active</h3>
                        <p className="text-muted-foreground">Loading current turn...</p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}