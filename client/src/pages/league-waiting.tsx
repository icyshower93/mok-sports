import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { MainLayout } from "@/components/layout/main-layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Copy, Users, Clock, Share2, RefreshCw, LogOut, Crown, X, Play, Settings } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/features/auth/useAuth";
import { useLocation } from "wouter";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

import { DraftNotificationReminder } from "@/components/draft-notification-reminder";
import DraftControls from "@/components/draft-controls";
import { DraftTestingPanel } from "@/components/draft-testing-panel";
import { useDraftWebSocket } from "@/hooks/use-draft-websocket-fixed";

interface League {
  id: string;
  name: string;
  joinCode: string;
  maxTeams: number;
  memberCount: number;
  isActive: boolean;
  createdAt: string;
  creatorId: string;
  draftScheduledAt?: string;
  draftStarted: boolean;
  draftId?: string;
  draftStatus?: string;
  members: {
    id: string;
    name: string;
    avatar: string | null;
    joinedAt: string;
  }[];
}

export function LeagueWaiting() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [leagueId, setLeagueId] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const [previousMemberCount, setPreviousMemberCount] = useState<number>(0);
  const [notificationSent, setNotificationSent] = useState<boolean>(false);

  // Get league ID from URL params and handle invalid/missing IDs
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const id = params.get('id');
    
    if (id && id !== 'undefined' && id !== 'null') {
      setLeagueId(id);
    } else {
      // If no valid league ID, redirect to dashboard
      console.warn('Invalid or missing league ID, redirecting to dashboard');
      setLocation('/?stay=true');
    }
  }, [setLocation]);

  // Fetch league details
  const { data: league, isLoading, refetch, error } = useQuery<League>({
    queryKey: [`/api/leagues/${leagueId}`],
    enabled: !!leagueId && !!user,
    refetchInterval: 2000, // Refresh every 2 seconds for faster updates
    retry: (failureCount, error) => {
      // Don't retry if user is not authorized (removed from league)
      if (error instanceof Error && error.message.includes('403')) {
        return false;
      }
      return failureCount < 2;
    },
  });

  // WebSocket connection for real-time draft updates
  console.log('[LeagueWaiting] EMERGENCY DEBUG - ABOUT TO CALL useDraftWebSocket with:', { 
    draftId: league?.draftId, 
    leagueId,
    leagueLoaded: !!league,
    hasDraftId: !!league?.draftId,
    timestamp: Date.now()
  });
  const { connectionStatus, isConnected } = useDraftWebSocket(league?.draftId || null, leagueId);
  console.log('[LeagueWaiting] EMERGENCY DEBUG - WebSocket hook returned:', { connectionStatus, isConnected, timestamp: Date.now() });

  // Debug logging for league data
  useEffect(() => {
    if (league) {
      console.log('[LeagueWaiting] League data updated:', {
        id: league.id,
        name: league.name,
        draftId: league.draftId,
        draftStatus: league.draftStatus,
        draftStarted: league.draftStarted
      });
    }
  }, [league]);

  // Force WebSocket reconnection when draft ID changes
  useEffect(() => {
    if (league?.draftId) {
      console.log('[League] Draft ID changed, WebSocket should reconnect to:', league.draftId);
    }
  }, [league?.draftId]);

  // Remove member mutation (creator only)
  const removeMemberMutation = useMutation({
    mutationFn: async (userId: string) => {
      const response = await fetch(`/api/leagues/${leagueId}/remove-member`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ userId }),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to remove member');
      }
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Member Removed",
        description: "Member has been removed from the league",
      });
      refetch(); // Refresh league data
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to remove member",
        variant: "destructive",
      });
    },
  });

  // Send league full notification mutation
  const sendLeagueFullNotification = useMutation({
    mutationFn: async ({ leagueId, leagueName }: { leagueId: string; leagueName: string }) => {
      const response = await fetch('/api/push/league-full', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ leagueId, leagueName }),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to send notifications');
      }
      return response.json();
    },
    onSuccess: (data) => {
      console.log('League full notifications sent:', data);
    },
    onError: (error: any) => {
      console.error('Failed to send league full notifications:', error);
    },
  });

  // Track member count changes for UI updates
  useEffect(() => {
    if (league && league.memberCount !== previousMemberCount) {
      setPreviousMemberCount(league.memberCount);
      // Reset notification flag when member count changes (in case someone leaves)
      if (league.memberCount < league.maxTeams) {
        setNotificationSent(false);
      }
    }
  }, [league, previousMemberCount]);

  // Early return after ALL hooks have been called
  if (!user) {
    return null;
  }

  // Handle missing or invalid league ID
  if (!leagueId) {
    return (
      <MainLayout>
        <div className="min-h-[70vh] flex items-center justify-center">
          <div className="text-center space-y-4">
            <p className="text-muted-foreground">No league selected</p>
            <Button onClick={() => setLocation('/')}>
              Return to Dashboard
            </Button>
          </div>
        </div>
      </MainLayout>
    );
  }

  const copyJoinCode = () => {
    if (league?.joinCode) {
      navigator.clipboard.writeText(league.joinCode);
      toast({
        title: "Copied!",
        description: "League code copied to clipboard",
      });
    }
  };

  const shareLeague = () => {
    if (league?.joinCode) {
      const shareText = `Join my fantasy sports league "${league.name}"! Use code: ${league.joinCode}`;
      if (navigator.share) {
        navigator.share({
          title: 'Join My League',
          text: shareText,
        });
      } else {
        navigator.clipboard.writeText(shareText);
        toast({
          title: "Copied!",
          description: "Share message copied to clipboard",
        });
      }
    }
  };

  if (isLoading) {
    return (
      <MainLayout>
        <div className="min-h-[70vh] flex items-center justify-center">
          <div className="text-center">
            <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-4 text-fantasy-green" />
            <p className="text-muted-foreground">Loading league details...</p>
          </div>
        </div>
      </MainLayout>
    );
  }

  if (!league && !isLoading) {
    // Check if this is an authorization error (user was removed)
    const isAuthError = error && (error as any).message?.includes('403');
    
    return (
      <MainLayout>
        <div className="min-h-[70vh] flex items-center justify-center">
          <div className="text-center space-y-4">
            <p className="text-muted-foreground">
              {isAuthError 
                ? "You don't have access to this league anymore" 
                : "League not found"}
            </p>
            <p className="text-sm text-muted-foreground">
              {isAuthError 
                ? "You may have been removed from this league. Check the dashboard for your current leagues."
                : "This league may no longer exist or the link is invalid."}
            </p>
            <div className="flex gap-2 justify-center">
              <Button onClick={() => {
                // Clear any cached league data and redirect
                queryClient.invalidateQueries({ queryKey: ['/api/leagues/user'] });
                setLocation('/?stay=true');
              }}>
                Return to Dashboard
              </Button>
              {!isAuthError && (
                <Button variant="outline" onClick={() => window.location.reload()}>
                  Retry
                </Button>
              )}
            </div>
          </div>
        </div>
      </MainLayout>
    );
  }

  // Type guard - ensure league exists before proceeding
  if (!league) {
    return null;
  }

  const isLeagueFull = league.memberCount >= league.maxTeams;

  const leaveLeague = async () => {
    try {
      const response = await fetch(`/api/leagues/${leagueId}/leave`, {
        method: 'POST',
        credentials: 'include',
      });
      
      if (!response.ok) {
        throw new Error('Failed to leave league');
      }
      
      toast({
        title: "Left League",
        description: "You have successfully left the league",
      });
      
      // Clear all league-related cache and redirect
      queryClient.invalidateQueries({ queryKey: ['/api/leagues/user'] });
      queryClient.removeQueries({ queryKey: [`/api/leagues/${leagueId}`] });
      setLocation('/?stay=true');
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to leave league",
        variant: "destructive",
      });
    }
  };

  return (
    <MainLayout>
      <div className="min-h-[70vh] flex items-center justify-center px-4">
        <div className="w-full max-w-md">
          <Card className="fantasy-card">
            <CardHeader className="text-center pb-4">
              <CardTitle className="text-2xl font-bold text-fantasy-green">
                {league.name}
              </CardTitle>
              <div className="flex items-center justify-center gap-2 mt-2">
                <Badge variant="secondary" className="bg-fantasy-green/10 text-fantasy-green">
                  <Users className="w-4 h-4 mr-1" />
                  {league.memberCount}/{league.maxTeams} Teams
                </Badge>
                <Badge variant="outline">
                  <Clock className="w-4 h-4 mr-1" />
                  Waiting
                </Badge>
              </div>
            </CardHeader>

            <CardContent className="space-y-6">
              {/* Draft notification reminder for leagues with full capacity */}
              {league.memberCount === league.maxTeams && (
                <DraftNotificationReminder
                  leagueName={league.name}
                />
              )}
              
              {/* Join Code Section */}
              <div className="text-center">
                <h3 className="font-semibold mb-2">League Code</h3>
                <div className="bg-muted rounded-lg p-4 mb-3">
                  <div className="text-3xl font-mono font-bold tracking-wider text-fantasy-green">
                    {league.joinCode}
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button onClick={copyJoinCode} variant="outline" className="flex-1">
                    <Copy className="w-4 h-4 mr-2" />
                    Copy Code
                  </Button>
                  <Button onClick={shareLeague} variant="outline" className="flex-1">
                    <Share2 className="w-4 h-4 mr-2" />
                    Share
                  </Button>
                </div>
              </div>

              {/* Members List */}
              <div>
                <h3 className="font-semibold mb-3">League Members</h3>
                <div className="space-y-2">
                  {league.members.map((member) => (
                    <div key={member.id} className="flex items-center justify-between p-3 bg-muted rounded-lg">
                      <div className="flex items-center gap-3">
                        <Avatar className="w-8 h-8">
                          <AvatarImage src={member.avatar || undefined} />  
                          <AvatarFallback>
                            {member.name.split(' ').map(n => n[0]).join('').toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{member.name}</span>
                          {member.id === league.creatorId && (
                            <div className="flex items-center gap-1">
                              <Crown className="w-4 h-4 text-yellow-500" />
                              <span className="text-xs text-muted-foreground">Creator</span>
                            </div>
                          )}
                        </div>
                      </div>
                      {/* Remove member button (only for creator and not themselves) */}
                      {user?.id === league.creatorId && member.id !== league.creatorId && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 text-muted-foreground hover:text-destructive"
                          onClick={() => removeMemberMutation.mutate(member.id)}
                          disabled={removeMemberMutation.isPending}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* League Full - Ready to Draft */}
              {user?.id === league.creatorId && isLeagueFull && (
                <div className="space-y-3">
                  <div className="text-center p-4 bg-fantasy-green/10 rounded-lg">
                    <div className="flex items-center justify-center gap-2 mb-2">
                      <Users className="w-5 h-5 text-fantasy-green" />
                      <span className="font-semibold text-fantasy-green">League is Full!</span>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      All 6 spots are filled. You can now start the snake draft.
                    </p>
                  </div>
                </div>
              )}

              {/* ALWAYS SHOW DEBUG INFO */}
              {user?.id === league.creatorId && isLeagueFull && (
                <div className="space-y-4">
                  <div className="text-center p-4 bg-blue-500/10 rounded-lg">
                    <div className="flex items-center justify-center gap-2 mb-2">
                      <Settings className="w-5 h-5 text-blue-500" />
                      <span className="font-semibold text-blue-500">DEBUG INFO</span>
                    </div>
                    <p className="text-sm text-muted-foreground mb-2">
                      Draft ID: {league.draftId || 'None'} | Started: {league.draftStarted ? 'Yes' : 'No'}
                    </p>
                    <p className="text-sm text-muted-foreground mb-2">
                      User is Creator: {user?.id === league.creatorId ? 'Yes' : 'No'} | League Full: {isLeagueFull ? 'Yes' : 'No'}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      canCreateDraft: {!league.draftId ? 'Yes' : 'No'} | canStartDraft: {!!league.draftId && !league.draftStarted ? 'Yes' : 'No'}
                    </p>
                  </div>
                  
                  {/* Draft Controls - for creating and starting drafts */}
                  {!league.draftStarted && (
                    <DraftControls
                      leagueId={league.id}
                      canCreateDraft={!league.draftId}
                      canStartDraft={!!league.draftId && !league.draftStarted}
                      draftId={league.draftId}
                      onDraftCreated={(draftId: string) => {
                        useQueryClient().invalidateQueries({ queryKey: [`/api/leagues/${leagueId}`] });
                        toast({
                          title: "Draft created!",
                          description: "Your snake draft is ready to begin.",
                        });
                      }}
                      onDraftStarted={() => {
                        // Use the existing draft ID or the league's draft ID
                        const targetDraftId = league.draftId || '46160cd7-595b-4f70-9956-795ea53993ff';
                        setLocation(`/draft/${targetDraftId}`);
                      }}
                    />
                  )}
                </div>
              )}

              {/* Show draft room button only if draft is active */}
              {league.draftId && league.draftStarted && (
                <div className="text-center p-4 bg-fantasy-purple/10 rounded-lg">
                  <div className="flex items-center justify-center gap-2 mb-3">
                    <Play className="w-5 h-5 text-fantasy-purple" />
                    <span className="font-semibold text-fantasy-purple">Draft is Live!</span>
                  </div>
                  <Button 
                    onClick={() => setLocation(`/draft/${league.draftId}`)}
                    className="w-full"
                    size="lg"
                  >
                    Enter Draft Room
                  </Button>
                </div>
              )}

              {/* Testing Panel */}
              <DraftTestingPanel
                leagueId={league.id}
                draftId={league.draftId}
                isCreator={user?.id === league.creatorId}
                connectionStatus={connectionStatus}
                onReset={() => {
                  // Force immediate refetch after reset to get new draft ID
                  useQueryClient().invalidateQueries({ queryKey: [`/api/leagues/${leagueId}`] });
                  
                  // Force refetch with delay to ensure fresh data
                  setTimeout(() => {
                    queryClient.refetchQueries({ queryKey: [`/api/leagues/${leagueId}`] });
                  }, 300);
                }}
              />

              {/* League Status */}
              <div className="text-center pt-4 border-t">
                {!isLeagueFull && (
                  <p className="text-sm text-muted-foreground mb-4">
                    Waiting for {league.maxTeams - league.memberCount} more {league.maxTeams - league.memberCount === 1 ? 'player' : 'players'}.
                    Share the league code to invite friends!
                  </p>
                )}
                <Button 
                  variant="outline" 
                  onClick={leaveLeague}
                  className="text-destructive hover:text-destructive"
                >
                  <LogOut className="w-4 h-4 mr-2" />
                  Leave League
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </MainLayout>
  );
}