import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AuthContext, type AuthValue, type User } from "./AuthContext";
import { AuthToken } from "@/lib/auth-token";
import { markModule } from '@/lib/dup-guard';

markModule('features/auth/AuthProvider');

interface OAuthConfig {
  oauthConfigured: boolean;
  provider: string;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [lastKnownAuthState, setLastKnownAuthState] = useState<boolean | null>(null);
  const [authGraceTimer, setAuthGraceTimer] = useState<NodeJS.Timeout | null>(null);
  const queryClient = useQueryClient();

  const { data: user, isLoading, error } = useQuery({
    queryKey: ["/api/auth/me"],
    retry: false,
    enabled: true,
    refetchOnWindowFocus: true, // Re-check auth when PWA regains focus
    refetchOnMount: true,
    staleTime: 0, // Always check fresh authentication status
    gcTime: 0, // Don't cache auth responses (renamed from cacheTime in v5)
  });

  const { data: oauthConfig, isLoading: oauthLoading } = useQuery<OAuthConfig>({
    queryKey: ["/api/auth/config"],
    retry: false,
    enabled: true,
  });

  const logoutMutation = useMutation({
    mutationFn: async () => {
      const { apiRequest } = await import("@/features/query/api");
      return apiRequest("POST", "/api/auth/logout");
    },
    onSuccess: () => {
      setIsAuthenticated(false);
      AuthToken.clear(); // Clear stored token
      queryClient.clear();
      window.location.href = "/";
    },
  });

  useEffect(() => {
    const hasUser = !!user;
    const currentlyAuthenticated = hasUser && !isLoading;
    
    // Add grace period before flipping from true → false during reconnects
    if (currentlyAuthenticated) {
      // User is authenticated, clear any grace timer and update state
      if (authGraceTimer) {
        clearTimeout(authGraceTimer);
        setAuthGraceTimer(null);
      }
      setIsAuthenticated(true);
      setLastKnownAuthState(true);
    } else if (lastKnownAuthState === true && !isLoading) {
      // User was authenticated but now isn't - add grace period
      if (!authGraceTimer) {
        const timer = setTimeout(() => {
          // After grace period, check if we still don't have auth
          if (!user && !isLoading) {
            setIsAuthenticated(false);
            setLastKnownAuthState(false);
          }
          setAuthGraceTimer(null);
        }, 5000); // 5 second grace period
        setAuthGraceTimer(timer);
      }
    } else if (!hasUser && !isLoading && error) {
      // Definitive error - no grace period needed
      if (authGraceTimer) {
        clearTimeout(authGraceTimer);
        setAuthGraceTimer(null);
      }
      setIsAuthenticated(false);
      setLastKnownAuthState(false);
    }
  }, [user, error, isLoading, lastKnownAuthState, authGraceTimer]);

  // PWA Token Recovery - check localStorage on app startup
  useEffect(() => {
    const storedToken = AuthToken.get();
    console.log('[Auth] Token check - Has token:', !!storedToken, 'Has user:', !!user, 'Loading:', isLoading);
    
    if (storedToken && !user && !isLoading) {
      console.log('[Auth] Found stored token, refreshing authentication...');
      queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
    }
  }, [user, isLoading, queryClient]);

  // Check URL params for auth success/error and extract token
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const authStatus = urlParams.get("auth");
    const token = urlParams.get("token");
    const error = urlParams.get("error");

    if (authStatus === "success" && token) {
      // Store the token for PWA compatibility
      AuthToken.set(token);
      setIsAuthenticated(true);
      sessionStorage.setItem('login-time', Date.now().toString());
      queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
      window.history.replaceState({}, document.title, "/");
    } else if (authStatus === "success") {
      // Fallback for cookie-only auth
      setIsAuthenticated(true);
      sessionStorage.setItem('login-time', Date.now().toString());
      queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
      window.history.replaceState({}, document.title, "/");
    } else if (error) {
      setIsAuthenticated(false);
      AuthToken.clear();
      window.history.replaceState({}, document.title, "/");
    }
  }, [queryClient]);

  const login = () => {
    if (!oauthConfig?.oauthConfigured) {
      return;
    }
    window.location.href = "/api/auth/google";
  };

  const logout = async () => {
    await logoutMutation.mutateAsync();
  };

  const value = useMemo<AuthValue>(() => ({
    user: (user as User) || null,
    token: AuthToken.get(),
    isLoading,
    isAuthenticated,
    oauthConfigured: oauthConfig?.oauthConfigured || false,
    oauthLoading,
    login,
    logout,
  }), [user, isLoading, isAuthenticated, oauthConfig?.oauthConfigured, oauthLoading, login, logout]);

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}