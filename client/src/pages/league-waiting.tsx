import { useEffect, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { MainLayout } from "@/components/layout/main-layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Copy, Users, Clock, Share2, RefreshCw, LogOut, Crown, X, Calendar, CalendarClock } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { useLocation } from "wouter";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { queryClient } from "@/lib/queryClient";
import { DraftNotificationReminder } from "@/components/draft-notification-reminder";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";

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
  const [scheduleDialogOpen, setScheduleDialogOpen] = useState(false);
  const [draftDateTime, setDraftDateTime] = useState("");

  // Get league ID from URL params
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const id = params.get('id');
    if (id) {
      setLeagueId(id);
    } else {
      // If no league ID, redirect to dashboard
      setLocation('/');
    }
  }, [setLocation]);

  // Fetch league details
  const { data: league, isLoading, refetch } = useQuery<League>({
    queryKey: [`/api/leagues/${leagueId}`],
    enabled: !!leagueId,
    refetchInterval: 5000, // Refresh every 5 seconds to check for new members
  });

  // Track previous member count to detect when league becomes full
  const [previousMemberCount, setPreviousMemberCount] = useState<number>(0);

  if (!user || !leagueId) {
    return null;
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

  if (!league) {
    return (
      <MainLayout>
        <div className="min-h-[70vh] flex items-center justify-center">
          <div className="text-center">
            <p className="text-muted-foreground mb-4">League not found</p>
            <Button onClick={() => setLocation('/')}>
              Back to Dashboard
            </Button>
          </div>
        </div>
      </MainLayout>
    );
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
      
      // Invalidate user leagues query to force dashboard refresh
      queryClient.invalidateQueries({ queryKey: ['/api/leagues/user'] });
      // Redirect to dashboard with stay parameter to prevent auto-redirect
      setLocation('/?stay=true');
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to leave league",
        variant: "destructive",
      });
    }
  };

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

  // Schedule draft mutation
  const scheduleDraftMutation = useMutation({
    mutationFn: async (draftDateTime: string) => {
      const response = await fetch(`/api/leagues/${leagueId}/schedule-draft`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ draftDateTime }),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to schedule draft');
      }
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Draft Scheduled!",
        description: "All league members will be notified about the draft time.",
      });
      setScheduleDialogOpen(false);
      setDraftDateTime("");
      refetch(); // Refresh league data
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to schedule draft",
        variant: "destructive",
      });
    },
  });

  // Auto-send notifications when league becomes full
  useEffect(() => {
    if (league && league.memberCount === league.maxTeams && previousMemberCount < league.maxTeams && user?.id === league.creatorId) {
      // League just became full and current user is creator
      sendLeagueFullNotification.mutate({
        leagueId: league.id,
        leagueName: league.name
      });
    }
    if (league) {
      setPreviousMemberCount(league.memberCount);
    }
  }, [league?.memberCount, league?.maxTeams, league?.id, league?.name, league?.creatorId, user?.id, previousMemberCount, sendLeagueFullNotification]);

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
              {league.memberCount === league.maxTeams && league.draftScheduledAt && (
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
                  <Button
                    variant="outline"
                    onClick={copyJoinCode}
                    className="flex-1"
                  >
                    <Copy className="w-4 h-4 mr-2" />
                    Copy Code
                  </Button>
                  <Button
                    variant="outline"
                    onClick={shareLeague}
                    className="flex-1"
                  >
                    <Share2 className="w-4 h-4 mr-2" />
                    Share
                  </Button>
                </div>
              </div>

              {/* Members Section */}
              <div>
                <h3 className="font-semibold mb-3 text-center">League Members</h3>
                <div className="space-y-2">
                  {league.members?.map((member) => {
                    const isCreator = member.id === league.creatorId;
                    const isCurrentUser = member.id === user?.id;
                    const canRemoveMember = user?.id === league.creatorId && !isCurrentUser;
                    
                    return (
                      <div key={member.id} className="flex items-center gap-3 p-2 rounded-lg bg-muted/50">
                        <Avatar className="w-8 h-8">
                          <AvatarImage src={member.avatar || undefined} alt={member.name} />
                          <AvatarFallback className="text-xs">
                            {member.name.split(' ').map(n => n[0]).join('').toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-medium truncate">{member.name}</p>
                            {isCreator && <Crown className="w-3 h-3 text-fantasy-green" />}
                          </div>
                          <p className="text-xs text-muted-foreground">
                            {isCreator ? 'Created' : 'Joined'} {new Date(member.joinedAt).toLocaleDateString()}
                          </p>
                        </div>
                        {canRemoveMember && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => removeMemberMutation.mutate(member.id)}
                            disabled={removeMemberMutation.isPending}
                            className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
                          >
                            <X className="w-4 h-4" />
                          </Button>
                        )}
                      </div>
                    );
                  }) || []}
                  
                  {/* Empty slots */}
                  {Array.from({ length: league.maxTeams - league.memberCount }).map((_, index) => (
                    <div key={`empty-${index}`} className="flex items-center gap-3 p-2 rounded-lg border-2 border-dashed border-muted">
                      <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
                        <Users className="w-4 h-4 text-muted-foreground" />
                      </div>
                      <div className="flex-1">
                        <p className="text-sm text-muted-foreground">Waiting for player...</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Status Section */}
              <div className="text-center">
                {isLeagueFull ? (
                  <div className="bg-fantasy-green/10 border border-fantasy-green rounded-lg p-4">
                    <h3 className="font-semibold text-fantasy-green mb-2">
                      League is Full! 🏆
                    </h3>
                    
                    {league.draftScheduledAt ? (
                      <div className="space-y-3">
                        <p className="text-sm text-muted-foreground">
                          Draft scheduled for:
                        </p>
                        <div className="bg-muted rounded-lg p-3">
                          <div className="flex items-center justify-center gap-2 text-fantasy-green font-semibold">
                            <CalendarClock className="w-4 h-4" />
                            {new Date(league.draftScheduledAt).toLocaleDateString()} at{" "}
                            {new Date(league.draftScheduledAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </div>
                        </div>
                        <Button className="w-full" onClick={() => setLocation('/draft')}>
                          Enter Draft Room
                        </Button>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        <p className="text-sm text-muted-foreground mb-4">
                          All {league.maxTeams} teams have joined. Time to schedule your draft!
                        </p>
                        
                        {user?.id === league.creatorId ? (
                          <Dialog open={scheduleDialogOpen} onOpenChange={setScheduleDialogOpen}>
                            <DialogTrigger asChild>
                              <Button className="w-full">
                                <Calendar className="w-4 h-4 mr-2" />
                                Schedule Draft
                              </Button>
                            </DialogTrigger>
                            <DialogContent>
                              <DialogHeader>
                                <DialogTitle>Schedule Draft</DialogTitle>
                              </DialogHeader>
                              <div className="space-y-4">
                                <div>
                                  <Label htmlFor="draft-datetime">Draft Date & Time</Label>
                                  <Input
                                    id="draft-datetime"
                                    type="datetime-local"
                                    value={draftDateTime}
                                    onChange={(e) => setDraftDateTime(e.target.value)}
                                    min={new Date().toISOString().slice(0, 16)}
                                  />
                                </div>
                                <div className="flex gap-2">
                                  <Button
                                    variant="outline"
                                    onClick={() => setScheduleDialogOpen(false)}
                                    className="flex-1"
                                  >
                                    Cancel
                                  </Button>
                                  <Button
                                    onClick={() => scheduleDraftMutation.mutate(draftDateTime)}
                                    disabled={!draftDateTime || scheduleDraftMutation.isPending}
                                    className="flex-1"
                                  >
                                    {scheduleDraftMutation.isPending ? "Scheduling..." : "Schedule"}
                                  </Button>
                                </div>
                              </div>
                            </DialogContent>
                          </Dialog>
                        ) : (
                          <p className="text-sm text-muted-foreground">
                            Waiting for league creator to schedule the draft...
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="bg-muted/50 rounded-lg p-4">
                    <h3 className="font-semibold mb-2">Waiting for Players</h3>
                    <p className="text-sm text-muted-foreground mb-3">
                      Share the league code with friends to fill the remaining{" "}
                      {league.maxTeams - league.memberCount} spots.
                    </p>
                    <p className="text-xs text-muted-foreground">
                      This page will automatically refresh when new players join.
                    </p>
                  </div>
                )}
              </div>

              {/* Leave League */}
              <div className="text-center">
                <Button
                  variant="ghost"
                  onClick={leaveLeague}
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