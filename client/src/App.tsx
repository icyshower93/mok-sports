import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/hooks/use-theme";
import { AuthProvider, useAuth } from "@/hooks/use-auth";
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

  console.log('[iOS Debug] App state:', { isAuthenticated, isLoading, hasUser: !!user });

  if (isLoading && !user) {
    console.log('[iOS Debug] Showing loading screen');
    return (
      <div style={{
        minHeight: '100vh',
        backgroundColor: '#0f172a',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: 'white'
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{
            width: '32px',
            height: '32px',
            border: '2px solid #10b981',
            borderTop: '2px solid transparent',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
            margin: '0 auto 16px'
          }}></div>
          <p>Loading...</p>
        </div>
      </div>
    );
  }

  // Add a fallback for when authentication state is unclear
  if (!isAuthenticated && !user && !isLoading) {
    console.log('[iOS Debug] No auth state, showing login');
  }

  return (
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
