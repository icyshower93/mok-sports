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
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20 flex items-center justify-center p-4 relative overflow-hidden">
      {/* Animated background elements */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_var(--fantasy-success)_0%,_transparent_50%)] opacity-10" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_bottom_left,_var(--fantasy-accent)_0%,_transparent_50%)] opacity-10" />
      
      <div className="w-full max-w-md relative z-10">
        {/* Brand Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-24 h-24 bg-gradient-to-br from-fantasy-green to-accent rounded-3xl shadow-2xl mb-6 relative">
            <Trophy className="w-10 h-10 text-white" />
            <div className="absolute -inset-1 bg-gradient-to-br from-fantasy-green to-accent rounded-3xl blur opacity-30 animate-pulse"></div>
          </div>
          <h1 className="text-5xl font-bold bg-gradient-to-r from-fantasy-green to-accent text-transparent bg-clip-text mb-3">
            Mok Sports
          </h1>
          <p className="text-xl text-muted-foreground font-medium">Fantasy Sports Reimagined</p>
          <p className="text-muted-foreground/70 text-sm mt-2">Draft teams, not players</p>
        </div>

        {/* Auth Card */}
        <Card className="shadow-2xl border-2 border-border/50 bg-card/95 backdrop-blur-sm">
          <CardContent className="p-8">
            <div className="text-center mb-8">
              <h2 className="text-2xl font-bold text-foreground mb-3">
                Welcome Back
              </h2>
              <p className="text-muted-foreground text-lg">Sign in to start dominating</p>
            </div>

            {/* Google Auth Button */}
            <Button
              onClick={handleGoogleLogin}
              disabled={isLoading || isLoggingIn || oauthLoading || !oauthConfigured}
              variant="outline"
              className="w-full h-14 text-lg font-bold border-2 border-border hover:border-fantasy-green hover:bg-fantasy-green/5 transition-all duration-300 ease-out hover:scale-105 shadow-lg hover:shadow-xl"
            >
              {isLoggingIn ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : (
                <svg className="w-5 h-5 mr-3" viewBox="0 0 24 24">
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
              {oauthLoading 
                ? "Loading..." 
                : !oauthConfigured
                  ? "Sign-in Unavailable" 
                  : isLoggingIn
                    ? "Signing you in..." 
                    : "Continue with Google"}
            </Button>

            {/* Error Message */}
            {error && (
              <Alert variant="destructive" className="mt-4">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <div className="mt-6 text-center">
              <p className="text-xs text-muted-foreground">
                By continuing, you agree to our Terms and Privacy Policy
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
