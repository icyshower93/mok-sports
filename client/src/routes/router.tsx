import * as React from "react";
import { Switch, Route } from "wouter";
import { useAuth } from "@/features/auth/AuthContext";

const Main = React.lazy(() => import("@/pages/main"));
const Login = React.lazy(() => import("@/pages/login"));

function AuthGuard({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading, oauthLoading } = useAuth();
  
  if (isLoading || oauthLoading) {
    return <div className="flex items-center justify-center min-h-screen text-foreground">Loading...</div>;
  }
  
  if (!isAuthenticated) {
    return <Login />;
  }
  
  return <>{children}</>;
}

export function getRouter() {
  return (
    <Switch>
      <Route path="/login" component={Login} />
      <Route path="/">
        <AuthGuard>
          <Main />
        </AuthGuard>
      </Route>
    </Switch>
  );
}