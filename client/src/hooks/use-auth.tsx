import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

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
    refetchOnWindowFocus: false,
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

  // Check URL params for auth success/error
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const authStatus = urlParams.get("auth");
    const error = urlParams.get("error");

    if (authStatus === "success") {
      setIsAuthenticated(true);
      sessionStorage.setItem('login-time', Date.now().toString());
      queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
      window.history.replaceState({}, document.title, "/");
    } else if (error) {
      setIsAuthenticated(false);
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
