import { useState, useCallback } from 'react';

interface NotificationReminderState {
  shouldShowReminder: boolean;
  lastDismissedAt: string | null;
}

export function useNotificationReminder() {
  const [state, setState] = useState<NotificationReminderState>({
    shouldShowReminder: false,
    lastDismissedAt: null
  });

  const checkIfReminderNeeded = useCallback(() => {
    // Show reminder if notifications are not granted and haven't been dismissed recently
    const needsReminder = Notification.permission !== 'granted';
    const lastDismissed = localStorage.getItem('notification-reminder-dismissed');
    
    if (needsReminder && lastDismissed) {
      const dismissedTime = new Date(lastDismissed);
      const now = new Date();
      const hoursSinceDismissed = (now.getTime() - dismissedTime.getTime()) / (1000 * 60 * 60);
      
      // Don't show reminder if dismissed within last 24 hours
      if (hoursSinceDismissed < 24) {
        setState(prev => ({ ...prev, shouldShowReminder: false }));
        return;
      }
    }
    
    setState(prev => ({ 
      ...prev, 
      shouldShowReminder: needsReminder,
      lastDismissedAt: lastDismissed
    }));
  }, []);

  const dismissReminder = useCallback(() => {
    const now = new Date().toISOString();
    localStorage.setItem('notification-reminder-dismissed', now);
    setState(prev => ({ 
      ...prev, 
      shouldShowReminder: false,
      lastDismissedAt: now
    }));
  }, []);

  return {
    ...state,
    checkIfReminderNeeded,
    dismissReminder
  };
}