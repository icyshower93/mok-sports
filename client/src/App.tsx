import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/hooks/use-auth";
import LoginPage from "@/pages/login";
import DashboardPage from "@/pages/dashboard";
import LeaguesPage from "@/pages/leagues";
import DraftPage from "@/pages/draft";
import ProfilePage from "@/pages/profile";
import NotFound from "@/pages/not-found";

function AppContent() {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
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
    <Switch>
      <Route path="/login">
        <LoginPage />
      </Route>
      <Route path="/">
        {isAuthenticated ? <DashboardPage /> : <LoginPage />}
      </Route>
      <Route path="/leagues">
        {isAuthenticated ? <LeaguesPage /> : <LoginPage />}
      </Route>
      <Route path="/draft">
        {isAuthenticated ? <DraftPage /> : <LoginPage />}
      </Route>
      <Route path="/profile">
        {isAuthenticated ? <ProfilePage /> : <LoginPage />}
      </Route>
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AuthProvider>
          <Toaster />
          <AppContent />
        </AuthProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
