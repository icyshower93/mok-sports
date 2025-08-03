import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Bell, BellOff, CheckCircle, AlertCircle, RefreshCw } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export function NotificationSetup() {
  const [permissionStatus, setPermissionStatus] = useState<NotificationPermission>('default');
  const [isSupported, setIsSupported] = useState(false);
  const [subscriptionStatus, setSubscriptionStatus] = useState<'checking' | 'active' | 'inactive' | 'error'>('checking');
  const [isEnabling, setIsEnabling] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    checkNotificationSupport();
    checkSubscriptionStatus();
  }, []);

  const checkNotificationSupport = () => {
    const supported = 'Notification' in window && 'serviceWorker' in navigator && 'PushManager' in window;
    setIsSupported(supported);
    if (supported) {
      setPermissionStatus(Notification.permission);
    }
  };

  const checkSubscriptionStatus = async () => {
    try {
      const registration = await navigator.serviceWorker.getRegistration();
      if (registration) {
        const subscription = await registration.pushManager.getSubscription();
        setSubscriptionStatus(subscription ? 'active' : 'inactive');
      } else {
        setSubscriptionStatus('inactive');
      }
    } catch (error) {
      console.error('Error checking subscription status:', error);
      setSubscriptionStatus('error');
    }
  };

  const enableNotifications = async () => {
    if (!isSupported) {
      toast({
        title: "Not Supported",
        description: "Push notifications are not supported on this device",
        variant: "destructive"
      });
      return;
    }

    setIsEnabling(true);
    try {
      // Request permission
      const permission = await Notification.requestPermission();
      setPermissionStatus(permission);

      if (permission !== 'granted') {
        toast({
          title: "Permission Denied",
          description: "Please enable notifications in your browser settings",
          variant: "destructive"
        });
        return;
      }

      // Register service worker and create subscription
      const registration = await navigator.serviceWorker.register('/sw.js');
      await registration.update(); // Force update to get latest service worker

      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: 'BLC0EubNcXYeUBVgGslRhOO5lHxmgS2LLQKGPMcQ1Kj9-JFR1sTaYqlp-M8r2PsTVTGm8kFLfQZ_X_wJT3JJaOQ'
      });

      // Send subscription to server
      const response = await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(subscription)
      });

      if (!response.ok) {
        throw new Error('Failed to register push subscription with server');
      }

      setSubscriptionStatus('active');
      toast({
        title: "Notifications Enabled!",
        description: "You'll now receive push notifications for league updates",
      });

      // Test the notification
      setTimeout(() => {
        testNotification();
      }, 1000);

    } catch (error: any) {
      console.error('Error enabling notifications:', error);
      toast({
        title: "Setup Failed",
        description: error.message || "Failed to enable notifications",
        variant: "destructive"
      });
      setSubscriptionStatus('error');
    } finally {
      setIsEnabling(false);
    }
  };

  const testNotification = async () => {
    try {
      const response = await fetch('/api/push/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ 
          message: "Notifications are working! You'll get alerts when your leagues are ready for drafting." 
        })
      });

      if (!response.ok) {
        console.warn('Test notification failed, but setup should still work');
      }
    } catch (error) {
      console.warn('Test notification error:', error);
    }
  };

  const refreshStatus = () => {
    checkNotificationSupport();
    checkSubscriptionStatus();
  };

  const getStatusColor = () => {
    if (permissionStatus === 'granted' && subscriptionStatus === 'active') return 'success';
    if (permissionStatus === 'denied' || subscriptionStatus === 'error') return 'destructive';
    return 'secondary';
  };

  const getStatusText = () => {
    if (subscriptionStatus === 'checking') return 'Checking...';
    if (permissionStatus === 'denied') return 'Permission Denied';
    if (permissionStatus === 'granted' && subscriptionStatus === 'active') return 'Active';
    if (permissionStatus === 'granted' && subscriptionStatus === 'inactive') return 'Setup Required';
    return 'Disabled';
  };

  const getStatusIcon = () => {
    if (permissionStatus === 'granted' && subscriptionStatus === 'active') {
      return <CheckCircle className="h-4 w-4" />;
    }
    if (permissionStatus === 'denied' || subscriptionStatus === 'error') {
      return <AlertCircle className="h-4 w-4" />;
    }
    return <BellOff className="h-4 w-4" />;
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Bell className="h-5 w-5" />
              Push Notifications
            </CardTitle>
            <CardDescription>
              Get notified when your leagues are ready for drafting
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant={getStatusColor() as any} className="flex items-center gap-1">
              {getStatusIcon()}
              {getStatusText()}
            </Badge>
            <Button
              variant="ghost"
              size="sm"
              onClick={refreshStatus}
              disabled={subscriptionStatus === 'checking'}
            >
              <RefreshCw className={`h-4 w-4 ${subscriptionStatus === 'checking' ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {!isSupported && (
          <div className="p-4 bg-destructive/10 border border-destructive/20 rounded-lg">
            <p className="text-sm text-destructive">
              Push notifications are not supported on this device or browser.
            </p>
          </div>
        )}

        {isSupported && permissionStatus === 'denied' && (
          <div className="p-4 bg-destructive/10 border border-destructive/20 rounded-lg space-y-2">
            <p className="text-sm text-destructive font-medium">Notifications are blocked</p>
            <p className="text-xs text-destructive/80">
              Please enable notifications in your browser settings, then refresh this page.
            </p>
          </div>
        )}

        {isSupported && permissionStatus !== 'denied' && subscriptionStatus !== 'active' && (
          <div className="space-y-3">
            <div className="p-4 bg-muted rounded-lg">
              <p className="text-sm">
                Enable push notifications to get instant alerts when:
              </p>
              <ul className="text-xs mt-2 space-y-1 text-muted-foreground">
                <li>• Your league becomes full and ready for drafting</li>
                <li>• Draft schedules are announced</li>
                <li>• Important league updates happen</li>
              </ul>
            </div>
            <Button 
              onClick={enableNotifications} 
              disabled={isEnabling}
              className="w-full"
            >
              {isEnabling ? "Setting up..." : "Enable Notifications"}
            </Button>
          </div>
        )}

        {permissionStatus === 'granted' && subscriptionStatus === 'active' && (
          <div className="p-4 bg-success/10 border border-success/20 rounded-lg">
            <p className="text-sm text-success font-medium">Notifications are working!</p>
            <p className="text-xs text-success/80 mt-1">
              You'll receive push notifications for all league updates.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}