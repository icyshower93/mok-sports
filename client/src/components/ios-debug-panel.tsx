import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Info, CheckCircle, XCircle, AlertTriangle } from 'lucide-react';

interface IOSDebugPanelProps {
  isIOS: boolean;
  isIOSPWA: boolean;
  needsPWAInstall: boolean;
  isSupported: boolean;
  permission: NotificationPermission;
}

export function IOSDebugPanel({ 
  isIOS, 
  isIOSPWA, 
  needsPWAInstall, 
  isSupported, 
  permission 
}: IOSDebugPanelProps) {
  if (!isIOS) {
    return null;
  }

  const debugInfo = {
    userAgent: navigator.userAgent,
    displayMode: window.matchMedia ? window.matchMedia('(display-mode: standalone)').matches : false,
    standalone: 'standalone' in window.navigator ? (window.navigator as any).standalone : false,
    notificationPermission: permission,
    pushManagerSupported: 'PushManager' in window,
    serviceWorkerSupported: 'serviceWorker' in navigator,
    isIOSPWA,
    needsPWAInstall,
    isSupported
  };

  const getStatusIcon = (condition: boolean) => {
    return condition ? 
      <CheckCircle className="w-4 h-4 text-green-500" /> : 
      <XCircle className="w-4 h-4 text-red-500" />;
  };

  const getStatusBadge = (condition: boolean, trueText: string, falseText: string) => {
    return (
      <Badge variant={condition ? "default" : "destructive"} className="text-xs">
        {condition ? trueText : falseText}
      </Badge>
    );
  };

  return (
    <Card className="mt-4">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-sm">
          <Info className="w-4 h-4" />
          iOS Notification Debug Info
        </CardTitle>
        <CardDescription className="text-xs">
          Technical details for troubleshooting iOS push notifications
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <Alert>
          <AlertTriangle className="w-4 h-4" />
          <AlertDescription className="text-sm">
            iOS 16.4+ requires the app to be installed as a PWA (home screen) for push notifications to work.
          </AlertDescription>
        </Alert>

        <div className="grid grid-cols-1 gap-2 text-sm">
          <div className="flex items-center justify-between">
            <span>iOS Device:</span>
            <div className="flex items-center gap-1">
              {getStatusIcon(isIOS)}
              {getStatusBadge(isIOS, "Yes", "No")}
            </div>
          </div>

          <div className="flex items-center justify-between">
            <span>PWA Mode (standalone):</span>
            <div className="flex items-center gap-1">
              {getStatusIcon(debugInfo.displayMode)}
              {getStatusBadge(debugInfo.displayMode, "Active", "Not Active")}
            </div>
          </div>

          <div className="flex items-center justify-between">
            <span>Navigator Standalone:</span>
            <div className="flex items-center gap-1">
              {getStatusIcon(debugInfo.standalone)}
              {getStatusBadge(debugInfo.standalone, "True", "False")}
            </div>
          </div>

          <div className="flex items-center justify-between">
            <span>Calculated PWA Status:</span>
            <div className="flex items-center gap-1">
              {getStatusIcon(isIOSPWA)}
              {getStatusBadge(isIOSPWA, "PWA Detected", "Browser Mode")}
            </div>
          </div>

          <div className="flex items-center justify-between">
            <span>Push Manager API:</span>
            <div className="flex items-center gap-1">
              {getStatusIcon(debugInfo.pushManagerSupported)}
              {getStatusBadge(debugInfo.pushManagerSupported, "Supported", "Not Supported")}
            </div>
          </div>

          <div className="flex items-center justify-between">
            <span>Service Worker API:</span>
            <div className="flex items-center gap-1">
              {getStatusIcon(debugInfo.serviceWorkerSupported)}
              {getStatusBadge(debugInfo.serviceWorkerSupported, "Supported", "Not Supported")}
            </div>
          </div>

          <div className="flex items-center justify-between">
            <span>Notification Permission:</span>
            <div className="flex items-center gap-1">
              {permission === 'granted' ? <CheckCircle className="w-4 h-4 text-green-500" /> : 
               permission === 'denied' ? <XCircle className="w-4 h-4 text-red-500" /> :
               <AlertTriangle className="w-4 h-4 text-yellow-500" />}
              <Badge 
                variant={permission === 'granted' ? "default" : permission === 'denied' ? "destructive" : "secondary"}
                className="text-xs"
              >
                {permission}
              </Badge>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <span>Overall Support:</span>
            <div className="flex items-center gap-1">
              {getStatusIcon(isSupported)}
              {getStatusBadge(isSupported, "Supported", "Not Supported")}
            </div>
          </div>
        </div>

        {needsPWAInstall && (
          <Alert>
            <XCircle className="w-4 h-4" />
            <AlertDescription className="text-sm">
              <strong>Issue:</strong> App is running in browser mode. Please add to home screen and reopen from there.
            </AlertDescription>
          </Alert>
        )}

        {isIOSPWA && !isSupported && (
          <Alert>
            <XCircle className="w-4 h-4" />
            <AlertDescription className="text-sm">
              <strong>Issue:</strong> PWA detected but push notifications still not supported. This may indicate an iOS version below 16.4 or disabled notifications in Safari settings.
            </AlertDescription>
          </Alert>
        )}

        {isIOSPWA && isSupported && permission === 'default' && (
          <Alert>
            <CheckCircle className="w-4 h-4" />
            <AlertDescription className="text-sm">
              <strong>Ready:</strong> PWA mode detected and push notifications are supported. You can now request permission.
            </AlertDescription>
          </Alert>
        )}

        <div className="pt-2 border-t text-xs text-muted-foreground">
          <strong>User Agent:</strong> {debugInfo.userAgent.substring(0, 80)}...
        </div>
      </CardContent>
    </Card>
  );
}