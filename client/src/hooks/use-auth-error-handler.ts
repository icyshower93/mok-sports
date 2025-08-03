import { useCallback } from 'react';
import { useToast } from '@/hooks/use-toast';

interface AuthError {
  message: string;
  reason?: string;
  error?: string;
  debug?: any;
}

export function useAuthErrorHandler() {
  const { toast } = useToast();

  const handleAuthError = useCallback((error: AuthError, context: string = '') => {

    // Show user-friendly error messages based on the error reason
    switch (error.reason) {
        toast({
          title: "Session Expired",
          description: "Please sign in again to continue.",
        });
        break;
        
        toast({
          title: "Authentication Failed",
          description: "Your session is invalid. Please sign in again.",
        });
        break;
        
        toast({
          title: "Authentication Error",
          description: error.message || "Unable to verify your identity. Please try signing in again.",
        });
    }

    // Clear any cached authentication state
    localStorage.removeItem('auth_user');
    
    // Redirect to login if not already there
    if (!window.location.pathname.includes('/login')) {
      window.location.href = '/login';
    }
  }, [toast]);

    return error?.status === 401 || 
           error?.response?.status === 401 ||
           error?.message?.includes('Not authenticated') ||
           error?.message?.includes('Invalid token');
  }, []);

  return {
    handleAuthError,
    isAuthenticationError
  };
}