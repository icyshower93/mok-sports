import { Switch, Route } from "wouter";
import React from "react";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/hooks/use-theme";
import { AuthProvider, useAuth } from "@/hooks/use-auth";
import { usePWADetection } from "@/hooks/use-pwa-detection";
import { useServiceWorker } from "@/hooks/use-service-worker";
import { useAutoPushRefresh } from "@/hooks/use-auto-push-refresh";
import { PWAInstallPrompt } from "@/components/pwa-install-prompt";

import { ErrorBoundary } from "@/components/error-boundary";
import { DesktopNotice } from "@/components/desktop-notice";
import LoginPage from "@/pages/login";
import DashboardPage from "@/pages/dashboard";
import LeaguesPage from "@/pages/leagues";
import DraftPage from "@/pages/draft";
import MainPage from "@/pages/main";
import ProfilePage from "@/pages/profile";
import StablePage from "@/pages/teams";
import LeaguePage from "@/pages/league";
import ScoresPage from "@/pages/scores";
import AgentsPage from "@/pages/agents";
import MorePage from "@/pages/more";
import { LeagueWaiting } from "@/pages/league-waiting";
import NotFound from "@/pages/not-found";
import { logBuildInfo } from "@/lib/buildInfo";

function AppContent() {
  const { user, isLoading } = useAuth();
  const isAuthenticated = !!user;
  const { isPWA } = usePWADetection();
  
  // Log build info for debugging and cache verification
  React.useEffect(() => {
    logBuildInfo();
  }, []);
  
  // Initialize service worker for PWA functionality
  useServiceWorker(false); // Enable service worker for both PWA and web browsers for testing
  
  // Initialize automatic push notification refresh for iOS PWA
  useAutoPushRefresh();

  // Show install prompt only on mobile devices when not in PWA mode
  // Allow desktop usage for testing/development
  const isDesktop = window.innerWidth >= 768; // Tailwind 'md' breakpoint
  if (!isPWA && !isDesktop) {
    return <PWAInstallPrompt />;
  }

  if (isLoading && !user) {
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
            margin: '0 auto 16px auto'
          }}></div>
          <p>Loading...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <LoginPage />;
  }


  return (
    <>
      <Switch>
        <Route path="/login" component={LoginPage} />
        <Route path="/" component={DashboardPage} />
        <Route path="/leagues" component={LeaguesPage} />
        <Route path="/league/waiting" component={LeagueWaiting} />
        <Route path="/draft/:draftId">
          {(params) => {
            console.log('[App] Draft route matched with params:', params);
            console.log('[App] Current location:', window.location.href);
            return <DraftPage />;
          }}
        </Route>
        <Route path="/main" component={MainPage} />
        <Route path="/stable" component={StablePage} />
        <Route path="/league" component={LeaguePage} />
        <Route path="/scores" component={ScoresPage} />
        <Route path="/more" component={MorePage} />
        <Route path="/profile" component={ProfilePage} />
        <Route component={NotFound} />
      </Switch>
      {!isPWA && window.innerWidth >= 768 && <DesktopNotice />}
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
