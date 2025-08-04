import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Bell, X, CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/use-auth';

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

  useEffect(() => {
    if ('Notification' in window) {
      setPermission(Notification.permission);
      // Show prompt when user is logged in and permission is default or denied (if forceShow)
      setIsVisible(Boolean(user && (Notification.permission === 'default' || (forceShow && Notification.permission === 'denied'))));
    }
  }, [user, forceShow]);

  const requestPermission = async () => {
    console.warn('[CRITICAL DEBUG] NotificationPrompt: requestPermission called - REDEPLOYED VERSION');
    if (!('Notification' in window)) {
      console.warn('[CRITICAL DEBUG] NotificationPrompt: Notifications not supported');
      return;
    }

    setIsRequestingPermission(true);
    console.warn('[CRITICAL DEBUG] NotificationPrompt: Requesting permission...');
    
    try {
      const result = await Notification.requestPermission();
      console.warn('[CRITICAL DEBUG] NotificationPrompt: Permission result:', result);
      setPermission(result);
      
      if (result === 'granted') {
        console.warn('[CRITICAL DEBUG] NotificationPrompt: Permission granted, calling onPermissionGranted');
        onPermissionGranted?.();
        setIsVisible(false);
        
        // CRITICAL: Create the actual push subscription since NotificationPrompt doesn't do it
        console.warn('[CRITICAL DEBUG] NotificationPrompt: Now creating push subscription...');
        await createPushSubscriptionForPrompt();
      }
    } catch (error) {
      console.error('Error requesting notification permission:', error);
    } finally {
      setIsRequestingPermission(false);
    }
  };

  // Create push subscription for NotificationPrompt (since it wasn't creating them)
  const createPushSubscriptionForPrompt = async () => {
    try {
      console.warn('[CRITICAL DEBUG] Creating push subscription via NotificationPrompt...');
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
        console.warn('[CRITICAL DEBUG] Push subscription created successfully via NotificationPrompt!');
      } else {
        console.error('[CRITICAL DEBUG] Failed to save push subscription:', await response.text());
      }
      
    } catch (error) {
      console.error('[CRITICAL DEBUG] Failed to create push subscription:', error);
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