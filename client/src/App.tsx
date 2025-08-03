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

  // Check if this is iOS Safari browser (not PWA) 
  const isIOSSafari = typeof window !== 'undefined' && 
    /iPad|iPhone|iPod/.test(navigator.userAgent) && 
    !window.matchMedia('(display-mode: standalone)').matches &&
    !('standalone' in window.navigator && (window.navigator as any).standalone === true);
  
  // For iOS Safari, always show install prompt regardless of auth state
  if (isIOSSafari) {
    console.log('[iOS Debug] iOS Safari detected, showing PWA install prompt');
    return (
      <div style={{
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #10b981, #3b82f6)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px'
      }}>
        <div style={{
          backgroundColor: 'white',
          padding: '40px',
          borderRadius: '16px',
          textAlign: 'center',
          maxWidth: '400px',
          width: '100%',
          boxShadow: '0 20px 40px rgba(0,0,0,0.1)'
        }}>
          <div style={{ marginBottom: '24px' }}>
            <h1 style={{ marginBottom: '8px', color: '#1f2937', fontSize: '28px', fontWeight: 'bold' }}>Mok Sports</h1>
            <p style={{ color: '#6b7280', fontSize: '16px' }}>Fantasy Sports Reimagined</p>
          </div>
          
          <div style={{ marginBottom: '32px', padding: '20px', backgroundColor: '#f8fafc', borderRadius: '12px' }}>
            <h3 style={{ marginBottom: '12px', color: '#1f2937', fontSize: '18px' }}>Install App for Best Experience</h3>
            <p style={{ marginBottom: '16px', color: '#6b7280', fontSize: '14px', lineHeight: '1.5' }}>
              For notifications and the best mobile experience, please add this app to your home screen:
            </p>
            <div style={{ textAlign: 'left', color: '#6b7280', fontSize: '14px' }}>
              <p>1. Tap the <strong>Share</strong> button below</p>
              <p>2. Select <strong>"Add to Home Screen"</strong></p>
              <p>3. Tap <strong>"Add"</strong></p>
            </div>
          </div>
          
          <div style={{ fontSize: '40px', marginBottom: '16px' }}>📱⬇️</div>
          <p style={{ color: '#6b7280', fontSize: '12px' }}>Once installed, open from your home screen to get started!</p>
        </div>
      </div>
    );
  }

  console.log('[iOS Debug] Rendering main app');

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
