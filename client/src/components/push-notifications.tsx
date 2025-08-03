import { useState } from 'react';
import { usePushNotifications } from '@/hooks/use-push-notifications';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Bell, BellOff, Check, X, AlertCircle, Smartphone, Plus, Share } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { IOSDebugPanel } from './ios-debug-panel';

export function PushNotificationCard() {
  const {
    isSupported,
    permission,
    isSubscribed,
    isLoading,
    error,
    isIOS,
    isIOSPWA,
    needsPWAInstall,
    requestPermission,
    subscribe,
    unsubscribe,
    sendTestNotification,
  } = usePushNotifications();
  
  const { toast } = useToast();
  const [isTestingNotifications, setIsTestingNotifications] = useState(false);

  const handleRequestPermission = async () => {
    await requestPermission();
    if (permission === 'granted') {
      toast({
        title: "Permission Granted",
        description: "You can now subscribe to push notifications.",
      });
    }
  };

  const handleSubscribe = async () => {
    await subscribe();
    if (isSubscribed) {
      toast({
        title: "Subscribed Successfully",
        description: "You'll now receive push notifications for important league events.",
      });
    }
  };

  const handleUnsubscribe = async () => {
    await unsubscribe();
    toast({
      title: "Unsubscribed",
      description: "You'll no longer receive push notifications.",
    });
  };

  const handleTestNotification = async () => {
    setIsTestingNotifications(true);
    await sendTestNotification();
    setIsTestingNotifications(false);
    
    if (!error) {
      toast({
        title: "Test Notification Sent",
        description: "Check your device for the test notification.",
      });
    }
  };

  // Show iOS PWA installation instructions
  if (needsPWAInstall) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Smartphone className="w-5 h-5" />
            Enable Push Notifications (iOS)
          </CardTitle>
          <CardDescription>
            Follow these steps to enable notifications on your iPhone
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert>
            <AlertCircle className="w-4 h-4" />
            <AlertDescription>
              Push notifications on iOS require the app to be installed to your home screen first.
            </AlertDescription>
          </Alert>
          
          <div className="space-y-3">
            <div className="flex items-start gap-3">
              <div className="w-6 h-6 bg-primary/10 rounded-full flex items-center justify-center text-sm font-medium">
                1
              </div>
              <div>
                <p className="font-medium">Tap the Share button</p>
                <p className="text-sm text-muted-foreground">Look for the <Share className="w-4 h-4 inline mx-1" /> icon in Safari's toolbar</p>
              </div>
            </div>
            
            <div className="flex items-start gap-3">
              <div className="w-6 h-6 bg-primary/10 rounded-full flex items-center justify-center text-sm font-medium">
                2
              </div>
              <div>
                <p className="font-medium">Select "Add to Home Screen"</p>
                <p className="text-sm text-muted-foreground">Scroll down in the share menu and tap <Plus className="w-4 h-4 inline mx-1" /> "Add to Home Screen"</p>
              </div>
            </div>
            
            <div className="flex items-start gap-3">
              <div className="w-6 h-6 bg-primary/10 rounded-full flex items-center justify-center text-sm font-medium">
                3
              </div>
              <div>
                <p className="font-medium">Open from home screen</p>
                <p className="text-sm text-muted-foreground">Tap the app icon on your home screen (not Safari)</p>
              </div>
            </div>
            
            <div className="flex items-start gap-3">
              <div className="w-6 h-6 bg-primary/10 rounded-full flex items-center justify-center text-sm font-medium">
                4
              </div>
              <div>
                <p className="font-medium">Enable notifications</p>
                <p className="text-sm text-muted-foreground">Return to this section and tap "Request Permission"</p>
              </div>
            </div>
          </div>
          
          <Alert>
            <Bell className="w-4 h-4" />
            <AlertDescription>
              This only needs to be done once. Once installed, notifications will work normally.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  if (!isSupported) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BellOff className="w-5 h-5" />
            Push Notifications
          </CardTitle>
          <CardDescription>
            Push notifications are not supported on this device or browser.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              To enable push notifications:
              <br />• Use a modern browser (Chrome, Firefox, Safari)
              <br />• For iOS: Add this app to your home screen first
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  const getPermissionBadge = () => {
    switch (permission) {
      case 'granted':
        return <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">Granted</Badge>;
      case 'denied':
        return <Badge variant="destructive">Denied</Badge>;
      default:
        return <Badge variant="secondary">Not Requested</Badge>;
    }
  };

  const getSubscriptionBadge = () => {
    if (isSubscribed) {
      return <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">Active</Badge>;
    }
    return <Badge variant="outline">Inactive</Badge>;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Bell className="w-5 h-5" />
          Push Notifications
          {isSubscribed && <Check className="w-4 h-4 text-green-500" />}
        </CardTitle>
        <CardDescription>
          Get notified when drafts start, trades happen, and other important league events.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Status Information */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Permission Status:</span>
            {getPermissionBadge()}
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Subscription Status:</span>
            {getSubscriptionBadge()}
          </div>
        </div>

        {/* Error Display */}
        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* iOS Instructions */}
        {(navigator.userAgent.includes('iPhone') || navigator.userAgent.includes('iPad')) && (
          <Alert>
            <Smartphone className="h-4 w-4" />
            <AlertDescription>
              <strong>iOS Users:</strong> To enable push notifications, first add this app to your home screen:
              <br />1. Tap the share button in Safari
              <br />2. Select "Add to Home Screen"
              <br />3. Open the app from your home screen
              <br />4. Then enable notifications below
            </AlertDescription>
          </Alert>
        )}

        {/* Action Buttons */}
        <div className="space-y-2">
          {permission === 'default' && (
            <Button 
              onClick={handleRequestPermission}
              disabled={isLoading}
              className="w-full"
            >
              {isLoading ? 'Requesting...' : 'Request Permission'}
            </Button>
          )}

          {permission === 'granted' && !isSubscribed && (
            <Button 
              onClick={handleSubscribe}
              disabled={isLoading}
              className="w-full bg-fantasy-green hover:bg-fantasy-green/90"
            >
              {isLoading ? 'Subscribing...' : 'Enable Notifications'}
            </Button>
          )}

          {permission === 'granted' && isSubscribed && (
            <>
              <Button 
                onClick={handleTestNotification}
                disabled={isLoading || isTestingNotifications}
                variant="outline"
                className="w-full"
              >
                {isTestingNotifications ? 'Sending Test...' : 'Send Test Notification'}
              </Button>
              <Button 
                onClick={handleUnsubscribe}
                disabled={isLoading}
                variant="destructive"
                className="w-full"
              >
                {isLoading ? 'Unsubscribing...' : 'Disable Notifications'}
              </Button>
            </>
          )}

          {permission === 'denied' && (
            <Alert>
              <X className="h-4 w-4" />
              <AlertDescription>
                Notifications are blocked. To enable them:
                <br />• Click the lock icon in your browser's address bar
                <br />• Allow notifications for this site
                <br />• Refresh the page
              </AlertDescription>
            </Alert>
          )}
        </div>

        {/* Information */}
        <div className="text-xs text-muted-foreground space-y-1">
          <p>• You'll get notified when drafts start</p>
          <p>• League invitations and updates</p>
          <p>• Trade proposals and completions</p>
          <p>• You can disable these anytime</p>
        </div>

        {/* iOS Debug Panel */}
        {isIOS && (
          <IOSDebugPanel
            isIOS={isIOS}
            isIOSPWA={isIOSPWA}
            needsPWAInstall={needsPWAInstall}
            isSupported={isSupported}
            permission={permission}
          />
        )}
      </CardContent>
    </Card>
  );
}