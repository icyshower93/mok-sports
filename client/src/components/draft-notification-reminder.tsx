import { useState, useEffect } from 'react';
import { Clock, Bell } from 'lucide-react';
import { NotificationPrompt, useNotificationReminder } from './notification-prompt';
import { useAuth } from '@/hooks/use-auth';

interface DraftNotificationReminderProps {
  draftStartTime?: string | Date;
  leagueName: string;
  showAlways?: boolean; // For testing
}

export function DraftNotificationReminder({ 
  draftStartTime, 
  leagueName,
  showAlways = false 
}: DraftNotificationReminderProps) {
  const { user } = useAuth();
  const { shouldShowReminder, checkIfReminderNeeded, dismissReminder } = useNotificationReminder();
  const [shouldShow, setShouldShow] = useState(false);

  useEffect(() => {
    if (showAlways) {
      setShouldShow(true);
      return;
    }

    // Check if we should show the reminder based on various conditions
    const permission = Notification.permission;
    
    // Don't show if notifications already enabled
    if (permission === 'granted') {
      setShouldShow(false);
      return;
    }

    // Check if draft is starting soon (within next 2 hours)
    let isDraftSoon = false;
    if (draftStartTime) {
      const startTime = new Date(draftStartTime).getTime();
      const now = Date.now();
      const hoursUntilDraft = (startTime - now) / (1000 * 60 * 60);
      isDraftSoon = hoursUntilDraft > 0 && hoursUntilDraft <= 2;
    }

    // Show if draft is soon and user hasn't enabled notifications
    const shouldShowReminder = isDraftSoon && checkIfReminderNeeded('pre-draft');
    setShouldShow(shouldShowReminder);

    console.log('[DraftReminder] Decision:', { 
      permission, 
      isDraftSoon, 
      shouldShowReminder, 
      draftStartTime 
    });
  }, [draftStartTime, checkIfReminderNeeded, showAlways]);

  if (!shouldShow) {
    return null;
  }

  const formatTimeUntilDraft = () => {
    if (!draftStartTime) return "soon";
    
    const startTime = new Date(draftStartTime).getTime();
    const now = Date.now();
    const minutesUntil = Math.floor((startTime - now) / (1000 * 60));
    
    if (minutesUntil < 60) {
      return `in ${minutesUntil} minutes`;
    }
    
    const hoursUntil = Math.floor(minutesUntil / 60);
    return `in ${hoursUntil} hour${hoursUntil > 1 ? 's' : ''}`;
  };

  return (
    <NotificationPrompt
      isProminent={true}
      title="Draft Starting Soon!"
      description={`The ${leagueName} draft begins ${formatTimeUntilDraft()}. Enable notifications so you never miss your pick or important draft updates.`}
      context="pre-draft"
      onPermissionGranted={() => {
        setShouldShow(false);
        dismissReminder('pre-draft');
      }}
      onDismiss={() => {
        setShouldShow(false);
        dismissReminder('pre-draft');
      }}
    />
  );
}

// Example usage in league waiting room
export function ExampleDraftReminder() {
  // This would typically get real draft data from your API
  const mockDraftTime = new Date(Date.now() + 90 * 60 * 1000); // 90 minutes from now
  
  return (
    <DraftNotificationReminder
      draftStartTime={mockDraftTime}
      leagueName="Fantasy Championship League"
      showAlways={true} // For demo purposes
    />
  );
}