import { useQuery } from "@tanstack/react-query";
import { MainLayout } from "@/components/layout/main-layout";
import { getFullTeamName, type NflTeam } from "@/lib/nfl-teams";

export default function TeamsPage() {
  const { data: teams, isLoading, error } = useQuery<NflTeam[]>({
    queryKey: ["/api/nfl-teams"],
  });

  if (isLoading) {
    return (
      <MainLayout>
        <div className="py-8">
          <h1 className="text-3xl font-bold text-foreground mb-8">NFL Teams</h1>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {Array.from({ length: 32 }).map((_, i) => (
              <div key={i} className="fantasy-card p-4 text-center animate-pulse">
                <div className="w-16 h-16 bg-muted rounded-lg mx-auto mb-3"></div>
                <div className="h-4 bg-muted rounded mb-2"></div>
                <div className="h-3 bg-muted rounded"></div>
              </div>
            ))}
          </div>
        </div>
      </MainLayout>
    );
  }

  if (error) {
    return (
      <MainLayout>
        <div className="py-8">
          <h1 className="text-3xl font-bold text-foreground mb-8">NFL Teams</h1>
          <div className="fantasy-card p-8 text-center">
            <p className="text-destructive">Failed to load NFL teams</p>
          </div>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="py-8">
        <h1 className="text-3xl font-bold text-foreground mb-8">NFL Teams</h1>
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
          {teams?.map((team) => (
            <div key={team.id} className="fantasy-card fantasy-card-hover p-4 text-center">
              <img
                src={team.logoLarge}
                alt={`${getFullTeamName(team)} logo`}
                className="w-16 h-16 mx-auto mb-3 object-contain"
                onError={(e) => {
                  // Fallback to small logo if large logo fails
                  const target = e.target as HTMLImageElement;
                  target.src = team.logoSmall;
                }}
              />
              <h3 className="font-semibold text-foreground text-sm mb-1">
                {team.city}
              </h3>
              <p className="text-muted-foreground text-xs">
                {team.name}
              </p>
              <p className="text-xs font-mono mt-2 text-muted-foreground bg-muted px-2 py-1 rounded">
                {team.code}
              </p>
            </div>
          ))}
        </div>
      </div>
    </MainLayout>
  );
}