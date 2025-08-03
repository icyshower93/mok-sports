import { useEffect } from 'react';
import { usePushNotifications } from '@/hooks/use-push-notifications';
import { useAuth } from '@/hooks/use-auth';

export function NotificationManager() {
  const { subscribe, permission, isSupported } = usePushNotifications();
  const { user } = useAuth();

  // Auto-subscribe when permission is granted and user is logged in
  useEffect(() => {
    if (permission === 'granted' && isSupported && user) {
      console.log('Auto-subscribing to push notifications...');
      subscribe();
    }
  }, [permission, isSupported, user, subscribe]);

  return null; // This component doesn't render anything
}