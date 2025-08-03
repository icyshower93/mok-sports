import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { MainLayout } from "@/components/layout/main-layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Copy, Users, Clock, Share2, RefreshCw, LogOut } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { useLocation } from "wouter";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { queryClient } from "@/lib/queryClient";
import { DraftNotificationReminder } from "@/components/draft-notification-reminder";

interface League {
  id: string;
  name: string;
  joinCode: string;
  maxTeams: number;
  memberCount: number;
  isActive: boolean;
  createdAt: string;
  members?: Array<{
    id: string;
    name: string;
    avatar: string | null;
    joinedAt: string;
  }>;
}

export function LeagueWaiting() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [leagueId, setLeagueId] = useState<string | null>(null);

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
    queryKey: ['/api/leagues', leagueId],
    enabled: !!leagueId,
    refetchInterval: 5000, // Refresh every 5 seconds to check for new members
  });

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
                  draftStartTime={new Date(Date.now() + 30 * 60 * 1000)} // 30 minutes from now for demo
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
                  {league.members?.map((member) => (
                    <div key={member.id} className="flex items-center gap-3 p-2 rounded-lg bg-muted/50">
                      <Avatar className="w-8 h-8">
                        <AvatarImage src={member.avatar || undefined} alt={member.name} />
                        <AvatarFallback className="text-xs">
                          {member.name.split(' ').map(n => n[0]).join('').toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{member.name}</p>
                        <p className="text-xs text-muted-foreground">
                          Joined {new Date(member.joinedAt).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                  )) || []}
                  
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
                      League is Full!
                    </h3>
                    <p className="text-sm text-muted-foreground mb-4">
                      All {league.maxTeams} teams have joined. The draft will begin soon.
                    </p>
                    <Button className="bg-fantasy-green hover:bg-fantasy-green/90">
                      Start Draft
                    </Button>
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
                  className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950"
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