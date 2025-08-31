import { Switch, Route } from "wouter";
import React from "react";
import { QueryProvider } from "@/features/query/QueryProvider";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/hooks/use-theme";
import { AuthProvider } from "@/features/auth/AuthProvider";
import { useAuth } from "@/features/auth/useAuth";
import { useQuery } from "@tanstack/react-query";
import { usePWADetection } from "@/hooks/use-pwa-detection";
import { useServiceWorker } from "@/hooks/use-service-worker";
import { useAutoPushRefresh } from "@/hooks/use-auto-push-refresh";
import { PWAInstallPrompt } from "@/components/pwa-install-prompt";
import { useProductionRealtime } from "@/hooks/use-production-realtime";

// League type for draft status checking
interface UserLeague {
  id: string;
  name: string;
  joinCode: string;
  maxTeams: number;
  creatorId: string;
  isActive: boolean;
  draftScheduledAt?: string;
  draftStarted: boolean;
  createdAt: string;
  memberCount: number;
  isCreator: boolean;
  draftId?: string;
  draftStatus?: string;
}

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
import TradesPage from "@/pages/trades";
import AdminPanel from "@/pages/admin";
import DatabaseViewer from "@/pages/database-viewer";
import { LeagueWaiting } from "@/pages/league-waiting";
import NotFound from "@/pages/not-found";
import { logBuildInfo } from "@/lib/buildInfo";

function AppContent() {
  const { user, isLoading } = useAuth();
  const isAuthenticated = !!user;
  const { isPWA } = usePWADetection();
  
  // Check if user has any leagues once they're authenticated
  const { data: userLeagues = [], isLoading: leaguesLoading } = useQuery<UserLeague[]>({
    queryKey: ['/api/user/leagues'],
    enabled: !!user,
  });

  // Check if user has any leagues with completed drafts
  const hasLeaguesWithCompletedDrafts = userLeagues.some((league: UserLeague) => 
    league.draftStatus === 'completed'
  );
  
  // Log build info for debugging and cache verification
  React.useEffect(() => {
    logBuildInfo();
  }, []);
  
  // Initialize service worker for PWA functionality (with debug support via ?nosw)
  useServiceWorker();
  
  // Initialize automatic push notification refresh for iOS PWA
  useAutoPushRefresh({ user, isAuthenticated });
  
  // Initialize stable WebSocket connection for real-time updates
  const { isConnected: isRealtimeConnected, connectionStatus } = useProductionRealtime({ user, isLoading });
  
  // Log WebSocket connection status
  React.useEffect(() => {
    console.log('[App] WebSocket status:', connectionStatus, 
      isRealtimeConnected ? '(Connected)' : '(Disconnected)');
    
    if (isRealtimeConnected) {
      console.log('[App] ✅ Real-time updates active - scores will update instantly');
    } else if (connectionStatus === 'waiting_auth') {
      console.log('[App] ⏳ Waiting for authentication to complete');
    } else if (connectionStatus === 'connecting') {
      console.log('[App] 🔄 Attempting to connect...');
    }
  }, [connectionStatus, isRealtimeConnected]);

  // PWA install prompt removed - app now accessible on all devices
  // Users can still install manually via browser menu if desired

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

  // If user is authenticated but still loading league data, show loading
  if (leaguesLoading) {
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
          <p>Loading leagues...</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <Switch>
        <Route path="/login" component={LoginPage} />
        <Route path="/admin" component={AdminPanel} />
        <Route path="/database" component={DatabaseViewer} />
        <Route path="/dashboard" component={DashboardPage} />
        <Route path="/leagues" component={LeaguesPage} />
        <Route path="/league/waiting" component={LeagueWaiting} />
        <Route path="/draft/:draftId">
          {(params) => {
            console.log('[App] Draft route matched with params:', params);
            console.log('[App] Current location:', window.location.href);
            return <DraftPage />;
          }}
        </Route>
        <Route path="/main">
          {() => {
            // If user has no leagues, show leagues page
            const hasLeagues = Array.isArray(userLeagues) && userLeagues.length > 0;
            if (!hasLeagues) return <LeaguesPage />;
            
            // If user has leagues but none with completed drafts, redirect to waiting room
            if (!hasLeaguesWithCompletedDrafts) {
              const firstLeague = userLeagues[0];
              window.location.href = `/league/waiting?id=${firstLeague.id}`;
              return null;
            }
            
            return <MainPage />;
          }}
        </Route>
        <Route path="/stable" component={StablePage} />
        <Route path="/league" component={LeaguePage} />
        <Route path="/scores" component={ScoresPage} />
        <Route path="/more" component={MorePage} />
        <Route path="/more/trades" component={TradesPage} />
        <Route path="/">
          {() => {
            // If user has no leagues, show leagues page
            const hasLeagues = Array.isArray(userLeagues) && userLeagues.length > 0;
            if (!hasLeagues) return <LeaguesPage />;
            
            // If user has leagues but none with completed drafts, redirect to waiting room
            if (!hasLeaguesWithCompletedDrafts) {
              const firstLeague = userLeagues[0];
              window.location.href = `/league/waiting?id=${firstLeague.id}`;
              return null;
            }
            
            return <MainPage />;
          }}
        </Route>
        <Route component={NotFound} />
      </Switch>
      {!isPWA && window.innerWidth >= 768 && <DesktopNotice />}
    </>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="dark" storageKey="mok-sports-theme">
        <TooltipProvider>
          <QueryProvider>
            <AuthProvider>
              <Toaster />
              <AppContent />
            </AuthProvider>
          </QueryProvider>
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
