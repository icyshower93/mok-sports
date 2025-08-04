import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Bell, X, CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/use-auth';
import { usePWADebug } from '@/hooks/use-pwa-debug';

interface NotificationPromptProps {
  className?: string;
  onPermissionGranted?: () => void;
  onDismiss?: () => void;
  forceShow?: boolean; // Allow showing even when permission is denied
}

export function NotificationPrompt({ 
  className, 
  onPermissionGranted,
  onDismiss,
  forceShow = false
}: NotificationPromptProps) {
  const [permission, setPermission] = useState<NotificationPermission>('default');
  const [isVisible, setIsVisible] = useState(false);
  const [isRequestingPermission, setIsRequestingPermission] = useState(false);
  const { user } = useAuth();
  const { addLog, logSubscriptionCreation, logSubscriptionPost } = usePWADebug();

  useEffect(() => {
    if ('Notification' in window) {
      setPermission(Notification.permission);
      // Show prompt when user is logged in and permission is default or denied (if forceShow)
      setIsVisible(Boolean(user && (Notification.permission === 'default' || (forceShow && Notification.permission === 'denied'))));
    }
  }, [user, forceShow]);

  const requestPermission = async () => {
    addLog('NotificationPrompt: requestPermission called');
    if (!('Notification' in window)) {
      addLog('Notifications not supported in this browser');
      return;
    }

    setIsRequestingPermission(true);
    addLog('Requesting notification permission...');
    
    try {
      const result = await Notification.requestPermission();
      addLog(`Permission result: ${result}`);
      setPermission(result);
      
      if (result === 'granted') {
        addLog('Permission granted - creating push subscription...');
        onPermissionGranted?.();
        setIsVisible(false);
        
        // Create the actual push subscription
        await createPushSubscriptionForPrompt();
      } else {
        addLog(`Permission ${result} - no subscription created`);
      }
    } catch (error) {
      console.error('Error requesting notification permission:', error);
    } finally {
      setIsRequestingPermission(false);
    }
  };

  const createPushSubscriptionForPrompt = async () => {
    try {
      addLog('Creating push subscription...');
      const registration = await navigator.serviceWorker.getRegistration();
      if (!registration) {
        throw new Error('Service worker not registered');
      }

      // Get VAPID key from server
      const vapidResponse = await fetch('/api/push/vapid-key');
      const { publicKey } = await vapidResponse.json();

      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: publicKey
      });

      logSubscriptionCreation(true, { endpoint: subscription.endpoint });

      // Send subscription to server
      const response = await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          endpoint: subscription.endpoint,
          keys: {
            p256dh: btoa(String.fromCharCode.apply(null, Array.from(new Uint8Array(subscription.getKey('p256dh')!)))),
            auth: btoa(String.fromCharCode.apply(null, Array.from(new Uint8Array(subscription.getKey('auth')!))))
          }
        })
      });

      if (response.ok) {
        const result = await response.json();
        logSubscriptionPost(true, result);
      } else {
        const error = await response.text();
        logSubscriptionPost(false, { error });
      }
      
    } catch (error) {
      logSubscriptionCreation(false, { error: error instanceof Error ? error.message : 'Unknown error' });
    }
  };

  const handleDismiss = () => {
    setIsVisible(false);
    onDismiss?.();
  };

  if (!isVisible || permission === 'granted') {
    return null;
  }

  return (
    <Card className={cn("relative", className)}>
      <Button
        variant="ghost"
        size="icon"
        className="absolute right-2 top-2 h-6 w-6"
        onClick={handleDismiss}
      >
        <X className="h-4 w-4" />
      </Button>
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <Bell className="h-5 w-5 text-fantasy-green" />
          <CardTitle className="text-base">
            {permission === 'denied' ? 'Enable Notifications' : 'Stay Updated'}
          </CardTitle>
        </div>
        <CardDescription>
          {permission === 'denied' 
            ? 'You previously blocked notifications. Click to enable updates about draft starts, trades, and league activity.'
            : 'Get notified about draft starts, trades, and league updates'
          }
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-0">
        <Button 
          onClick={requestPermission} 
          disabled={isRequestingPermission}
          className="w-full"
          size="sm"
        >
          {isRequestingPermission ? (
            'Requesting...'
          ) : (
            <>
              <CheckCircle2 className="w-4 h-4 mr-2" />
              Enable Notifications
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
}