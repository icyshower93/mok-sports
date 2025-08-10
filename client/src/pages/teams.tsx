import React, { useState } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { BottomNav } from "@/components/layout/bottom-nav";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { TeamLogo } from "@/components/team-logo";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { 
  Shield, 
  Lock, 
  Zap,
  AlertTriangle,
  CheckCircle
} from "lucide-react";

export default function StablePage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const [selectedWeek] = useState(1);
  
  // Dialog states
  const [lockDialogOpen, setLockDialogOpen] = useState(false);
  const [lockAndLoadDialogOpen, setLockAndLoadDialogOpen] = useState(false);
  const [selectedTeam, setSelectedTeam] = useState<any>(null);
  
  // Track which teams have been locked/locked-and-loaded this week
  const [weeklyLocks, setWeeklyLocks] = useState<Set<string>>(new Set());

  // Fetch user's leagues and teams (same as main page)
  const { data: leagues = [], isLoading: leaguesLoading } = useQuery({
    queryKey: ['/api/user/leagues'],
    enabled: !!user,
  });

  const selectedLeague = (leagues as any[])[0]?.id || "";

  const { data: userTeams = [], isLoading: teamsLoading } = useQuery({
    queryKey: [`/api/user/stable/${selectedLeague}`],
    enabled: !!user && !!selectedLeague,
  });

  // Mutations for locking teams
  // Development reset mutation
  const resetLocksMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest('DELETE', `/api/user/locks/reset`, {
        leagueId: selectedLeague,
        week: selectedWeek
      });
      const data = await response.json();
      return data;
    },
    onSuccess: () => {
      // Clear local state
      setWeeklyLocks(new Set());
      
      // Show success toast
      toast({
        title: "Locks Reset!",
        description: `All locks cleared for Week ${selectedWeek}. Ready for testing!`,
      });

      // Refresh team data
      queryClient.invalidateQueries({ queryKey: [`/api/user/stable/${selectedLeague}`] });
    },
    onError: (error: any) => {
      console.error('[Reset] Failed to reset locks:', error);
      toast({
        title: "Reset Failed",
        description: error.message || "Unable to reset locks. Please try again.",
        variant: "destructive"
      });
    },
  });

  const lockTeamMutation = useMutation({
    mutationFn: async ({ teamId, lockType }: { teamId: string; lockType: 'lock' | 'lockAndLoad' }) => {
      console.log('[API] Making lock request with:', {
        url: `/api/teams/${teamId}/lock`,
        body: { 
          week: selectedWeek,
          lockType,
          leagueId: selectedLeague 
        }
      });
      
      try {
        const response = await apiRequest('POST', `/api/teams/${teamId}/lock`, { 
          week: selectedWeek,
          lockType,
          leagueId: selectedLeague 
        });
        console.log('[API] Lock response raw:', response);
        const data = await response.json();
        console.log('[API] Lock response data:', data);
        return data;
      } catch (error) {
        console.error('[API] Lock request failed:', error);
        throw error;
      }
    },
    onSuccess: (data, variables) => {
      const { teamId, lockType } = variables;
      console.log('[Success] Lock successful:', data, variables);
      
      try {
        // Update local state
        setWeeklyLocks(prev => new Set([...Array.from(prev), teamId]));
        
        // Get team name safely
        const teamName = selectedTeam?.nflTeam?.name || 'Team';
        
        // Show success toast
        toast({
          title: lockType === 'lock' ? "Team Locked!" : "Lock & Load Activated!",
          description: lockType === 'lock' 
            ? `${teamName} is now locked for Week ${selectedWeek}`
            : `${teamName} is locked with 2x risk/reward for Week ${selectedWeek}`,
        });

        // Refresh team data to get updated lock states
        queryClient.invalidateQueries({ queryKey: [`/api/user/stable/${selectedLeague}`] });
        
        // Close dialogs
        setLockDialogOpen(false);
        setLockAndLoadDialogOpen(false);
        setSelectedTeam(null);
      } catch (error) {
        console.error('[Success Handler] Error in success callback:', error);
      }
    },
    onError: (error: any) => {
      console.error('[Mutation Error] Lock failed:', error);
      toast({
        title: "Lock Failed",
        description: error.message || "Unable to lock team. Please try again.",
        variant: "destructive"
      });
      
      // Close dialogs on error too
      setLockDialogOpen(false);
      setLockAndLoadDialogOpen(false);
      setSelectedTeam(null);
    },
  });

  // Lock deadline (Thursday 8:20 PM ET for current week)
  const lockDeadline = new Date();
  lockDeadline.setDate(lockDeadline.getDate() + (4 - lockDeadline.getDay() + 7) % 7); // Next Thursday
  lockDeadline.setHours(20, 20, 0, 0); // 8:20 PM

  // Dialog handlers
  const handleLockClick = (team: any) => {
    console.log('[Dialog] Opening lock dialog for team:', team?.nflTeam?.name);
    setSelectedTeam(team);
    setLockDialogOpen(true);
  };

  const handleLockAndLoadClick = (team: any) => {
    console.log('[Dialog] Opening Lock & Load dialog for team:', team?.nflTeam?.name);
    setSelectedTeam(team);
    setLockAndLoadDialogOpen(true);
  };

  const confirmLock = () => {
    try {
      console.log('[Dialog] Confirming lock for team:', selectedTeam?.nflTeam?.name);
      console.log('[Dialog] selectedTeam full object:', JSON.stringify(selectedTeam, null, 2));
      console.log('[Dialog] selectedLeague:', selectedLeague);
      console.log('[Dialog] selectedWeek:', selectedWeek);
      
      if (selectedTeam) {
        const teamId = selectedTeam.nflTeamId || selectedTeam.nflTeam?.id || selectedTeam.id;
        console.log('[Dialog] Using teamId:', teamId);
        
        lockTeamMutation.mutate({
          teamId: teamId,
          lockType: 'lock'
        });
      }
    } catch (error) {
      console.error('[Dialog] Error in confirmLock:', error);
      toast({
        title: "Lock Failed",
        description: "An unexpected error occurred. Please try again.",
        variant: "destructive"
      });
    }
  };

  const confirmLockAndLoad = () => {
    try {
      console.log('[Dialog] Confirming Lock & Load for team:', selectedTeam?.nflTeam?.name);
      console.log('[Dialog] selectedTeam full object:', JSON.stringify(selectedTeam, null, 2));
      
      if (selectedTeam) {
        const teamId = selectedTeam.nflTeamId || selectedTeam.nflTeam?.id || selectedTeam.id;
        console.log('[Dialog] Using teamId:', teamId);
        
        lockTeamMutation.mutate({
          teamId: teamId,
          lockType: 'lockAndLoad'
        });
      }
    } catch (error) {
      console.error('[Dialog] Error in confirmLockAndLoad:', error);
      toast({
        title: "Lock & Load Failed",
        description: "An unexpected error occurred. Please try again.",
        variant: "destructive"
      });
    }
  };

  const handleLockDialogChange = (open: boolean) => {
    console.log('[Dialog] Lock dialog state change:', open);
    setLockDialogOpen(open);
    if (!open) {
      setSelectedTeam(null);
    }
  };

  const handleLockAndLoadDialogChange = (open: boolean) => {
    console.log('[Dialog] Lock & Load dialog state change:', open);
    setLockAndLoadDialogOpen(open);
    if (!open) {
      setSelectedTeam(null);
    }
  };

  // Check if any team is already locked this week
  const hasWeeklyLock = weeklyLocks.size > 0 || (userTeams as any[]).some((team: any) => team.isLocked);

  if (leaguesLoading || teamsLoading) {
    return (
      <div className="min-h-screen bg-background pb-20">
        <div className="max-w-4xl mx-auto px-4 py-6">
          <div className="flex items-center space-x-2 mb-6">
            <Shield className="w-6 h-6 text-primary" />
            <h1 className="text-2xl font-bold">My Stable</h1>
          </div>
          <div className="animate-pulse space-y-4">
            <div className="h-32 bg-muted rounded-lg"></div>
            <div className="h-32 bg-muted rounded-lg"></div>
            <div className="h-32 bg-muted rounded-lg"></div>
          </div>
        </div>
        <BottomNav />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-20">
      <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Shield className="w-6 h-6 text-primary" />
            <h1 className="text-2xl font-bold">My Stable</h1>
          </div>
          
          {/* Development Reset Button */}
          {import.meta.env.DEV && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => resetLocksMutation.mutate()}
              disabled={resetLocksMutation.isPending}
              className="text-xs"
            >
              {resetLocksMutation.isPending ? (
                <>
                  <div className="w-3 h-3 mr-2 animate-spin rounded-full border border-gray-600 border-t-transparent" />
                  Resetting...
                </>
              ) : (
                <>
                  Reset Locks
                </>
              )}
            </Button>
          )}
        </div>

        {/* Lock Selection Interface */}
        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-4">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <CardTitle className="text-lg mb-1">Choose Your Lock</CardTitle>
                  <div className="text-sm text-muted-foreground">
                    Deadline: {lockDeadline.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })} 8:20 PM ET
                  </div>
                </div>
                <Badge variant="secondary" className="text-xs px-2 py-1 mt-1">
                  Week {selectedWeek}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4 p-4">
              {(userTeams as any[]).length === 0 ? (
                <div className="text-center py-8">
                  <div className="w-12 h-12 mx-auto mb-3 bg-muted rounded-full flex items-center justify-center">
                    <Shield className="w-6 h-6 text-muted-foreground" />
                  </div>
                  <h3 className="text-base font-semibold mb-2">No Teams Yet</h3>
                  <p className="text-sm text-muted-foreground mb-4 max-w-sm mx-auto">
                    Complete a draft to start building your stable
                  </p>
                  <Button onClick={() => navigate('/leagues')} size="sm">
                    Join a League
                  </Button>
                </div>
              ) : (
                <>
                  {/* Lockable Teams - Compact Mobile Design */}
                  {(userTeams as any[]).filter(team => team.locksRemaining > 0 && !team.isBye).map((team: any) => {
                    const isTeamLocked = weeklyLocks.has(team.id) || team.isLocked || team.isLockAndLoad;
                    const isDisabled = hasWeeklyLock && !isTeamLocked;
                    
                    return (
                    <div 
                      key={team.id}
                      className={`rounded-lg border bg-card hover:shadow-sm transition-all duration-200 overflow-hidden ${
                        isDisabled ? 'opacity-50 pointer-events-none' : ''
                      } ${isTeamLocked ? 'ring-2 ring-green-500 bg-green-50 dark:bg-green-950/20' : ''}`}
                    >
                      <div className="p-4">
                        {/* Team Header - Balanced sizing */}
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center space-x-4 flex-1 min-w-0">
                            <TeamLogo 
                              logoUrl={team.nflTeam.logoUrl}
                              teamCode={team.nflTeam.code}
                              teamName={team.nflTeam.name}
                              size="lg"
                              className="w-12 h-12 flex-shrink-0"
                            />
                            <div className="flex-1 min-w-0">
                              <div className="font-medium text-sm truncate">
                                {team.nflTeam.city} {team.nflTeam.name}
                              </div>
                              <div className="flex items-center space-x-2 text-xs">
                                <span className="text-muted-foreground">
                                  {(() => {
                                    // Extract the opponent and point spread from upcomingOpponent
                                    const match = team.upcomingOpponent?.match(/^(.*?)\s([+-]\d+(?:\.\d+)?)$/) || [];
                                    const opponent = match[1] || team.upcomingOpponent;
                                    const spread = match[2];
                                    
                                    return (
                                      <>
                                        <span>{opponent}</span>
                                        {spread && (
                                          <span className="text-white text-sm font-semibold ml-2 font-mono tracking-wider">
                                            {spread}
                                          </span>
                                        )}
                                      </>
                                    );
                                  })()}
                                </span>
                              </div>
                            </div>
                          </div>
                          
                          <div className="flex items-center space-x-2 flex-shrink-0">
                            <div className="text-xs text-muted-foreground">
                              {team.locksRemaining} left
                            </div>
                            <div className="relative">
                              <div className="w-5 h-5 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
                                <Zap className="w-2.5 h-2.5 text-amber-600 dark:text-amber-400" />
                              </div>
                              {!team.lockAndLoadAvailable && (
                                <div className="absolute inset-0 flex items-center justify-center">
                                  <div className="w-6 h-0.5 bg-red-500 transform rotate-45"></div>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                        
                        {/* Action Buttons - Better touch targets */}
                        <div className="flex space-x-3">
                          <Button 
                            size="sm"
                            className={`flex-1 h-9 text-sm ${isTeamLocked ? 'bg-green-600 hover:bg-green-700' : ''}`}
                            disabled={isTeamLocked || lockTeamMutation.isPending}
                            onClick={() => !isTeamLocked && handleLockClick(team)}
                          >
                            {lockTeamMutation.isPending && selectedTeam?.id === team.id ? (
                              <>
                                <div className="w-3 h-3 mr-2 animate-spin rounded-full border border-white border-t-transparent" />
                                Locking...
                              </>
                            ) : isTeamLocked ? (
                              <>
                                <CheckCircle className="w-3 h-3 mr-2" />
                                Locked
                              </>
                            ) : (
                              <>
                                <Lock className="w-3 h-3 mr-2" />
                                Lock
                              </>
                            )}
                          </Button>
                          
                          {team.lockAndLoadAvailable && (
                            <Button 
                              size="sm"
                              variant="outline"
                              className="flex-1 h-9 text-sm border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-300 hover:bg-amber-50 dark:hover:bg-amber-950/20 disabled:opacity-30"
                              disabled={!isTeamLocked || lockTeamMutation.isPending}
                              onClick={() => isTeamLocked && handleLockAndLoadClick(team)}
                            >
                              {lockTeamMutation.isPending && selectedTeam?.id === team.id ? (
                                <>
                                  <div className="w-3 h-3 mr-2 animate-spin rounded-full border border-amber-600 border-t-transparent" />
                                  Loading...
                                </>
                              ) : (
                                <>
                                  <Zap className="w-3 h-3 mr-2" />
                                  Lock & Load
                                </>
                              )}
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                    );
                  })}

                  {/* Unavailable Teams - More compact */}
                  {(userTeams as any[]).filter(team => team.locksRemaining === 0 || team.isBye).length > 0 && (
                    <div className="mt-4 pt-4 border-t border-border/50">
                      <p className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wide">
                        Unavailable This Week
                      </p>
                      <div className="grid grid-cols-3 gap-1.5">
                        {(userTeams as any[]).filter(team => team.locksRemaining === 0 || team.isBye).map((team: any) => (
                          <div 
                            key={team.id}
                            className="flex items-center p-2 rounded-md bg-muted/20 opacity-60"
                          >
                            <TeamLogo 
                              logoUrl={team.nflTeam.logoUrl}
                              teamCode={team.nflTeam.code}
                              teamName={team.nflTeam.name}
                              size="sm"
                              className="w-5 h-5 mr-1.5"
                            />
                            <div className="flex-1 min-w-0">
                              <div className="font-medium text-xs truncate">
                                {team.nflTeam.code}
                              </div>
                              <div className="text-xs text-muted-foreground leading-none">
                                {team.isBye ? 'Bye' : 'Used'}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
      <BottomNav />

      {/* Lock Confirmation Dialog */}
      <Dialog open={lockDialogOpen} onOpenChange={handleLockDialogChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <div className="flex items-center space-x-2">
              <Lock className="w-5 h-5 text-blue-600" />
              <DialogTitle>Lock Team for Week {selectedWeek}</DialogTitle>
            </div>
            <DialogDescription className="space-y-3 pt-2">
              <div className="flex items-center space-x-3 p-3 rounded-lg bg-muted/50">
                {selectedTeam && (
                  <>
                    <TeamLogo 
                      logoUrl={selectedTeam.nflTeam?.logoUrl}
                      teamCode={selectedTeam.nflTeam?.code}
                      teamName={selectedTeam.nflTeam?.name}
                      size="md"
                      className="w-8 h-8"
                    />
                    <div>
                      <div className="font-medium text-sm">
                        {selectedTeam.nflTeam?.city} {selectedTeam.nflTeam?.name}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {(() => {
                          const match = selectedTeam.upcomingOpponent?.match(/^(.*?)\s([+-]\d+(?:\.\d+)?)$/) || [];
                          const opponent = match[1] || selectedTeam.upcomingOpponent;
                          const spread = match[2];
                          return (
                            <>
                              <span>{opponent}</span>
                              {spread && (
                                <span className="text-white text-sm font-semibold ml-2 font-mono tracking-wider">
                                  {spread}
                                </span>
                              )}
                            </>
                          );
                        })()}
                      </div>
                    </div>
                  </>
                )}
              </div>
              <div className="text-sm">
                <p className="mb-2">This will lock your team for <strong>+1 bonus point</strong> if they win.</p>
                <p className="text-xs text-muted-foreground">
                  • You can only lock 1 team per week<br/>
                  • Maximum 4 locks per team per season<br/>
                  • This cannot be undone
                </p>
              </div>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex-row space-x-2 sm:space-x-2">
            <Button
              variant="outline"
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                console.log('[Dialog] Cancel button clicked');
                setLockDialogOpen(false);
              }}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                confirmLock();
              }}
              disabled={lockTeamMutation.isPending}
              className="flex-1"
            >
              {lockTeamMutation.isPending ? (
                <>
                  <div className="w-3 h-3 mr-2 animate-spin rounded-full border border-white border-t-transparent" />
                  Locking...
                </>
              ) : (
                <>
                  <Lock className="w-3 h-3 mr-2" />
                  Confirm Lock
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Lock & Load Confirmation Dialog */}
      <Dialog open={lockAndLoadDialogOpen} onOpenChange={handleLockAndLoadDialogChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <div className="flex items-center space-x-2">
              <div className="p-1 rounded-full bg-amber-100 dark:bg-amber-900/30">
                <Zap className="w-4 h-4 text-amber-600 dark:text-amber-400" />
              </div>
              <DialogTitle className="text-amber-700 dark:text-amber-300">
                Lock & Load for Week {selectedWeek}
              </DialogTitle>
            </div>
            <DialogDescription className="space-y-3 pt-2">
              <div className="flex items-center space-x-3 p-3 rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800">
                {selectedTeam && (
                  <>
                    <TeamLogo 
                      logoUrl={selectedTeam.nflTeam?.logoUrl}
                      teamCode={selectedTeam.nflTeam?.code}
                      teamName={selectedTeam.nflTeam?.name}
                      size="md"
                      className="w-8 h-8"
                    />
                    <div>
                      <div className="font-medium text-sm">
                        {selectedTeam.nflTeam?.city} {selectedTeam.nflTeam?.name}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {(() => {
                          const match = selectedTeam.upcomingOpponent?.match(/^(.*?)\s([+-]\d+(?:\.\d+)?)$/) || [];
                          const opponent = match[1] || selectedTeam.upcomingOpponent;
                          const spread = match[2];
                          return (
                            <>
                              <span>{opponent}</span>
                              {spread && (
                                <span className="text-white text-sm font-semibold ml-2 font-mono tracking-wider">
                                  {spread}
                                </span>
                              )}
                            </>
                          );
                        })()}
                      </div>
                    </div>
                  </>
                )}
              </div>
              <div className="space-y-2 text-sm">
                <div className="flex items-center space-x-2 text-amber-700 dark:text-amber-300">
                  <AlertTriangle className="w-4 h-4" />
                  <span className="font-medium">High Risk, High Reward</span>
                </div>
                <div className="pl-6 space-y-1 text-xs">
                  <p><strong className="text-green-600">Win:</strong> +2 bonus points (instead of +1)</p>
                  <p><strong className="text-red-600">Loss:</strong> -1 penalty point</p>
                </div>
                <p className="text-xs text-muted-foreground pt-2">
                  • Only available once per team per season<br/>
                  • Must be used on an already locked team<br/>
                  • This cannot be undone
                </p>
              </div>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex-row space-x-2 sm:space-x-2">
            <Button
              variant="outline"
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                console.log('[Dialog] Lock & Load Cancel button clicked');
                setLockAndLoadDialogOpen(false);
              }}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                confirmLockAndLoad();
              }}
              disabled={lockTeamMutation.isPending}
              className="flex-1 bg-amber-600 hover:bg-amber-700 text-white"
            >
              {lockTeamMutation.isPending ? (
                <>
                  <div className="w-3 h-3 mr-2 animate-spin rounded-full border border-white border-t-transparent" />
                  Loading...
                </>
              ) : (
                <>
                  <Zap className="w-3 h-3 mr-2" />
                  Activate Lock & Load
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}