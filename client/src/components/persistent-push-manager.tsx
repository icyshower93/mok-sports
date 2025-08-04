import { useEffect } from 'react';
import { usePersistentPushSubscription } from '@/hooks/use-persistent-push-subscription';
import { useAuth } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Bell, BellOff, RefreshCw, AlertTriangle } from 'lucide-react';

interface PersistentPushManagerProps {
  showManualControls?: boolean;
}

export function PersistentPushManager({ showManualControls = false }: PersistentPushManagerProps) {
  const { user } = useAuth();
  const { state, requestPermissionAndSubscribe, unsubscribe, refreshSubscription } = usePersistentPushSubscription();

  const {
    subscription,
    permission,
    isLoading,
    error,
    isSupported
  } = state;

  // Auto-request permission on first load if user is authenticated and permission is default
  useEffect(() => {
    if (user && permission === 'default' && isSupported && !isLoading) {
      console.log('[Persistent Push] Auto-requesting permission for new user');
      requestPermissionAndSubscribe();
    }
  }, [user, permission, isSupported, isLoading, requestPermissionAndSubscribe]);

  if (!user || !isSupported) {
    return null;
  }

  if (!showManualControls) {
    // Silent background operation mode
    return null;
  }

  const getStatusBadge = () => {
    if (isLoading) {
      return <Badge variant="secondary">Loading...</Badge>;
    }
    
    if (error) {
      return <Badge variant="destructive">Error</Badge>;
    }
    
    if (subscription) {
      return <Badge variant="default" className="bg-green-500">Active</Badge>;
    }
    
    if (permission === 'denied') {
      return <Badge variant="destructive">Denied</Badge>;
    }
    
    if (permission === 'default') {
      return <Badge variant="secondary">Not Requested</Badge>;
    }
    
    return <Badge variant="outline">No Subscription</Badge>;
  };

  const getActionButton = () => {
    if (isLoading) {
      return (
        <Button disabled variant="outline">
          <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
          Processing...
        </Button>
      );
    }

    if (subscription) {
      return (
        <div className="flex gap-2">
          <Button onClick={refreshSubscription} variant="outline" size="sm">
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Button onClick={unsubscribe} variant="outline" size="sm">
            <BellOff className="h-4 w-4 mr-2" />
            Disable
          </Button>
        </div>
      );
    }

    if (permission === 'denied') {
      return (
        <div className="text-sm text-muted-foreground">
          <AlertTriangle className="h-4 w-4 inline mr-1" />
          Enable notifications in browser settings
        </div>
      );
    }

    return (
      <Button onClick={requestPermissionAndSubscribe} variant="outline" size="sm">
        <Bell className="h-4 w-4 mr-2" />
        Enable Notifications
      </Button>
    );
  };

  return (
    <Card className="w-full">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium flex items-center justify-between">
          Push Notifications
          {getStatusBadge()}
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="space-y-3">
          <div className="text-xs text-muted-foreground">
            {subscription && (
              <div>
                <div>Endpoint: {subscription.endpoint.substring(0, 40)}...</div>
                <div>Permission: {permission}</div>
              </div>
            )}
            {!subscription && permission === 'granted' && (
              <div>Permission granted but no active subscription</div>
            )}
            {permission === 'default' && (
              <div>Notification permission not yet requested</div>
            )}
            {permission === 'denied' && (
              <div>Notifications blocked. Enable in browser settings.</div>
            )}
          </div>

          {error && (
            <div className="text-xs text-red-500 bg-red-50 p-2 rounded">
              Error: {error}
            </div>
          )}

          <div className="flex justify-end">
            {getActionButton()}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}