import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Bell, X, Clock, Users } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/use-auth';
import { useNotificationReminder } from '@/hooks/use-notification-reminder';

interface DraftNotificationReminderProps {
  className?: string;
  leagueName?: string;
  showAlways?: boolean;
}

export function DraftNotificationReminder({ 
  className, 
  leagueName,
  showAlways = false 
}: DraftNotificationReminderProps) {
  const { user } = useAuth();
  const { shouldShowReminder, checkIfReminderNeeded, dismissReminder } = useNotificationReminder();
  const [shouldShow, setShouldShow] = useState(false);

  useEffect(() => {
    if (showAlways) {
      setShouldShow(true);
    } else if (user) {
      checkIfReminderNeeded();
      setShouldShow(shouldShowReminder);
    }
  }, [user, shouldShowReminder, showAlways, checkIfReminderNeeded]);

  const handleEnableNotifications = async () => {
    if ('Notification' in window) {
      const permission = await Notification.requestPermission();
      if (permission === 'granted') {
        dismissReminder();
        setShouldShow(false);
      }
    }
  };

  const handleDismiss = () => {
    dismissReminder();
    setShouldShow(false);
  };

  if (!shouldShow || Notification.permission === 'granted') {
    return null;
  }

  return (
    <Card className={cn("border-orange-200 bg-orange-50 dark:border-orange-800 dark:bg-orange-950/30", className)}>
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
          <div className="p-1 rounded-full bg-orange-100 dark:bg-orange-900">
            <Clock className="h-4 w-4 text-orange-600 dark:text-orange-400" />
          </div>
          <CardTitle className="text-base text-orange-800 dark:text-orange-200">
            Draft Starting Soon
          </CardTitle>
        </div>
        <CardDescription className="text-orange-700 dark:text-orange-300">
          {leagueName ? `${leagueName} draft` : 'Your draft'} will begin shortly. Enable notifications so you don't miss it!
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="flex gap-2">
          <Button 
            onClick={handleEnableNotifications}
            size="sm"
            className="flex-1"
          >
            <Bell className="w-4 h-4 mr-2" />
            Enable Notifications
          </Button>
          <Button 
            variant="outline"
            size="sm"
            onClick={handleDismiss}
          >
            Later
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}