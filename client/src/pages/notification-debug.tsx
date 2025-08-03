import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { MainLayout } from '@/components/layout/main-layout';
import { useAuth } from '@/hooks/use-auth';
import { Badge } from '@/components/ui/badge';
import { RefreshCw, CheckCircle, AlertCircle } from 'lucide-react';

export default function NotificationDebug() {
  const [testing, setTesting] = useState(false);
  const [subscriptionStatus, setSubscriptionStatus] = useState<'checking' | 'active' | 'inactive' | 'error'>('checking');
  const { toast } = useToast();
  const { user } = useAuth();

  const refreshPushSubscription = async () => {
    setTesting(true);
    try {
      // First, check if service worker is registered
      const registration = await navigator.serviceWorker.getRegistration();
      if (!registration) {
        throw new Error('Service worker not registered');
      }

      // Check current subscription
      const existingSubscription = await registration.pushManager.getSubscription();
      if (existingSubscription) {
        console.log('Found existing subscription, unsubscribing...');
        await existingSubscription.unsubscribe();
      }

      // Create new subscription
      console.log('Creating new push subscription...');
      const newSubscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: 'BLC0EubNcXYeUBVgGslRhOO5lHxmgS2LLQKGPMcQ1Kj9-JFR1sTaYqlp-M8r2PsTVTGm8kFLfQZ_X_wJT3JJaOQ'
      });

      // Send to server
      const response = await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(newSubscription)
      });

      if (!response.ok) {
        throw new Error('Failed to register with server');
      }

      setSubscriptionStatus('active');
      toast({
        title: "Subscription Refreshed!",
        description: "Your push subscription has been updated. Testing now...",
      });

      // Test immediately
      setTimeout(() => testNotification(), 1000);

    } catch (error: any) {
      console.error('Refresh subscription error:', error);
      setSubscriptionStatus('error');
      toast({
        title: "Refresh Failed",
        description: error.message || "Failed to refresh push subscription",
        variant: "destructive",
      });
    } finally {
      setTesting(false);
    }
  };

  const testNotification = async () => {
    try {
      const response = await fetch('/api/push/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ 
          message: "Your refreshed push subscription is working! League notifications should now work properly." 
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Test notification failed');
      }

      toast({
        title: "Test Sent!",
        description: "Check if you received the test notification.",
      });

    } catch (error: any) {
      toast({
        title: "Test Failed",
        description: error.message || "Failed to send test notification",
        variant: "destructive",
      });
    }
  };

  const testLeagueNotification = async () => {
    setTesting(true);
    try {
      const response = await fetch('/api/test/league-full-notification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          leagueId: '243d719b-92ce-4752-8689-5da93ee69213' 
        }),
      });

      const result = await response.json();
      
      if (!response.ok) {
        throw new Error(result.message || 'Failed to test league notification');
      }

      toast({
        title: "League Test Complete!",
        description: `Sent to ${result.sentCount} devices. Check if you got the "League is Full" notification.`,
      });

      console.log('League test result:', result);
      
    } catch (error: any) {
      toast({
        title: "League Test Failed",
        description: error.message || "Failed to send league notification",
        variant: "destructive",
      });
    } finally {
      setTesting(false);
    }
  };

  const getStatusIcon = () => {
    if (subscriptionStatus === 'active') return <CheckCircle className="h-4 w-4" />;
    if (subscriptionStatus === 'error') return <AlertCircle className="h-4 w-4" />;
    return <RefreshCw className={`h-4 w-4 ${subscriptionStatus === 'checking' ? 'animate-spin' : ''}`} />;
  };

  const getStatusColor = () => {
    if (subscriptionStatus === 'active') return 'success';
    if (subscriptionStatus === 'error') return 'destructive';
    return 'secondary';
  };

  return (
    <MainLayout>
      <div className="max-w-2xl mx-auto p-6 space-y-6">
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold">Notification Debug</h1>
          <p className="text-muted-foreground">
            Debug and refresh your push notification subscription
          </p>
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Push Subscription Status</CardTitle>
                <CardDescription>
                  Your current push notification subscription status
                </CardDescription>
              </div>
              <Badge variant={getStatusColor() as any} className="flex items-center gap-1">
                {getStatusIcon()}
                {subscriptionStatus}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="p-4 bg-muted rounded-lg">
              <p className="text-sm">
                <strong>User:</strong> {user?.name} ({user?.email})<br/>
                <strong>Issue:</strong> Welcome notifications work, but league full notifications don't<br/>
                <strong>Solution:</strong> Refresh your push subscription to get a new endpoint
              </p>
            </div>
            <Button 
              onClick={refreshPushSubscription} 
              disabled={testing}
              className="w-full"
            >
              {testing ? "Refreshing..." : "Refresh Push Subscription"}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Test Notifications</CardTitle>
            <CardDescription>
              Test both personal and league notifications after refreshing
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 gap-3">
              <Button 
                onClick={testNotification} 
                disabled={testing}
                variant="outline"
              >
                Test Personal Notification
              </Button>
              <Button 
                onClick={testLeagueNotification} 
                disabled={testing}
                variant="outline"
              >
                Test League Full Notification
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Troubleshooting Steps</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="space-y-1">
              <p><strong>1. Refresh subscription:</strong> This creates a new push endpoint</p>
              <p><strong>2. Test personal notification:</strong> Verify the new subscription works</p>
              <p><strong>3. Test league notification:</strong> Check if league full alerts work</p>
              <p><strong>4. Check browser console:</strong> Look for any error messages</p>
              <p><strong>5. Verify PWA permissions:</strong> Ensure notifications are still enabled</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}