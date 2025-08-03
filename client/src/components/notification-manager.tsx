import { useEffect } from 'react';
import { usePushNotifications } from '@/hooks/use-push-notifications';

export function NotificationManager() {
  const { requestPermission, subscribe, permission, isSupported } = usePushNotifications();

  // Auto-subscribe when permission is granted
  useEffect(() => {
    if (permission === 'granted' && isSupported) {
      subscribe();
    }
  }, [permission, isSupported, subscribe]);

  return null; // This component doesn't render anything
}