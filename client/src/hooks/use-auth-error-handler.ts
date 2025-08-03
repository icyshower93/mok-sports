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
    console.error(`[Auth Error] ${context}:`, error);

    // Show user-friendly error messages based on the error reason
    switch (error.reason) {
      case 'no_token':
        toast({
          title: "Session Expired",
          description: "Please sign in again to continue.",
          variant: "destructive"
        });
        break;
        
      case 'invalid_token':
        toast({
          title: "Authentication Failed",
          description: "Your session is invalid. Please sign in again.",
          variant: "destructive"
        });
        break;
        
      default:
        toast({
          title: "Authentication Error",
          description: error.message || "Unable to verify your identity. Please try signing in again.",
          variant: "destructive"
        });
    }

    // Clear any cached authentication state
    localStorage.removeItem('auth_user');
    
    // Redirect to login if not already there
    if (!window.location.pathname.includes('/login')) {
      console.log('[Auth] Redirecting to login due to auth error');
      window.location.href = '/login';
    }
  }, [toast]);

  const isAuthenticationError = useCallback((error: any): boolean => {
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