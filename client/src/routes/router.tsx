import * as React from "react";
import { Switch, Route, useLocation } from "wouter";
import { useAuth } from "@/features/auth/AuthContext";
import { MainLayout } from "@/components/layout/main-layout";
import { BottomNav } from "@/components/layout/bottom-nav";

const Main = React.lazy(() => import("@/pages/main"));
const Login = React.lazy(() => import("@/pages/login"));
const Dashboard = React.lazy(() => import("@/pages/dashboard"));
const Draft = React.lazy(() => import("@/pages/draft"));
const Scores = React.lazy(() => import("@/pages/scores"));
const Teams = React.lazy(() => import("@/pages/teams"));
const Leagues = React.lazy(() => import("@/pages/leagues"));
const Trades = React.lazy(() => import("@/pages/trades"));
const Admin = React.lazy(() => import("@/pages/admin"));
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
    <MainLayout>
      <div className="pb-20">
        {children}
      </div>
      <BottomNav />
    </MainLayout>
  );
}

function MoreIndex() {
  const [, nav] = useLocation();
  React.useEffect(() => { 
    nav('/more/trades', { replace: true }); 
  }, [nav]);
  return null;
}

export function getRouter() {
  return (
    <Switch>
      <Route path="/login" component={Login} />
      <Route path="/dashboard" component={() => <AuthGuard><Dashboard /></AuthGuard>} />
      <Route path="/draft" component={() => <AuthGuard><Draft /></AuthGuard>} />
      <Route path="/scores" component={() => <AuthGuard><Scores /></AuthGuard>} />
      <Route path="/teams" component={() => <AuthGuard><Teams /></AuthGuard>} />
      <Route path="/leagues" component={() => <AuthGuard><Leagues /></AuthGuard>} />
      <Route path="/more" component={() => <AuthGuard><MoreIndex /></AuthGuard>} />
      <Route path="/more/trades" component={() => <AuthGuard><Trades /></AuthGuard>} />
      <Route path="/trades" component={() => <AuthGuard><Trades /></AuthGuard>} />
      <Route path="/admin" component={() => <AuthGuard><Admin /></AuthGuard>} />
      <Route path="/agents" component={() => <AuthGuard><Agents /></AuthGuard>} />
      <Route path="/profile" component={() => <AuthGuard><Profile /></AuthGuard>} />
      <Route path="/test-notifications" component={() => <AuthGuard><TestNotifications /></AuthGuard>} />
      <Route path="/">
        <AuthGuard>
          <Main />
        </AuthGuard>
      </Route>
    </Switch>
  );
}