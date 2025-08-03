import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/hooks/use-theme";
import { AuthProvider, useAuth } from "@/hooks/use-auth";
import { AuthDebugPanel } from "@/components/auth-debug-panel";
import LoginPage from "@/pages/login";
import DashboardPage from "@/pages/dashboard";
import LeaguesPage from "@/pages/leagues";
import DraftPage from "@/pages/draft";
import ProfilePage from "@/pages/profile";
import TeamsPage from "@/pages/teams";
import { LeagueWaiting } from "@/pages/league-waiting";
import NotFound from "@/pages/not-found";

function AppContent() {
  const { isAuthenticated, isLoading, user } = useAuth();

  console.log('[App Debug] Current state:', { isAuthenticated, isLoading, hasUser: !!user });

  // Show loading only if we're actually loading and don't have user data yet
  if (isLoading && !user) {
    return (
      <div className="min-h-screen bg-light-gray flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-fantasy-green border-t-transparent mx-auto mb-4"></div>
          <p className="text-muted-gray">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <Switch>
        <Route path="/login">
          <LoginPage />
        </Route>
        <Route path="/">
          {(isAuthenticated || user) ? <DashboardPage /> : <LoginPage />}
        </Route>
        <Route path="/leagues">
          {(isAuthenticated || user) ? <LeaguesPage /> : <LoginPage />}
        </Route>
        <Route path="/draft">
          {(isAuthenticated || user) ? <DraftPage /> : <LoginPage />}
        </Route>
        <Route path="/profile">
          {(isAuthenticated || user) ? <ProfilePage /> : <LoginPage />}
        </Route>
        <Route path="/teams">
          {(isAuthenticated || user) ? <TeamsPage /> : <LoginPage />}
        </Route>
        <Route path="/league/waiting">
          {(isAuthenticated || user) ? <LeagueWaiting /> : <LoginPage />}
        </Route>
        <Route component={NotFound} />
      </Switch>
      <AuthDebugPanel />
    </>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider defaultTheme="dark" storageKey="mok-sports-theme">
        <TooltipProvider>
          <AuthProvider>
            <Toaster />
            <AppContent />
          </AuthProvider>
        </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
