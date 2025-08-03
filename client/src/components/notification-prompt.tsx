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
    <Card className={cn("relative border-2 border-fantasy-green/20 bg-gradient-to-br from-fantasy-green/5 to-accent/5 backdrop-blur-sm shadow-lg", className)}>
      <Button
        variant="ghost"
        size="icon"
        className="absolute right-2 top-2 h-6 w-6 hover:bg-destructive/20"
        onClick={handleDismiss}
      >
        <X className="h-4 w-4" />
      </Button>
      <CardHeader className="pb-3">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-full bg-fantasy-green/20">
            <Bell className="h-5 w-5 text-fantasy-green" />
          </div>
          <CardTitle className="text-lg font-bold">Stay in the Game</CardTitle>
        </div>
        <CardDescription className="text-base">
          Get real-time alerts for draft starts, trades, and league updates. Never miss the action!
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-0">
        <Button 
          onClick={requestPermission} 
          disabled={isRequestingPermission}
          className="w-full h-12 font-semibold bg-fantasy-green hover:bg-fantasy-green/90 text-white shadow-md hover:shadow-lg transition-all duration-200"
          size="sm"
        >
          {isRequestingPermission ? (
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              Requesting...
            </div>
          ) : (
            <>
              <CheckCircle2 className="w-5 h-5 mr-2" />
              Enable Notifications
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
}