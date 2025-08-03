import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Bell, X, CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/use-auth';

interface NotificationBannerProps {
  className?: string;
  onPermissionGranted?: () => void;
  onDismiss?: () => void;
}

export function NotificationBanner({ 
  className, 
  onPermissionGranted,
  onDismiss 
}: NotificationBannerProps) {
  const [permission, setPermission] = useState<NotificationPermission>('default');
  const [isVisible, setIsVisible] = useState(false);
  const [isRequestingPermission, setIsRequestingPermission] = useState(false);
  const { user } = useAuth();

  useEffect(() => {
    if ('Notification' in window) {
      setPermission(Notification.permission);
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
      "fantasy-card p-6 bg-gradient-to-r from-fantasy-primary to-fantasy-purple text-white animate-slide-up",
      className
    )}>
      <Button
        variant="ghost"
        size="icon"
        className="absolute right-3 top-3 h-8 w-8 text-white hover:bg-white/20"
        onClick={handleDismiss}
      >
        <X className="h-4 w-4" />
      </Button>
      
      <div className="flex items-start space-x-4">
        <div className="flex-shrink-0">
          <div className="flex items-center justify-center w-12 h-12 bg-white/20 rounded-2xl">
            <Bell className="w-6 h-6 text-white" />
          </div>
        </div>
        
        <div className="flex-1 min-w-0">
          <h3 className="text-lg font-semibold text-white mb-1">
            Stay in the Game! 🏈
          </h3>
          <p className="text-white/90 text-sm mb-4">
            Get instant alerts for draft starts, trades, and league updates so you never miss the action.
          </p>
          
          <Button 
            onClick={requestPermission} 
            disabled={isRequestingPermission}
            className="bg-white text-fantasy-primary hover:bg-white/90 font-medium px-6 py-2 rounded-xl transition-all duration-300"
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