import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Bell, X, AlertCircle, CheckCircle } from 'lucide-react';
import { usePostLoginNotifications } from '@/hooks/use-post-login-notifications';
import { useState } from 'react';

interface NotificationBannerProps {
  onDismiss?: () => void;
}

  const { 
    showEnableBanner, 
    permissionStatus, 
    subscriptionActive, 
    isProcessing, 
    error, 
    isSupported,
    enableNotifications 
  } = usePostLoginNotifications();
  
  const [dismissed, setDismissed] = useState(false);

  if (!isSupported || !showEnableBanner || dismissed) {
    return null;
  }

  const handleEnableClick = async () => {
    // iOS Safari requires this to be triggered by user gesture
    const success = await enableNotifications();
    if (success) {
      setDismissed(true);
      onDismiss?.();
    }
  };

  const handleDismiss = () => {
    setDismissed(true);
    onDismiss?.();
  };

  const getStatusIcon = () => {
    if (permissionStatus === 'granted' && subscriptionActive) {
      return <CheckCircle className="w-5 h-5 text-green-500" />;
    }
    if (permissionStatus === 'denied') {
      return <AlertCircle className="w-5 h-5 text-red-500" />;
    }
    return <Bell className="w-5 h-5 text-blue-500" />;
  };

  const getMessage = () => {
    if (permissionStatus === 'denied') {
      return {
        title: 'Notifications Blocked',
        description: 'Enable notifications in your browser settings to get league updates.',
      };
    }
    
    if (permissionStatus === 'granted' && !subscriptionActive) {
      return {
        title: 'Complete Notification Setup',
        description: 'Finish setting up notifications to receive league updates.',
        showButton: true,
      };
    }
    
    return {
      title: 'Enable Notifications',
      description: 'Get notified about draft times, league updates, and important announcements.',
      showButton: true,
    };
  };

  const { title, description, showButton, buttonText } = getMessage();

  return (
      <CardContent className="flex items-center justify-between p-4">
        <div className="flex items-center space-x-3 flex-1">
          {getStatusIcon()}
          <div className="flex-1">
              {title}
            </h4>
              {description}
            </p>
            {error && (
              </p>
            )}
          </div>
        </div>
        
        <div className="flex items-center space-x-2">
          {showButton && (
            <Button
              onClick={handleEnableClick}
              disabled={isProcessing}
              size="sm"
            >
            </Button>
          )}
          <Button
            onClick={handleDismiss}
            variant="ghost"
            size="sm"
          >
            <X className="w-4 h-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}