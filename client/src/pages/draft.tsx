import { useState, useEffect } from 'react';
import { useParams } from 'wouter';
import { useAuth } from '@/features/auth/AuthContext';
import { useLocation } from 'wouter';
import { useToast } from '@/hooks/use-toast';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { ArrowLeft, Clock, CheckCircle, Users, Timer } from 'lucide-react';
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
  const { draftId } = useParams<{ draftId: string }>();
  const { user, isLoading: authLoading } = useAuth();
  const [location, navigate] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Simple state management
  const [draft, setDraft] = useState<any | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedTeam, setSelectedTeam] = useState<string | null>(null);
  const [display, setDisplay] = useState(0);

  // ---- SAFE DERIVEDS (crash-resistant)
  const teams = draft?.teams ?? [];
  const picks = draft?.picks ?? [];
  const participants = draft?.participants ?? [];
  const restrictions = draft?.restrictions ?? {};
  const status = draft?.status ?? 'starting';
  const timerLimit = draft?.timer?.limit ?? 120;
  const timerDisplay = draft?.timer?.display ?? display;

  // UI state computed from draft data
  const isCountdown = status === 'starting';
  const isDraftActive = status === 'in_progress';
  const canMakePicks = isDraftActive && draft?.canMakePick;
  const timerProgress = timerLimit > 0 ? ((timerLimit - timerDisplay) / timerLimit) * 100 : 0;

  // Draft restrictions and eligibility
  const userPicks = picks.filter((pick: any) => pick.userId === user?.id) || [];
  const enableDivisionRule = restrictions.enableDivisionRule ?? true;
  const maxTeamsPerDivision = restrictions.maxTeamsPerDivision ?? 1;

  // Check team eligibility based on division rules
  const checkTeamEligibility = (team: any) => {
    if (!enableDivisionRule) return { eligible: true, reason: '' };
    
    const teamDivision = `${team.conference} ${team.division}`;
    const divisionCount = userPicks.filter((pick: any) => 
      `${pick.nflTeam?.conference} ${pick.nflTeam?.division}` === teamDivision
    ).length;
    
    if (divisionCount >= maxTeamsPerDivision) {
      const hasOtherOptions = teams.some((t: any) => 
        `${t.conference} ${t.division}` !== teamDivision
      );
      
      return {
        eligible: !hasOtherOptions, // Only eligible if no other division options
        reason: hasOtherOptions 
          ? `Already have team from ${teamDivision}` 
          : 'Override: no other divisions available'
      };
    }
    
    return { eligible: true, reason: '' };
  };

  useDraftWebSocket(draftId, user?.id, {
    onDraftState: (state) => {
      if (!state) return;         // tolerate noise
      setDraft(state);
      setIsLoading(false);
    },
    onTimerUpdate: (t) => setDisplay(t.display ?? 0),
  });

  useEffect(() => {
    if (!draftId || authLoading || draft) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(endpoints.draft(draftId));
        if (res.ok) {
          const data = await res.json();
          if (!cancelled) { setDraft(data); setIsLoading(false); }
        }
      } catch {}
    })();
    return () => { cancelled = true; };
  }, [draftId, authLoading, draft]);

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

  // Loading state - show visible spinner
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

  const isCurrentUser = draft?.currentPlayerId === user?.id;
  const currentPlayer = participants.find((p: any) => p.id === draft?.currentPlayerId);

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
              Round {draft?.currentRound ?? 1}, Pick {draft?.currentPick ?? 1}
            </p>
          </div>

          <div className="flex items-center gap-2 text-sm">
            {isCountdown ? (
              <div className="flex items-center gap-2 text-orange-500">
                <Timer className="h-4 w-4" />
                <span className="font-bold">Starting in {Math.max(0, Math.ceil(timerDisplay))}s</span>
              </div>
            ) : (
              <>
                <Clock className="h-4 w-4" />
                {formatTime(Math.max(0, timerDisplay))}
              </>
            )}
          </div>
        </div>

        {/* Current Turn */}
        <Card className="mb-6">
          <CardContent className="p-4">
            {isCountdown ? (
              <div className="text-center space-y-3">
                <div className="flex items-center justify-center gap-2 text-orange-500">
                  <Timer className="h-5 w-5" />
                  <p className="font-bold text-lg">Draft starting in {Math.max(0, Math.ceil(timerDisplay))} seconds...</p>
                </div>
                <p className="text-sm text-muted-foreground">Get ready to pick your teams!</p>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <Users className="h-5 w-5" />
                    <div>
                      <p className="font-medium">
                        {isCurrentUser ? "Your turn to pick!" : `${currentPlayer?.name || 'Unknown'} is picking...`}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {teams.length} teams remaining
                      </p>
                    </div>
                  </div>
                  {isCurrentUser && isDraftActive && (
                    <Badge variant="default">Your Turn</Badge>
                  )}
                </div>
                {isDraftActive && timerDisplay > 0 && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>Time remaining</span>
                      <span>{formatTime(Math.max(0, timerDisplay))}</span>
                    </div>
                    <Progress value={timerProgress} className="h-2" />
                  </div>
                )}
              </>
            )}
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
                {teams.map((team: any) => {
                  const isSelected = selectedTeam === team.id;
                  const eligibility = checkTeamEligibility(team);
                  const canSelect = canMakePicks && isCurrentUser && eligibility.eligible;
                  
                  return (
                    <Card
                      key={team.id}
                      className={`cursor-pointer transition-colors ${
                        isSelected ? 'ring-2 ring-primary bg-primary/5' : ''
                      } ${
                        !canSelect ? 'opacity-50 cursor-not-allowed' : 'hover:bg-muted/50'
                      } ${
                        !eligibility.eligible ? 'border-orange-200 bg-orange-50 dark:border-orange-800 dark:bg-orange-900/20' : ''
                      }`}
                      onClick={() => {
                        if (canSelect) {
                          setSelectedTeam(team.id);
                        }
                      }}
                      title={!eligibility.eligible ? eligibility.reason : ''}
                    >
                      <CardContent className="p-3">
                        <div className="flex items-center gap-2">
                          <TeamLogo logoUrl={team.logoUrl} teamCode={team.code} size="sm" />
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-sm truncate">{team.city}</p>
                            <p className="text-xs text-muted-foreground truncate">{team.name}</p>
                            {!eligibility.eligible && (
                              <p className="text-xs text-orange-600 dark:text-orange-400 truncate">{eligibility.reason}</p>
                            )}
                          </div>
                          {isSelected && <CheckCircle className="h-4 w-4 text-green-500" />}
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>

              {/* Draft Button */}
              {selectedTeam && canMakePicks && isCurrentUser && (() => {
                const selectedTeamData = teams.find((t: any) => t.id === selectedTeam);
                const eligibility = selectedTeamData ? checkTeamEligibility(selectedTeamData) : { eligible: false, reason: 'Team not found' };
                
                return (
                  <div className="mt-4 pt-4 border-t">
                    <Button
                      onClick={() => makePick.mutate(selectedTeam)}
                      disabled={makePick.isPending || !canMakePicks || !eligibility.eligible}
                      className="w-full"
                    >
                      {makePick.isPending ? 'Drafting...' : 
                       !eligibility.eligible ? `Can't Draft: ${eligibility.reason}` :
                       'Draft Team'}
                    </Button>
                    {!eligibility.eligible && (
                      <p className="text-xs text-orange-600 dark:text-orange-400 mt-2 text-center">
                        {eligibility.reason}
                      </p>
                    )}
                  </div>
                );
              })()}
            </CardContent>
          </Card>

          {/* Draft Board - Simple List */}
          <Card>
            <CardHeader>
              <CardTitle>Draft Board</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {picks.map((pick: any) => (
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