import * as React from "react";
import { Switch, Route, useLocation } from "wouter";
import { useAuth } from "@/features/auth/AuthContext";
import { AppShell } from "@/components/layout/app-shell";
import RequireLeague from "@/routes/guards/RequireLeague";

const Main = React.lazy(() => import("@/pages/main"));
const Login = React.lazy(() => import("@/pages/login"));
const Dashboard = React.lazy(() => import("@/pages/dashboard"));
const Draft = React.lazy(() => import("@/pages/draft"));
const Scores = React.lazy(() => import("@/pages/scores"));
const Teams = React.lazy(() => import("@/pages/teams"));
const Leagues = React.lazy(() => import("@/pages/leagues"));
const LeagueWaiting = React.lazy(() => import("@/pages/league-waiting"));
const Trades = React.lazy(() => import("@/pages/trades"));
const Admin = React.lazy(() => import("@/pages/admin"));
const DatabaseViewer = React.lazy(() => import("@/pages/database-viewer"));
const Agents = React.lazy(() => import("@/pages/agents"));
const Profile = React.lazy(() => import("@/pages/profile"));
const TestNotifications = React.lazy(() => import("@/pages/test-notifications"));

function AuthGuard({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading, oauthLoading } = useAuth();
  
  if (isLoading || oauthLoading) {
    return <div className="flex items-center justify-center min-h-screen text-foreground">Loading...</div>;
  }
  
  if (!isAuthenticated) {
    return <Login />;
  }
  
  return (
    <AppShell>
      <div className="pb-20 min-h-screen bg-gradient-to-b from-background to-muted/30">
        <div className="py-6">
          {children}
        </div>
      </div>
    </AppShell>
  );
}

const MoreHub = React.lazy(() => import("@/pages/more/index"));

export function getRouter() {
  return (
    <Switch>
      <Route path="/login" component={Login} />
      <Route path="/dashboard" component={() => <AuthGuard><Dashboard /></AuthGuard>} />
      <Route path="/draft/:draftId" component={() => <AuthGuard><RequireLeague><Draft /></RequireLeague></AuthGuard>} />
      <Route path="/draft" component={() => <AuthGuard><RequireLeague><Draft /></RequireLeague></AuthGuard>} />
      <Route path="/scores" component={() => <AuthGuard><RequireLeague><Scores /></RequireLeague></AuthGuard>} />
      <Route path="/standings" component={() => <AuthGuard><RequireLeague><Scores /></RequireLeague></AuthGuard>} />
      <Route path="/teams" component={() => <AuthGuard><RequireLeague><Teams /></RequireLeague></AuthGuard>} />
      <Route path="/leagues" component={() => <AuthGuard><Leagues /></AuthGuard>} />
      <Route path="/league" component={() => <AuthGuard><RequireLeague><Leagues /></RequireLeague></AuthGuard>} />
      <Route path="/league/waiting" component={() => <AuthGuard><LeagueWaiting /></AuthGuard>} />
      <Route path="/more" component={() => <AuthGuard><RequireLeague><MoreHub /></RequireLeague></AuthGuard>} />
      <Route path="/more/trades" component={() => <AuthGuard><RequireLeague><Trades /></RequireLeague></AuthGuard>} />
      <Route path="/trades" component={() => <AuthGuard><RequireLeague><Trades /></RequireLeague></AuthGuard>} />
      <Route path="/admin" component={() => <AuthGuard><Admin /></AuthGuard>} />
      <Route path="/database" component={() => <AuthGuard><DatabaseViewer /></AuthGuard>} />
      <Route path="/agents" component={() => <AuthGuard><Agents /></AuthGuard>} />
      <Route path="/profile" component={() => <AuthGuard><RequireLeague><Profile /></RequireLeague></AuthGuard>} />
      <Route path="/test-notifications" component={() => <AuthGuard><TestNotifications /></AuthGuard>} />
      <Route path="/">
        <AuthGuard>
          <RequireLeague>
            <Main />
          </RequireLeague>
        </AuthGuard>
      </Route>
    </Switch>
  );
}