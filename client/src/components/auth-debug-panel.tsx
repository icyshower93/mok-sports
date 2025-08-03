import { useAuth } from '@/hooks/use-auth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Info, CheckCircle, XCircle, RefreshCw } from 'lucide-react';
import { useState, useEffect } from 'react';

export function AuthDebugPanel() {
  const { user, isAuthenticated, isLoading, oauthConfigured } = useAuth();
  const [urlParams, setUrlParams] = useState<{ [key: string]: string | null }>({});
  const [currentURL, setCurrentURL] = useState('');

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setUrlParams({
      auth: params.get('auth'),
      error: params.get('error'),
    });
    setCurrentURL(window.location.href);
  }, []);

  const getStatusIcon = (condition: boolean) => {
    return condition ? 
      <CheckCircle className="w-4 h-4 text-green-500" /> : 
      <XCircle className="w-4 h-4 text-red-500" />;
  };

  const getStatusBadge = (condition: boolean, trueText: string, falseText: string) => {
    return (
      <Badge variant={condition ? "default" : "destructive"} className="text-xs">
        {condition ? trueText : falseText}
      </Badge>
    );
  };

  const refreshAuth = () => {
    window.location.reload();
  };

  return (
    <div className="fixed bottom-4 right-4 w-80 z-50">
      <Card className="border-orange-500">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-sm">
            <Info className="w-4 h-4" />
            Auth Debug Panel
          </CardTitle>
          <CardDescription className="text-xs">
            Real-time authentication status
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-xs">
          <div className="grid grid-cols-1 gap-2">
            <div className="flex items-center justify-between">
              <span>Loading:</span>
              <div className="flex items-center gap-1">
                {isLoading && <RefreshCw className="w-4 h-4 animate-spin" />}
                {getStatusBadge(isLoading, "Loading", "Ready")}
              </div>
            </div>

            <div className="flex items-center justify-between">
              <span>OAuth Config:</span>
              <div className="flex items-center gap-1">
                {getStatusIcon(oauthConfigured)}
                {getStatusBadge(oauthConfigured, "Ready", "Missing")}
              </div>
            </div>

            <div className="flex items-center justify-between">
              <span>User Data:</span>
              <div className="flex items-center gap-1">
                {getStatusIcon(!!user)}
                {getStatusBadge(!!user, "Present", "Missing")}
              </div>
            </div>

            <div className="flex items-center justify-between">
              <span>Authenticated:</span>
              <div className="flex items-center gap-1">
                {getStatusIcon(isAuthenticated)}
                {getStatusBadge(isAuthenticated, "Yes", "No")}
              </div>
            </div>
          </div>

          {user && (
            <Alert>
              <CheckCircle className="w-4 h-4" />
              <AlertDescription className="text-xs">
                <strong>User:</strong> {user.name} ({user.email})
              </AlertDescription>
            </Alert>
          )}

          <div className="space-y-1">
            <div className="text-xs font-medium">URL Parameters:</div>
            <div className="bg-muted p-2 rounded text-xs">
              {Object.entries(urlParams).map(([key, value]) => (
                <div key={key}>
                  <strong>{key}:</strong> {value || 'null'}
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-1">
            <div className="text-xs font-medium">Current URL:</div>
            <div className="bg-muted p-2 rounded text-xs break-all">
              {currentURL}
            </div>
          </div>

          <Button 
            onClick={refreshAuth} 
            size="sm" 
            className="w-full"
            variant="outline"
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh Auth
          </Button>

          {!isAuthenticated && !isLoading && (
            <Alert>
              <XCircle className="w-4 h-4" />
              <AlertDescription className="text-xs">
                Not authenticated. Try logging in again.
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>
    </div>
  );
}