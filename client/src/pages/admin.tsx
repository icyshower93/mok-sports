import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Play, Pause, RotateCcw, Clock, Wifi, WifiOff } from "lucide-react";
import { useLocation } from "wouter";
import { queryClient } from "@/lib/queryClient";

export default function AdminPanel() {
  const [, navigate] = useLocation();
  const [isConnected, setIsConnected] = useState(false);
  const [ws, setWs] = useState<WebSocket | null>(null);

  // Fetch admin state from server
  const { data: adminState, refetch } = useQuery({
    queryKey: ['/api/admin/state'],
    refetchInterval: 1000, // Refetch every second for real-time updates
    staleTime: 0
  });

  const currentTime = adminState?.timerElapsed || 0;
  const isRunning = adminState?.isTimerRunning || false;

  // Timer control mutations
  const startTimerMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch('/api/admin/timer/start', { 
        method: 'POST',
        credentials: 'include'
      });
      if (!response.ok) throw new Error('Failed to start timer');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/state'] });
    }
  });

  const stopTimerMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch('/api/admin/timer/stop', { 
        method: 'POST',
        credentials: 'include'
      });
      if (!response.ok) throw new Error('Failed to stop timer');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/state'] });
    }
  });

  const resetTimerMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch('/api/admin/timer/reset', { 
        method: 'POST',
        credentials: 'include'
      });
      if (!response.ok) throw new Error('Failed to reset timer');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/state'] });
    }
  });

  // WebSocket connection for real-time updates
  useEffect(() => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/admin-ws`;
    
    try {
      const websocket = new WebSocket(wsUrl);
      
      websocket.onopen = () => {
        console.log('Admin WebSocket connected');
        setIsConnected(true);
        setWs(websocket);
      };

      websocket.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          if (message.type === 'admin-update') {
            // Invalidate queries to trigger re-fetch with fresh data
            queryClient.invalidateQueries({ queryKey: ['/api/admin/state'] });
          }
        } catch (error) {
          console.error('Error parsing WebSocket message:', error);
        }
      };

      websocket.onclose = () => {
        console.log('Admin WebSocket disconnected');
        setIsConnected(false);
        setWs(null);
      };

      websocket.onerror = (error) => {
        console.error('Admin WebSocket error:', error);
        setIsConnected(false);
      };

      return () => {
        websocket.close();
      };
    } catch (error) {
      console.error('Failed to create WebSocket connection:', error);
    }
  }, []);

  // Format time as MM:SS
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-2xl mx-auto p-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-4">
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => navigate("/")}
              className="flex items-center space-x-2"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back</span>
            </Button>
            <div className="flex items-center space-x-2">
              <Clock className="w-6 h-6 text-blue-600" />
              <h1 className="text-2xl font-bold">Admin Time Control</h1>
            </div>
          </div>
          <Badge variant={isConnected ? "default" : "secondary"} className="flex items-center space-x-1">
            {isConnected ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
            <span>{isConnected ? "Connected" : "Offline"}</span>
          </Badge>
        </div>

        {/* Timer Card */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-center">Synchronized Timer</CardTitle>
            <p className="text-center text-sm text-muted-foreground">
              This timer syncs across all devices in real-time
            </p>
          </CardHeader>
          <CardContent className="text-center space-y-6">
            {/* Time Display */}
            <div className="text-6xl font-mono font-bold text-blue-600 dark:text-blue-400">
              {formatTime(currentTime)}
            </div>

            {/* Controls */}
            <div className="flex justify-center space-x-4">
              <Button
                onClick={() => isRunning ? stopTimerMutation.mutate() : startTimerMutation.mutate()}
                size="lg"
                variant={isRunning ? "destructive" : "default"}
                className="w-32"
                disabled={startTimerMutation.isPending || stopTimerMutation.isPending}
              >
                {isRunning ? (
                  <>
                    <Pause className="w-5 h-5 mr-2" />
                    Pause
                  </>
                ) : (
                  <>
                    <Play className="w-5 h-5 mr-2" />
                    Start
                  </>
                )}
              </Button>

              <Button
                onClick={() => resetTimerMutation.mutate()}
                size="lg"
                variant="outline"
                className="w-32"
                disabled={resetTimerMutation.isPending}
              >
                <RotateCcw className="w-5 h-5 mr-2" />
                Reset
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Status */}
        <div className="text-center space-y-2">
          <div className="text-sm text-muted-foreground">
            Timer is <span className="font-medium">{isRunning ? 'running' : 'stopped'}</span>
          </div>
          <div className="text-xs text-muted-foreground">
            {isConnected ? 
              "Real-time sync active - changes will appear on all devices" : 
              "Offline mode - reconnecting..."
            }
          </div>
        </div>
      </div>
    </div>
  );
}