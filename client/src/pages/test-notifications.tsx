import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { MainLayout } from '@/components/layout/main-layout';

export default function TestNotifications() {
  const [testing, setTesting] = useState(false);
  const { toast } = useToast();

  const testLeagueFullNotification = async () => {
    setTesting(true);
    try {
      const response = await fetch('/api/test/league-full-notification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ 
          leagueId: '243d719b-92ce-4752-8689-5da93ee69213' 
        }),
      });

      const result = await response.json();
      
      if (!response.ok) {
        throw new Error(result.message || 'Failed to test notification');
      }

      toast({
        title: "Test Complete!",
        description: `Notification sent to ${result.sentCount} devices. Check your PWA for the notification.`,
      });

      console.log('Test notification result:', result);
      
    } catch (error: any) {
      toast({
        title: "Test Failed",
        description: error.message || "Failed to send test notification",
        variant: "destructive",
      });
      console.error('Test notification error:', error);
    } finally {
      setTesting(false);
    }
  };

  const testUserNotification = async () => {
    setTesting(true);
    try {
      const response = await fetch('/api/push/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ 
          message: "This is a user-specific test notification to verify your PWA notification setup works correctly." 
        }),
      });

      const result = await response.json();
      
      if (!response.ok) {
        throw new Error(result.message || 'Failed to test user notification');
      }

      toast({
        title: "User Test Complete!",
        description: `User notification sent successfully. Check your PWA for the notification.`,
      });

      console.log('User test notification result:', result);
      
    } catch (error: any) {
      toast({
        title: "User Test Failed",
        description: error.message || "Failed to send user test notification",
        variant: "destructive",
      });
      console.error('User test notification error:', error);
    } finally {
      setTesting(false);
    }
  };

  return (
    <MainLayout>
      <div className="max-w-2xl mx-auto p-6 space-y-6">
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold">Notification Testing</h1>
          <p className="text-muted-foreground">
            Test the push notification system to ensure it works correctly
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>League Full Notification Test</CardTitle>
            <CardDescription>
              Tests the automatic notification that gets sent when a league becomes full (6/6 members)
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="p-4 bg-muted rounded-lg">
              <p className="text-sm">
                <strong>League:</strong> Test League 1 (EEW2YU)<br/>
                <strong>Status:</strong> FULL (6/6 members)<br/>
                <strong>Test:</strong> Send "League is Full!" notification to all members
              </p>
            </div>
            <Button 
              onClick={testLeagueFullNotification} 
              disabled={testing}
              className="w-full"
            >
              {testing ? "Sending..." : "Test League Full Notification"}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>User Notification Test</CardTitle>
            <CardDescription>
              Tests sending a notification specifically to your user account
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="p-4 bg-muted rounded-lg">
              <p className="text-sm">
                <strong>Test:</strong> Send personal test notification to verify your PWA setup
              </p>
            </div>
            <Button 
              onClick={testUserNotification} 
              disabled={testing}
              variant="outline"
              className="w-full"
            >
              {testing ? "Sending..." : "Test User Notification"}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Debugging Information</CardTitle>
            <CardDescription>
              Instructions for debugging notification issues
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="space-y-1">
              <p><strong>1. Enable notifications:</strong> Make sure you've enabled notifications in your PWA</p>
              <p><strong>2. Check console:</strong> Open browser DevTools to see detailed logs</p>
              <p><strong>3. Server logs:</strong> Check server logs for notification sending details</p>
              <p><strong>4. Subscription status:</strong> Verify you have active push subscriptions</p>
              <p><strong>5. VAPID keys:</strong> Ensure VAPID keys are properly configured</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}