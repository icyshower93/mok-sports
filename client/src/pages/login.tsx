import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { AlertCircle, Trophy, Loader2 } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

export default function LoginPage() {
  const { login, isLoading, oauthConfigured, oauthLoading } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  useEffect(() => {
    // Check for error in URL params
    const urlParams = new URLSearchParams(window.location.search);
    const errorParam = urlParams.get("error");
    
    if (errorParam === "auth_failed") {
      setError("Authentication failed. Please try again.");
    } else if (errorParam === "oauth_not_configured") {
      setError("Google sign-in is temporarily unavailable. Please contact support.");
    }
  }, []);

  const handleGoogleLogin = () => {
    setError(null);
    
    if (!oauthConfigured) {
      setError("Google sign-in is temporarily unavailable. Please contact support.");
      return;
    }
    
    setIsLoggingIn(true);
    login();
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary via-purple-600 to-primary flex items-center justify-center p-6">
      <div className="w-full max-w-md animate-fade-in">
        {/* Brand Section */}
        <div className="text-center mb-12">
          <div className="relative inline-flex items-center justify-center w-24 h-24 bg-white rounded-3xl shadow-2xl mb-6 animate-bounce-in">
            <Trophy className="w-10 h-10 text-primary" />
            <div className="absolute -top-1 -right-1 w-6 h-6 bg-green-500 rounded-full flex items-center justify-center">
              <div className="w-2 h-2 bg-white rounded-full"></div>
            </div>
          </div>
          <h1 className="text-display text-white mb-3 animate-fade-in animate-stagger-1">
            Mok Sports
          </h1>
          <p className="text-xl text-white/90 font-medium mb-2 animate-fade-in animate-stagger-2">
            Fantasy Sports Reimagined
          </p>
          <p className="text-white/70 animate-fade-in animate-stagger-3">
            Draft entire teams, not just players
          </p>
        </div>

        {/* Auth Card */}
        <div className="fantasy-card p-8 backdrop-blur-sm bg-white/95 animate-slide-up">
          <div className="text-center mb-8">
            <h2 className="text-headline text-foreground mb-3">
              Welcome Back
            </h2>
            <p className="text-body">Sign in to continue your fantasy journey</p>
          </div>

          {/* Google Auth Button */}
          <button
            onClick={handleGoogleLogin}
            disabled={isLoading || isLoggingIn || oauthLoading || !oauthConfigured}
            className="w-full bg-white border-2 border-gray-200 hover:border-primary text-gray-700 hover:text-primary font-semibold py-5 px-6 rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
          >
            <div className="flex items-center justify-center">
              {isLoggingIn ? (
                <Loader2 className="w-5 h-5 animate-spin mr-3" />
              ) : (
                <svg className="w-6 h-6 mr-4" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  />
                </svg>
              )}
              <span className="text-lg">
                {oauthLoading 
                  ? "Loading..." 
                  : !oauthConfigured
                    ? "Sign-in Unavailable" 
                    : isLoggingIn
                      ? "Signing you in..." 
                      : "Continue with Google"}
              </span>
            </div>
          </button>

          {/* Error Message */}
          {error && (
            <div className="mt-6 p-4 bg-red-50 border border-red-200 rounded-2xl animate-fade-in">
              <div className="flex items-center">
                <AlertCircle className="h-5 w-5 text-red-600 mr-3" />
                <p className="text-red-600 font-medium">{error}</p>
              </div>
            </div>
          )}

          <div className="mt-8 text-center">
            <p className="text-sm text-muted-foreground">
              By continuing, you agree to our{" "}
              <span className="text-primary font-medium">Terms</span> and{" "}
              <span className="text-primary font-medium">Privacy Policy</span>
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="text-center mt-8">
          <p className="text-white/60 text-sm">
            Join thousands of fantasy sports enthusiasts
          </p>
        </div>
      </div>
    </div>
  );
}
