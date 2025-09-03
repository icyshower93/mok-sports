import { useState, useEffect } from 'react';
import { useParams } from 'wouter';
import { useAuth } from '@/features/auth/AuthContext';
import { useLocation } from 'wouter';
import { useToast } from '@/hooks/use-toast';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Clock, CheckCircle, Users } from 'lucide-react';
import { useDraftWebSocket } from '@/hooks/use-draft-websocket';
import { endpoints } from '@/lib/endpoints';
import { apiRequest } from '@/features/query/api';

// Simple interface for draft data
interface SimpleDraftData {
  id: string;
  status: string;
  currentPlayerId: string | null;
  currentRound: number;
  currentPick: number;
  timeRemaining?: number;
  participants: Array<{
    id: string;
    name: string;
    avatar?: string;
  }>;
  picks: Array<{
    id: string;
    round: number;
    pickNumber: number;
    user: { id: string; name: string; avatar?: string };
    nflTeam: { id: string; name: string; city: string; code: string; logoUrl: string };
    isAutoPick: boolean;
  }>;
  availableTeams: Array<{
    id: string;
    name: string;
    city: string;
    code: string;
    logoUrl: string;
    conference: 'AFC' | 'NFC';
  }>;
  canMakePick: boolean;
}

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

// Simple team logo component
function TeamLogo({ logoUrl, teamCode, size = 'md' }: { logoUrl: string; teamCode: string; size?: 'sm' | 'md' }) {
  const sizeClass = size === 'sm' ? 'w-8 h-8' : 'w-12 h-12';
  return (
    <img 
      src={logoUrl} 
      alt={teamCode}
      className={`${sizeClass} object-contain`}
      onError={(e) => {
        const target = e.target as HTMLImageElement;
        target.style.display = 'none';
      }}
    />
  );
}

export default function DraftPage() {
  const { draftId } = useParams();
  const auth = useAuth();
  const { user } = auth;
  const [location, navigate] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Simple state management
  const [draftData, setDraftData] = useState<SimpleDraftData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedTeam, setSelectedTeam] = useState<string | null>(null);
  const [timer, setTimer] = useState<number>(0);

  // Safe fallbacks to prevent crashes during initial render
  const availableTeams = (draftData?.availableTeams ?? []) as any[];
  const picks = (draftData?.picks ?? []) as any[];
  const participants = (draftData?.participants ?? []) as any[];

  // Simple WebSocket connection
  useDraftWebSocket(draftId, user?.id, {
    onDraftState: (state) => {
      console.log('[Draft] WS draft_state received');
      if (state) {
        setDraftData(state);
        setIsLoading(false);
      }
    },
    onTimerUpdate: ({ display }) => setTimer(display),
  });

  // Simple fallback fetch
  useEffect(() => {
    if (!draftId || !user?.id || draftData) return;
    
    fetch(endpoints.draft(draftId))
      .then(res => res.json())
      .then(data => {
        console.log('[Draft] Fetched draft data');
        if (data) {
          setDraftData(data);
          setIsLoading(false);
        }
      })
      .catch(err => console.error('[Draft] Failed to fetch:', err));
  }, [draftId, user?.id, draftData]);

  // Make pick mutation
  const makePick = useMutation({
    mutationFn: async (teamId: string) => {
      return apiRequest('POST', `/api/drafts/${draftId}/pick`, { nflTeamId: teamId });
    },
    onSuccess: () => {
      setSelectedTeam(null);
      toast({
        title: "Pick made!",
        description: "Your team has been drafted successfully."
      });
      queryClient.invalidateQueries({ queryKey: [`/api/drafts/${draftId}`] });
    },
    onError: (error: any) => {
      toast({
        title: "Error making pick",
        description: error?.message || "Failed to draft team",
        variant: "destructive"
      });
    }
  });

  // Loading state - show visible spinner, not null
  if (isLoading || !draftId) {
    return (
      <div className="flex h-full items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <div className="text-sm opacity-70">Starting draft…</div>
        </div>
      </div>
    );
  }

  const isCurrentUser = draftData?.currentPlayerId === user?.id;
  const currentPlayer = participants.find(p => p.id === draftData?.currentPlayerId);

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="max-w-6xl mx-auto">
        {/* Simple Header */}
        <div className="flex items-center justify-between mb-6">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate('/')}
            className="flex items-center gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </Button>
          
          <div className="text-center">
            <h1 className="text-2xl font-bold">Draft Room</h1>
            <p className="text-sm text-muted-foreground">
              Round {draftData?.currentRound ?? 1}, Pick {draftData?.currentPick ?? 1}
            </p>
          </div>

          <div className="flex items-center gap-2 text-sm">
            <Clock className="h-4 w-4" />
            {formatTime(timer)}
          </div>
        </div>

        {/* Current Turn */}
        <Card className="mb-6">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Users className="h-5 w-5" />
                <div>
                  <p className="font-medium">
                    {isCurrentUser ? "Your turn to pick!" : `${currentPlayer?.name || 'Unknown'} is picking...`}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {availableTeams.length} teams remaining
                  </p>
                </div>
              </div>
              {isCurrentUser && (
                <Badge variant="default">Your Turn</Badge>
              )}
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Available Teams - Simple Grid */}
          <Card>
            <CardHeader>
              <CardTitle>Available Teams</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-3 max-h-96 overflow-y-auto">
                {availableTeams.map((team) => {
                  const isSelected = selectedTeam === team.id;
                  const canSelect = draftData?.canMakePick && isCurrentUser;
                  
                  return (
                    <Card
                      key={team.id}
                      className={`cursor-pointer transition-colors ${
                        isSelected ? 'ring-2 ring-primary bg-primary/5' : ''
                      } ${
                        !canSelect ? 'opacity-50 cursor-not-allowed' : 'hover:bg-muted/50'
                      }`}
                      onClick={() => {
                        if (canSelect) {
                          setSelectedTeam(team.id);
                        }
                      }}
                    >
                      <CardContent className="p-3">
                        <div className="flex items-center gap-2">
                          <TeamLogo logoUrl={team.logoUrl} teamCode={team.code} size="sm" />
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-sm truncate">{team.city}</p>
                            <p className="text-xs text-muted-foreground truncate">{team.name}</p>
                          </div>
                          {isSelected && <CheckCircle className="h-4 w-4 text-green-500" />}
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>

              {/* Draft Button */}
              {selectedTeam && draftData?.canMakePick && isCurrentUser && (
                <div className="mt-4 pt-4 border-t">
                  <Button
                    onClick={() => makePick.mutate(selectedTeam)}
                    disabled={makePick.isPending}
                    className="w-full"
                  >
                    {makePick.isPending ? 'Drafting...' : 'Draft Team'}
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Draft Board - Simple List */}
          <Card>
            <CardHeader>
              <CardTitle>Draft Board</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {picks.map((pick) => (
                  <div key={pick.id} className="flex items-center gap-3 p-2 rounded border">
                    <div className="text-sm font-mono w-12">
                      {pick.round}.{pick.pickNumber}
                    </div>
                    <TeamLogo logoUrl={pick.nflTeam.logoUrl} teamCode={pick.nflTeam.code} size="sm" />
                    <div className="flex-1">
                      <p className="font-medium text-sm">{pick.nflTeam.city} {pick.nflTeam.name}</p>
                      <p className="text-xs text-muted-foreground">{pick.user.name}</p>
                    </div>
                    {pick.isAutoPick && (
                      <Badge variant="outline" className="text-xs">Auto</Badge>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}