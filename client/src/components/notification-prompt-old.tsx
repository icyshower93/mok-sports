import { useState, useEffect } from 'react';
import { Bell, X, CheckCircle, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/features/auth/useAuth';

interface NotificationPromptProps {
  isProminent?: boolean;
  title?: string;
  description?: string;
  context?: 'post-login' | 'pre-draft' | 'general';
  onPermissionGranted?: () => void;
  onDismiss?: () => void;
}

export function NotificationPrompt({ 
  isProminent = false,
  title = "Enable Notifications",
  description = "Get real-time alerts about your league and draft!",
  context = 'general',
  onPermissionGranted,
  onDismiss 
  const [permission, setPermission] = useState<NotificationPermission>('default');
  const [isVisible, setIsVisible] = useState(false);
  const [isRequestingPermission, setIsRequestingPermission] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);
  const { user } = useAuth();
  const { toast } = useToast();

  // Context-specific messages
  const getContextualMessage = () => {
    switch (context) {
        return {
          title: "Welcome to Mok Sports! 🎉",
        };
        return {
          title: "Draft Starting Soon!",
        };
        return { title, description };
    }
  };

  useEffect(() => {
    if (!('Notification' in window)) {
      setIsVisible(false);
      return;
    }

    // Check current notification permission
    const currentPermission = Notification.permission;
    setPermission(currentPermission);
    
    // Check if user previously dismissed this context
    const dismissKey = `notification-prompt-dismissed-${context}${user?.id ? `-${user.id}` : ''}`;
    const dismissed = localStorage.getItem(dismissKey) === 'true';
    setIsDismissed(dismissed);
    
    // Show banner logic based on context and prominence
    let shouldShow = false;
    
    if (isProminent) {
      // Always show prominent banners unless permission is granted
      shouldShow = currentPermission !== 'granted';
    } else {
      shouldShow = currentPermission === 'default' && !dismissed;
    }
    
    setIsVisible(shouldShow);
    
      currentPermission, 
      dismissed, 
      isProminent, 
      context,
      shouldShow 
    });
  }, [isProminent, context, user?.id]);

  const requestPermission = async () => {
    if (!('Notification' in window)) {
      toast({
        title: "Notifications Not Supported",
        description: "Your browser doesn't support notifications.",
        variant: "destructive",
      });
      return;
    }

    setIsRequestingPermission(true);
    
    try {
      const permission = await Notification.requestPermission();
      
      setPermission(permission);
      
      if (permission === 'granted') {
        // Send a test welcome notification
        try {
          new Notification("Notifications Enabled!", {
            body: "You'll now receive real-time updates about your leagues and drafts.",
            icon: "/icon-192x192.png",
          });
        } catch (notificationError) {
        }

        toast({
          title: "Notifications Enabled!",
          description: "You'll now receive real-time updates about your leagues and drafts.",
        });
        
        setIsVisible(false);
        
        // Save permission granted state
        localStorage.setItem('notification-permission-granted', 'true');
        localStorage.setItem(`notification-granted-${user?.id || 'anonymous'}`, Date.now().toString());
        
        onPermissionGranted?.();
      } else if (permission === 'denied') {
        toast({
          title: "Notifications Blocked",
          description: "You can enable notifications later in your browser settings.",
          variant: "destructive",
        });
        setIsVisible(false);
        localStorage.setItem('notification-permission-denied', 'true');
      }
    } catch (error) {
      toast({
        title: "Permission Request Failed",
        description: "Unable to request notification permissions. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsRequestingPermission(false);
    }
  };

  const dismissBanner = () => {
    setIsVisible(false);
    
    // For non-prominent banners, save dismissal state
    if (!isProminent) {
      const dismissKey = `notification-prompt-dismissed-${context}${user?.id ? `-${user.id}` : ''}`;
      localStorage.setItem(dismissKey, 'true');
    }
    
    onDismiss?.();
  };

  // Don't show if not visible or permission already granted
  if (!isVisible) {
    return null;
  }

  // Show success state if permission granted and in prominent mode
  if (isProminent && permission === 'granted') {
    return (
      <Card className="border-green-200 bg-green-50 shadow-md mb-4">
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <CheckCircle className="h-5 w-5 text-green-600" />
            <div className="flex-1">
              <h3 className="font-semibold text-green-800">
                Notifications Enabled!
              </h3>
              <p className="text-sm text-green-700">
                You'll receive real-time updates about your leagues and drafts.
              </p>
            </div>
            <Button
              onClick={dismissBanner}
              variant="ghost"
              size="sm"
              className="p-1 h-auto"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  const { title: contextTitle, description: contextDescription } = getContextualMessage();
  const bannerClass = isProminent 
    ? "border-fantasy-green bg-fantasy-green/10 shadow-lg mb-4" 
    : "border-fantasy-green/20 bg-fantasy-green/5 shadow-md mb-4";

  return (
    <Card className={bannerClass}>
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <Bell className="h-5 w-5 text-fantasy-green mt-0.5 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-foreground mb-1">
              {contextTitle}
            </h3>
            <p className="text-sm text-muted-foreground mb-3">
              {contextDescription} Stay updated on draft picks, league announcements, and important game updates.
            </p>
            <div className="flex gap-2">
              <Button 
                onClick={requestPermission}
                disabled={isRequestingPermission}
                size="sm"
              >
              </Button>
              <Button 
                onClick={dismissBanner}
                variant="outline"
                size="sm"
              >
                Maybe Later
              </Button>
            </div>
          </div>
          <Button
            onClick={dismissBanner}
            variant="ghost"
            size="sm"
            className="p-1 h-auto flex-shrink-0"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// Hook to check if notifications should be prompted at critical moments
export function useNotificationReminder() {
  const { user } = useAuth();
  const [shouldShowReminder, setShouldShowReminder] = useState(false);

    if (!('Notification' in window) || Notification.permission === 'granted') {
      return false;
    }

    // Check if user has dismissed reminders recently
    const reminderKey = `notification-reminder-${context}-${user?.id || 'anonymous'}`;
    const lastDismissed = localStorage.getItem(reminderKey);
    
    if (lastDismissed) {
      const daysSinceDismissed = (Date.now() - parseInt(lastDismissed)) / (1000 * 60 * 60 * 24);
      // Don't show reminder if dismissed within last 3 days
      if (daysSinceDismissed < 3) {
        return false;
      }
    }

    return Notification.permission === 'default';
  };

    const reminderKey = `notification-reminder-${context}-${user?.id || 'anonymous'}`;
    localStorage.setItem(reminderKey, Date.now().toString());
    setShouldShowReminder(false);
  };

  return {
    shouldShowReminder: shouldShowReminder && checkIfReminderNeeded(),
    checkIfReminderNeeded,
    dismissReminder
  };
}