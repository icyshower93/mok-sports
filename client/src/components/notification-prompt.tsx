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
    <div className={cn(
      "fantasy-card p-6 relative animate-fade-in",
      className
    )}>
      <Button
        variant="ghost"
        size="icon"
        className="absolute right-3 top-3 h-8 w-8 text-muted-foreground hover:text-foreground"
        onClick={handleDismiss}
      >
        <X className="h-4 w-4" />
      </Button>
      
      <div className="flex items-start space-x-4">
        <div className="flex-shrink-0">
          <div className="flex items-center justify-center w-12 h-12 bg-primary/10 rounded-2xl">
            <Bell className="w-6 h-6 text-primary" />
          </div>
        </div>
        
        <div className="flex-1 min-w-0">
          <h3 className="text-lg font-semibold text-foreground mb-1">
            Never Miss the Action
          </h3>
          <p className="text-muted-foreground text-sm mb-4">
            Get alerts for draft starts, trades, and league updates
          </p>
          
          <Button 
            onClick={requestPermission} 
            disabled={isRequestingPermission}
            className="btn-fantasy-secondary text-sm px-4 py-2"
            size="sm"
          >
            {isRequestingPermission ? (
              'Enabling...'
            ) : (
              <>
                <CheckCircle2 className="w-4 h-4 mr-2" />
                Enable Notifications
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}