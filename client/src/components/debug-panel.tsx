import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { usePWADetection } from '@/hooks/use-pwa-detection';
import { useServiceWorker } from '@/hooks/use-service-worker';
import { usePostLoginNotifications } from '@/hooks/use-post-login-notifications';

export function DebugPanel() {
  const [isExpanded, setIsExpanded] = useState(false);
  const pwaStatus = usePWADetection();
  const { status: swStatus, skipWaiting } = useServiceWorker(true);
  const notificationState = usePostLoginNotifications();

  if (!isExpanded) {
    return (
      <div className="fixed bottom-4 right-4 z-50">
        <Button
          onClick={() => setIsExpanded(true)}
          variant="outline"
          size="sm"
          className="bg-white/90 backdrop-blur-sm"
        >
          🔧 Debug
        </Button>
      </div>
    );
  }

  return (
    <div className="fixed bottom-4 right-4 z-50 w-80">
      <Card className="bg-white/95 backdrop-blur-sm shadow-lg">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm">Debug Panel</CardTitle>
            <Button
              onClick={() => setIsExpanded(false)}
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0"
            >
              ✕
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-3 pt-0">
          {/* PWA Status */}
          <div>
            <h4 className="text-xs font-medium text-gray-600 mb-1">PWA Status</h4>
            <div className="flex flex-wrap gap-1">
              <Badge variant={pwaStatus.isPWA ? "default" : "secondary"}>
                {pwaStatus.isPWA ? "PWA Mode" : "Browser"}
              </Badge>
              <Badge variant={pwaStatus.isIOSDevice ? "default" : "secondary"}>
                {pwaStatus.isIOSDevice ? "iOS" : "Non-iOS"}
              </Badge>
              <Badge variant="outline" className="text-xs">
                {pwaStatus.displayMode}
              </Badge>
            </div>
          </div>

          {/* Service Worker Status */}
          <div>
            <h4 className="text-xs font-medium text-gray-600 mb-1">Service Worker</h4>
            <div className="flex flex-wrap gap-1">
              <Badge variant={swStatus.isRegistered ? "default" : "destructive"}>
                {swStatus.isRegistered ? "Registered" : "Not Registered"}
              </Badge>
              <Badge variant={swStatus.isActive ? "default" : "secondary"}>
                {swStatus.isActive ? "Active" : "Inactive"}
              </Badge>
              {swStatus.updateAvailable && (
                <Badge variant="outline" className="text-orange-600">
                  Update Available
                </Badge>
              )}
            </div>
            <div className="text-xs text-gray-500 mt-1">
              Version: {swStatus.version || 'Unknown'}
            </div>
          </div>

          {/* Notification Status */}
          <div>
            <h4 className="text-xs font-medium text-gray-600 mb-1">Notifications</h4>
            <div className="flex flex-wrap gap-1">
              <Badge variant={notificationState.isSupported ? "default" : "destructive"}>
                {notificationState.isSupported ? "Supported" : "Not Supported"}
              </Badge>
              <Badge 
                variant={notificationState.permissionStatus === 'granted' ? "default" : 
                        notificationState.permissionStatus === 'denied' ? "destructive" : "secondary"}
              >
                {notificationState.permissionStatus || 'default'}
              </Badge>
              {notificationState.subscriptionActive && (
                <Badge variant="default">
                  Subscribed
                </Badge>
              )}
            </div>
            {notificationState.error && (
              <div className="text-xs text-red-600 mt-1">
                {notificationState.error}
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="space-y-2">
            {swStatus.updateAvailable && (
              <Button
                onClick={skipWaiting}
                variant="outline"
                size="sm"
                className="w-full text-xs"
              >
                Apply Update
              </Button>
            )}
            <Button
              onClick={() => window.location.reload()}
              variant="outline"
              size="sm"
              className="w-full text-xs"
            >
              Reload App
            </Button>
          </div>

          {/* Technical Info */}
          <div className="text-xs text-gray-500 space-y-1">
            <div>User Agent: {navigator.userAgent.slice(0, 50)}...</div>
            <div>Can Install: {pwaStatus.canInstall ? 'Yes' : 'No'}</div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}