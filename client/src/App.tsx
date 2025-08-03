import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/hooks/use-theme";
import { AuthProvider, useAuth } from "@/hooks/use-auth";
import { usePWADetection } from "@/hooks/use-pwa-detection";
import { PWAInstallPrompt } from "@/components/pwa-install-prompt";
import { DebugPanel } from "@/components/debug-panel";
import { ErrorBoundary } from "@/components/error-boundary";
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
  const pwaStatus = usePWADetection();

  console.log('[Debug] App state:', { 
    isAuthenticated, 
    isLoading, 
    hasUser: !!user,
    pwaStatus
  });

  // Show install prompt if not in PWA mode and can install
  if (!pwaStatus.isPWA && pwaStatus.canInstall) {
    console.log('[PWA] Showing install prompt');
    return <PWAInstallPrompt />;
  }

  if (isLoading && !user) {
    console.log('[Debug] Showing loading screen');
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

  console.log('[Debug] Rendering main app - bypassed install prompt');

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
      
      {/* Debug panel - only show in development or when query param is present */}
      {(import.meta.env.DEV || new URLSearchParams(window.location.search).has('debug')) && (
        <DebugPanel />
      )}
    </>
  );
}

function App() {
  return (
    <ErrorBoundary>
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
    </ErrorBoundary>
  );
}

export default App;
