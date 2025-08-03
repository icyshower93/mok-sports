import { useState, useEffect } from 'react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { X, Plus, Share, Bell } from 'lucide-react';

interface IOSPWABannerProps {
  isIOS: boolean;
  isIOSPWA: boolean;
  needsPWAInstall: boolean;
}

  const [dismissed, setDismissed] = useState(false);

  // Reset dismissed state when conditions change
  useEffect(() => {
    if (isIOSPWA) {
      setDismissed(false);
    }
  }, [isIOSPWA]);

  // Check localStorage for dismissal preference
  useEffect(() => {
    const wasDismissed = localStorage.getItem('ios-pwa-banner-dismissed');
    if (wasDismissed === 'true' && needsPWAInstall) {
      setDismissed(true);
    }
  }, [needsPWAInstall]);

  const handleDismiss = () => {
    setDismissed(true);
    localStorage.setItem('ios-pwa-banner-dismissed', 'true');
  };

  // Don't show if not iOS, already PWA, or dismissed
  if (!isIOS || isIOSPWA || dismissed) {
    return null;
  }

  return (
      <Alert className="rounded-none border-x-0 border-t-0">
        <Bell className="w-4 h-4" />
        <AlertDescription className="flex items-center justify-between gap-4">
          <div className="flex-1">
          </div>
          <div className="flex items-center gap-2">
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => {
                // Scroll to push notifications section
                const element = document.getElementById('push-notifications-section');
                if (element) {
                  element.scrollIntoView({ behavior: 'smooth' });
                }
              }}
              className="text-xs"
            >
              See Instructions
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleDismiss}
              className="h-6 w-6 p-0"
            >
              <X className="w-4 h-4" />
              <span className="sr-only">Dismiss</span>
            </Button>
          </div>
        </AlertDescription>
      </Alert>
    </div>
  );
}