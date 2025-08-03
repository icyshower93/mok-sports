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
}

export function NotificationPrompt({ 
  className, 
  onPermissionGranted,
  onDismiss 
}: NotificationPromptProps) {
  const [permission, setPermission] = useState<NotificationPermission>('default');
  const [isVisible, setIsVisible] = useState(false);
  const [isRequestingPermission, setIsRequestingPermission] = useState(false);
  const { user } = useAuth();

  useEffect(() => {
    if ('Notification' in window) {
      setPermission(Notification.permission);
      // Show prompt when user is logged in and permission is default
      setIsVisible(Boolean(user && Notification.permission === 'default'));
    }
  }, [user]);

  const requestPermission = async () => {
    if (!('Notification' in window)) {
      return;
    }

    setIsRequestingPermission(true);
    
    try {
      const result = await Notification.requestPermission();
      setPermission(result);
      
      if (result === 'granted') {
        onPermissionGranted?.();
        setIsVisible(false);
      }
    } catch (error) {
      console.error('Error requesting notification permission:', error);
    } finally {
      setIsRequestingPermission(false);
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
          <CardTitle className="text-base">Stay Updated</CardTitle>
        </div>
        <CardDescription>
          Get notified about draft starts, trades, and league updates
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