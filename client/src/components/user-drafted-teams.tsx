import { useQuery } from "@tanstack/react-query";
import { TeamLogo } from "@/components/team-logo";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Trophy, Users } from "lucide-react";

interface DraftedTeam {
  id: string;
  round: number;
  pickNumber: number;
  nflTeam: {
    id: string;
    code: string;
    name: string;
    city: string;
    conference: 'AFC' | 'NFC';
    division: string;
    logoUrl: string;
  };
  isAutoPick: boolean;
}

interface UserDraftedTeamsProps {
  leagueId: string;
  userId: string;
  showTitle?: boolean;
}

export function UserDraftedTeams({ leagueId, userId, showTitle = true }: UserDraftedTeamsProps) {
  const { data: draftedTeams, isLoading } = useQuery<DraftedTeam[]>({
    queryKey: [`/api/leagues/${leagueId}/drafted-teams/${userId}`],
    enabled: !!leagueId && !!userId
  });

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-3">
          {showTitle && <CardTitle className="text-lg">Your Teams</CardTitle>}
        </CardHeader>
        <CardContent>
          <div className="text-center text-muted-foreground">Loading teams...</div>
        </CardContent>
      </Card>
    );
  }

  if (!draftedTeams || draftedTeams.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-3">
          {showTitle && <CardTitle className="text-lg">Your Teams</CardTitle>}
        </CardHeader>
        <CardContent>
          <div className="text-center text-muted-foreground">
            <Trophy className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p>No teams drafted yet</p>
            <p className="text-xs">Teams will appear here once the draft starts</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Group teams by conference
  const afcTeams = draftedTeams.filter(team => team.nflTeam.conference === 'AFC');
  const nfcTeams = draftedTeams.filter(team => team.nflTeam.conference === 'NFC');

  return (
    <Card>
      <CardHeader className="pb-3">
        {showTitle && (
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">Your Teams</CardTitle>
            <Badge variant="secondary">
              <Users className="w-3 h-3 mr-1" />
              {draftedTeams.length} teams
            </Badge>
          </div>
        )}
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {afcTeams.length > 0 && (
            <div>
              <h4 className="text-sm font-semibold text-blue-600 mb-2 uppercase tracking-wide">
                AFC ({afcTeams.length})
              </h4>
              <div className="space-y-2">
                {afcTeams.map((team) => (
                  <div key={team.id} className="flex items-center space-x-3 p-2 rounded-lg bg-blue-50 dark:bg-blue-950/20">
                    <TeamLogo 
                      logoUrl={team.nflTeam.logoUrl}
                      teamCode={team.nflTeam.code}
                      teamName={`${team.nflTeam.city} ${team.nflTeam.name}`}
                      size="md"
                    />
                    <div className="flex-1">
                      <div className="font-medium text-sm">{team.nflTeam.city} {team.nflTeam.name}</div>
                      <div className="text-xs text-muted-foreground">
                        Round {team.round} - Pick #{team.pickNumber}
                        {team.isAutoPick && ' (Auto)'}
                      </div>
                    </div>
                    <div className="w-2 h-2 rounded-full bg-blue-500" />
                  </div>
                ))}
              </div>
            </div>
          )}

          {nfcTeams.length > 0 && (
            <div>
              <h4 className="text-sm font-semibold text-red-600 mb-2 uppercase tracking-wide">
                NFC ({nfcTeams.length})
              </h4>
              <div className="space-y-2">
                {nfcTeams.map((team) => (
                  <div key={team.id} className="flex items-center space-x-3 p-2 rounded-lg bg-red-50 dark:bg-red-950/20">
                    <TeamLogo 
                      logoUrl={team.nflTeam.logoUrl}
                      teamCode={team.nflTeam.code}
                      teamName={`${team.nflTeam.city} ${team.nflTeam.name}`}
                      size="md"
                    />
                    <div className="flex-1">
                      <div className="font-medium text-sm">{team.nflTeam.city} {team.nflTeam.name}</div>
                      <div className="text-xs text-muted-foreground">
                        Round {team.round} - Pick #{team.pickNumber}
                        {team.isAutoPick && ' (Auto)'}
                      </div>
                    </div>
                    <div className="w-2 h-2 rounded-full bg-red-500" />
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}