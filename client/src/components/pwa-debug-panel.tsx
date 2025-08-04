import { useState } from 'react';
import { usePWADebug } from '@/hooks/use-pwa-debug';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ChevronDown, ChevronUp, RefreshCw, Smartphone, Wifi } from 'lucide-react';

export function PWADebugPanel() {
  const { debugInfo, logs, addLog, checkPWAStatus, testNotificationFlow, clearLogs, subscriptionManager, manualRefreshSubscription } = usePWADebug();
  const [isExpanded, setIsExpanded] = useState(false);

  const StatusBadge = ({ condition, label }: { condition: boolean; label: string }) => (
    <Badge variant={condition ? 'default' : 'destructive'} className="text-xs">
      {condition ? '✅' : '❌'} {label}
    </Badge>
  );

  const isProductionReady = debugInfo.isStandalone && 
                           debugInfo.isHTTPS && 
                           debugInfo.notificationPermission === 'granted' &&
                           debugInfo.serviceWorkerRegistered;

  return (
    <Card className="w-full max-w-2xl mx-auto mt-4">
      <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-900">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Smartphone className="h-5 w-5" />
                <CardTitle className="text-lg">PWA Debug Panel</CardTitle>
                {isProductionReady && <Badge variant="default">Production Ready</Badge>}
              </div>
              {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </div>
            <CardDescription>
              iOS PWA push notification status and debugging tools
            </CardDescription>
          </CardHeader>
        </CollapsibleTrigger>
        
        <CollapsibleContent>
          <CardContent className="space-y-4">
            {/* Environment Status */}
            <div className="grid grid-cols-2 gap-2">
              <StatusBadge condition={debugInfo.isStandalone} label="Standalone Mode" />
              <StatusBadge condition={debugInfo.isHTTPS} label="HTTPS" />
              <StatusBadge condition={debugInfo.isIOSDevice} label="iOS Device" />
              <StatusBadge condition={debugInfo.environment === 'production'} label="Production" />
            </div>

            {/* Push Notification Status */}
            <div className="grid grid-cols-2 gap-2">
              <StatusBadge condition={debugInfo.notificationPermission === 'granted'} label="Permission Granted" />
              <StatusBadge condition={debugInfo.pushSupported} label="Push Supported" />
              <StatusBadge condition={debugInfo.serviceWorkerRegistered} label="Service Worker" />
              <StatusBadge condition={debugInfo.hasActiveSubscription} label="Active Subscription" />
            </div>

            {/* Critical Warnings */}
            {!debugInfo.isStandalone && (
              <div className="p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
                <div className="flex items-center gap-2 text-yellow-800 dark:text-yellow-200">
                  <Smartphone className="h-4 w-4" />
                  <span className="font-semibold">Install PWA Required</span>
                </div>
                <p className="text-sm text-yellow-700 dark:text-yellow-300 mt-1">
                  Add this app to your home screen for push notifications to work on iOS Safari.
                </p>
              </div>
            )}

            {!debugInfo.isHTTPS && debugInfo.environment === 'production' && (
              <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                <div className="flex items-center gap-2 text-red-800 dark:text-red-200">
                  <Wifi className="h-4 w-4" />
                  <span className="font-semibold">HTTPS Required</span>
                </div>
                <p className="text-sm text-red-700 dark:text-red-300 mt-1">
                  Deploy to production with HTTPS for iOS push notifications to work.
                </p>
              </div>
            )}

            {/* Subscription Details */}
            {debugInfo.subscriptionEndpoint && (
              <div className="text-xs text-gray-600 dark:text-gray-400 space-y-1">
                <div><strong>Subscription:</strong> {debugInfo.subscriptionEndpoint.substring(0, 50)}...</div>
                {subscriptionManager.lastRefreshTime && (
                  <div><strong>Last Refresh:</strong> {new Date(subscriptionManager.lastRefreshTime).toLocaleString()}</div>
                )}
                <div><strong>Refresh Count:</strong> {subscriptionManager.refreshCount}</div>
                {subscriptionManager.isRefreshing && (
                  <div className="text-blue-600 dark:text-blue-400">🔄 Refreshing subscription...</div>
                )}
                {subscriptionManager.error && (
                  <div className="text-red-600 dark:text-red-400">❌ Error: {subscriptionManager.error}</div>
                )}
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex gap-2 flex-wrap">
              <Button 
                variant="outline" 
                size="sm" 
                onClick={checkPWAStatus}
                className="flex items-center gap-1"
              >
                <RefreshCw className="h-3 w-3" />
                Check Status
              </Button>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={manualRefreshSubscription}
                disabled={subscriptionManager.isRefreshing}
                className="flex items-center gap-1"
              >
                <RefreshCw className={`h-3 w-3 ${subscriptionManager.isRefreshing ? 'animate-spin' : ''}`} />
                Refresh Subscription
              </Button>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={testNotificationFlow}
              >
                Test Flow
              </Button>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={clearLogs}
              >
                Clear Logs
              </Button>
            </div>

            {/* Debug Logs */}
            {logs.length > 0 && (
              <div className="bg-gray-50 dark:bg-gray-900 p-3 rounded-lg">
                <h4 className="font-semibold text-sm mb-2">Debug Logs</h4>
                <div className="space-y-1 max-h-48 overflow-y-auto">
                  {logs.map((log, index) => (
                    <div key={index} className="text-xs font-mono text-gray-700 dark:text-gray-300">
                      {log}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Environment Details */}
            <details className="text-xs text-gray-500 dark:text-gray-400">
              <summary className="cursor-pointer font-semibold">Environment Details</summary>
              <div className="mt-2 space-y-1 font-mono">
                <div>URL: {window.location.href}</div>
                <div>Protocol: {window.location.protocol}</div>
                <div>Host: {window.location.host}</div>
                <div>UA: {debugInfo.userAgent.substring(0, 100)}...</div>
              </div>
            </details>
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}