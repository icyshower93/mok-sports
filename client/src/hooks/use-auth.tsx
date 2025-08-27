import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { AuthToken } from "@/lib/auth-token";

interface User {
  id: string;
  email: string;
  name: string;
  avatar?: string;
}

interface OAuthConfig {
  oauthConfigured: boolean;
  provider: string;
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  login: () => void;
  logout: () => Promise<void>;
  isAuthenticated: boolean;
  oauthConfigured: boolean;
  oauthLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
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
    mutationFn: () => apiRequest("POST", "/api/auth/logout"),
    onSuccess: () => {
      setIsAuthenticated(false);
      AuthToken.clear(); // Clear stored token
      queryClient.clear();
      window.location.href = "/";
    },
  });

  useEffect(() => {
    const hasUser = !!user;
    setIsAuthenticated(hasUser && !isLoading);
    
    if (error && !isLoading) {
      setIsAuthenticated(false);
    }
  }, [user, error, isLoading]);

  // PWA Token Recovery - check localStorage on app startup
  useEffect(() => {
    const storedToken = AuthToken.get();
    console.log('[Auth] Token check - Has token:', !!storedToken, 'Has user:', !!user, 'Loading:', isLoading);
    
    if (storedToken && !user && !isLoading) {
      console.log('[Auth] Found stored token, refreshing authentication...');
      queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
    }
    
    // REMOVED: Development auto-login for Sky Evans (causes PWA refresh conflicts when Sky Evans is current picker)
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

  return (
    <AuthContext.Provider
      value={{
        user: (user as User) || null,
        isLoading,
        login,
        logout,
        isAuthenticated,
        oauthConfigured: oauthConfig?.oauthConfigured || false,
        oauthLoading,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
