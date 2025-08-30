import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { AlertTriangle, CheckCircle2, XCircle, Wifi, WifiOff, Bug, Send } from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';

interface DiagnosticResult {
  user: {
    id: string;
    email: string;
  };
  vapid: {
    configured: boolean;
    publicKeyLength: number;
  };
  webpush: {
    configured: boolean;
  };
  subscriptions: {
    count: number;
    active: number;
    tests: Array<{
      id: string;
      endpoint: string;
      isValidFormat?: boolean;
      isActive: boolean;
      createdAt: string;
      lastUsed?: string;
      error?: string;
    }>;
  };
  environment: {
    nodeEnv: string;
    hasVapidPublic: boolean;
    hasVapidPrivate: boolean;
    protocol: string;
    host: string;
    isHttps: boolean;
  };
  timestamp: string;
}

interface TestResult {
  success: boolean;
  totalSubscriptions: number;
  successCount: number;
  failureCount: number;
  results: Array<{
    subscriptionId: string;
    success: boolean;
    statusCode?: number;
    duration?: number;
    error?: string;
    endpoint: string;
    responseBody?: any;
    headers?: any;
  }>;
  notification: any;
}

interface PushDiagnosticPanelProps {
  user?: any; // User object passed from parent
}

export function PushDiagnosticPanel({ user }: PushDiagnosticPanelProps) {
  const [isRunning, setIsRunning] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [diagnostics, setDiagnostics] = useState<DiagnosticResult | null>(null);
  const [testResult, setTestResult] = useState<TestResult | null>(null);
  const [testMessage, setTestMessage] = useState('Test notification from diagnostic panel');
  const [isCleaningUp, setIsCleaningUp] = useState(false);
  const [cleanupResult, setCleanupResult] = useState<any>(null);

  const runDiagnostics = async () => {
    if (!user) return;
    
    setIsRunning(true);
    try {
      const response = await fetch('/api/push/diagnostics', {
        credentials: 'include'
      });
      
      if (response.ok) {
        const result = await response.json();
        setDiagnostics(result);
      } else {
        console.error('Diagnostics failed:', response.status);
      }
    } catch (error) {
      console.error('Diagnostics error:', error);
    } finally {
      setIsRunning(false);
    }
  };

  const testNotificationDelivery = async () => {
    if (!user) return;
    
    setIsTesting(true);
    try {
      const response = await fetch('/api/push/test-delivery', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ message: testMessage })
      });
      
      if (response.ok) {
        const result = await response.json();
        setTestResult(result);
      } else {
        console.error('Test delivery failed:', response.status);
      }
    } catch (error) {
      console.error('Test delivery error:', error);
    } finally {
      setIsTesting(false);
    }
  };

  const cleanupSubscriptions = async () => {
    if (!user) return;
    
    setIsCleaningUp(true);
    try {
      const response = await fetch('/api/push/cleanup-subscriptions', {
        method: 'POST',
        credentials: 'include'
      });
      
      if (response.ok) {
        const result = await response.json();
        setCleanupResult(result);
        // Refresh diagnostics after cleanup
        await runDiagnostics();
      } else {
        console.error('Cleanup failed:', response.status);
      }
    } catch (error) {
      console.error('Cleanup error:', error);
    } finally {
      setIsCleaningUp(false);
    }
  };

  const forceResubscribe = async () => {
    if (!user) return;
    
    try {
      const response = await fetch('/api/push/force-resubscribe', {
        method: 'POST',
        credentials: 'include'
      });
      
      if (response.ok) {
        const result = await response.json();
        console.log('Force resubscribe result:', result);
        // Refresh diagnostics after force resubscribe
        await runDiagnostics();
      }
    } catch (error) {
      console.error('Force resubscribe error:', error);
    }
  };

  if (!user) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bug className="h-5 w-5" />
            Push Diagnostics
          </CardTitle>
          <CardDescription>Login required to run diagnostics</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bug className="h-5 w-5" />
            iOS PWA Push Notification Diagnostics
          </CardTitle>
          <CardDescription>
            Comprehensive analysis of push notification system for iOS Safari PWA
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Button 
              onClick={runDiagnostics} 
              disabled={isRunning}
              variant="outline"
            >
              {isRunning ? 'Running...' : 'Run Diagnostics'}
            </Button>
            
            <Button 
              onClick={testNotificationDelivery} 
              disabled={isTesting || !diagnostics}
              variant="outline"
            >
              <Send className="h-4 w-4 mr-2" />
              {isTesting ? 'Testing...' : 'Test Delivery'}
            </Button>
            
            <Button 
              onClick={cleanupSubscriptions} 
              disabled={isCleaningUp || !diagnostics}
              variant="outline"
            >
              {isCleaningUp ? 'Cleaning...' : 'Cleanup Invalid'}
            </Button>
            
            <Button 
              onClick={forceResubscribe} 
              disabled={!diagnostics}
              variant="outline"
            >
              Force Resubscribe
            </Button>
          </div>

          {diagnostics && (
            <div className="space-y-4">
              <Separator />
              
              {/* Environment Status */}
              <div>
                <h3 className="font-semibold mb-2">Environment Status</h3>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div className="flex items-center gap-2">
                    {diagnostics.environment.isHttps ? (
                      <CheckCircle2 className="h-4 w-4 text-green-500" />
                    ) : (
                      <XCircle className="h-4 w-4 text-red-500" />
                    )}
                    HTTPS: {diagnostics.environment.isHttps ? 'Enabled' : 'Disabled'}
                  </div>
                  <div className="flex items-center gap-2">
                    {diagnostics.vapid.configured ? (
                      <CheckCircle2 className="h-4 w-4 text-green-500" />
                    ) : (
                      <XCircle className="h-4 w-4 text-red-500" />
                    )}
                    VAPID: {diagnostics.vapid.configured ? 'Configured' : 'Missing'}
                  </div>
                  <div className="flex items-center gap-2">
                    {diagnostics.webpush.configured ? (
                      <CheckCircle2 className="h-4 w-4 text-green-500" />
                    ) : (
                      <XCircle className="h-4 w-4 text-red-500" />
                    )}
                    WebPush: {diagnostics.webpush.configured ? 'Ready' : 'Not configured'}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Environment: {diagnostics.environment.nodeEnv}
                  </div>
                </div>
              </div>

              {/* Subscription Status */}
              <div>
                <h3 className="font-semibold mb-2">Push Subscriptions</h3>
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Badge variant={diagnostics.subscriptions.active > 0 ? "default" : "secondary"}>
                      {diagnostics.subscriptions.active} Active / {diagnostics.subscriptions.count} Total
                    </Badge>
                  </div>
                  
                  {diagnostics.subscriptions.tests.map((test, index) => (
                    <div key={test.id} className="p-2 border rounded text-sm">
                      <div className="flex items-center gap-2 mb-1">
                        {test.error ? (
                          <XCircle className="h-4 w-4 text-red-500" />
                        ) : test.isValidFormat ? (
                          <CheckCircle2 className="h-4 w-4 text-green-500" />
                        ) : (
                          <AlertTriangle className="h-4 w-4 text-yellow-500" />
                        )}
                        <span className="font-mono">Subscription {index + 1}</span>
                        <Badge variant={test.isActive ? "default" : "secondary"} className="text-xs">
                          {test.isActive ? 'Active' : 'Inactive'}
                        </Badge>
                      </div>
                      <div className="text-xs text-muted-foreground space-y-1">
                        <div>Endpoint: {test.endpoint}</div>
                        <div>Created: {new Date(test.createdAt).toLocaleString()}</div>
                        {test.lastUsed && (
                          <div>Last Used: {new Date(test.lastUsed).toLocaleString()}</div>
                        )}
                        {test.error && (
                          <div className="text-red-500">Error: {test.error}</div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Test Message Input */}
              <div>
                <h3 className="font-semibold mb-2">Test Notification</h3>
                <Textarea
                  value={testMessage}
                  onChange={(e) => setTestMessage(e.target.value)}
                  placeholder="Enter test message..."
                  className="mb-2"
                />
              </div>
            </div>
          )}

          {/* Test Results */}
          {testResult && (
            <div className="space-y-2">
              <Separator />
              <h3 className="font-semibold">Delivery Test Results</h3>
              <div className="p-3 bg-muted rounded">
                <div className="flex items-center gap-2 mb-2">
                  {testResult.success ? (
                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                  ) : (
                    <XCircle className="h-4 w-4 text-red-500" />
                  )}
                  <span className="font-medium">
                    {testResult.successCount}/{testResult.totalSubscriptions} notifications delivered
                  </span>
                </div>
                
                {testResult.results.map((result, index) => (
                  <div key={index} className="text-sm p-2 border rounded mb-1">
                    <div className="flex items-center gap-2">
                      {result.success ? (
                        <CheckCircle2 className="h-3 w-3 text-green-500" />
                      ) : (
                        <XCircle className="h-3 w-3 text-red-500" />
                      )}
                      <span>{result.endpoint}</span>
                      {result.duration && (
                        <Badge variant="outline" className="text-xs">
                          {result.duration}ms
                        </Badge>
                      )}
                      {result.statusCode && (
                        <Badge variant="outline" className="text-xs">
                          HTTP {result.statusCode}
                        </Badge>
                      )}
                    </div>
                    {result.error && (
                      <div className="text-red-500 text-xs mt-1">
                        <div>Error: {result.error}</div>
                        {result.responseBody && (
                          <div>Response: {JSON.stringify(result.responseBody)}</div>
                        )}
                        {result.headers && (
                          <div>Headers: {JSON.stringify(result.headers)}</div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Cleanup Results */}
          {cleanupResult && (
            <div className="space-y-2">
              <Separator />
              <h3 className="font-semibold">Subscription Cleanup Results</h3>
              <div className="p-3 bg-muted rounded">
                <div className="text-sm space-y-1">
                  <div>Original: {cleanupResult.originalCount} subscriptions</div>
                  <div>Remaining: {cleanupResult.remainingCount} subscriptions</div>
                  <div>Removed: {cleanupResult.removedCount} invalid subscriptions</div>
                </div>
                
                {cleanupResult.results.map((result: any, index: number) => (
                  <div key={index} className="text-xs p-1 border rounded mt-1">
                    <div className="flex items-center gap-2">
                      {result.status === 'valid' ? (
                        <CheckCircle2 className="h-3 w-3 text-green-500" />
                      ) : result.status === 'removed' ? (
                        <XCircle className="h-3 w-3 text-red-500" />
                      ) : (
                        <AlertTriangle className="h-3 w-3 text-yellow-500" />
                      )}
                      <span>{result.endpoint}</span>
                      <Badge variant="outline" className="text-xs">
                        {result.status}
                      </Badge>
                      {result.statusCode && (
                        <Badge variant="outline" className="text-xs">
                          {result.statusCode}
                        </Badge>
                      )}
                    </div>
                    {result.error && (
                      <div className="text-red-500 mt-1">{result.error}</div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="text-xs text-muted-foreground">
            Last updated: {diagnostics ? new Date(diagnostics.timestamp).toLocaleString() : 'Never'}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}