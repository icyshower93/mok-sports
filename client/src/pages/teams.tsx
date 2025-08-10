import React, { useState } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { BottomNav } from "@/components/layout/bottom-nav";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { TeamLogo } from "@/components/team-logo";
import { useAuth } from "@/hooks/use-auth";
import { 
  Shield, 
  Lock, 
  Zap
} from "lucide-react";

export default function StablePage() {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const [selectedWeek] = useState(1);

  // Fetch user's leagues and teams (same as main page)
  const { data: leagues = [], isLoading: leaguesLoading } = useQuery({
    queryKey: ['/api/user/leagues'],
    enabled: !!user,
  });

  const selectedLeague = (leagues as any[])[0]?.id || "";

  const { data: userTeams = [], isLoading: teamsLoading } = useQuery({
    queryKey: ['/api/leagues', selectedLeague, 'stable'],
    enabled: !!user && !!selectedLeague,
  });

  // Lock deadline (Thursday 8:20 PM ET for current week)
  const lockDeadline = new Date();
  lockDeadline.setDate(lockDeadline.getDate() + (4 - lockDeadline.getDay() + 7) % 7); // Next Thursday
  lockDeadline.setHours(20, 20, 0, 0); // 8:20 PM

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
        <div className="flex items-center space-x-2">
          <Shield className="w-6 h-6 text-primary" />
          <h1 className="text-2xl font-bold">My Stable</h1>
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
                  {(userTeams as any[]).filter(team => team.locksRemaining > 0 && !team.isBye).map((team: any) => (
                    <div 
                      key={team.id}
                      className="rounded-lg border bg-card hover:shadow-sm transition-all duration-200 overflow-hidden"
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
                                  {team.upcomingOpponent}
                                </span>
                                <span className="text-xs px-1.5 py-0.5 rounded bg-muted/50 font-mono">
                                  {team.pointSpread > 0 ? '+' : ''}{team.pointSpread}
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
                            className="flex-1 h-9 text-sm"
                            disabled={team.isLocked}
                          >
                            {team.isLocked ? (
                              <>
                                <Lock className="w-3 h-3 mr-2" />
                                Locked
                              </>
                            ) : (
                              <>
                                <Lock className="w-3 h-3 mr-2" />
                                Lock
                              </>
                            )}
                          </Button>
                          
                          {team.lockAndLoadAvailable && !team.isLocked && (
                            <Button 
                              size="sm"
                              variant="outline"
                              className="flex-1 h-9 text-sm border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-300 hover:bg-amber-50 dark:hover:bg-amber-950/20"
                            >
                              <Zap className="w-3 h-3 mr-2" />
                              Lock & Load
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}

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
    </div>
  );
}