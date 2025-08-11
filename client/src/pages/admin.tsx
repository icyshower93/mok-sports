import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { ArrowLeft, Play, Pause, RotateCcw, Clock, Wifi, WifiOff, Calendar, Zap } from "lucide-react";
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

  const isRunning = adminState?.isSimulationRunning || false;
  const simulationSpeed = adminState?.simulationSpeed || 1;
  const currentDate = adminState?.currentDateFormatted || 'September 1, 2024';
  const currentWeek = adminState?.currentWeek || 0;
  const processedGames = adminState?.processedGames || 0;

  // NFL season simulation control mutations
  const startSimulationMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch('/api/admin/simulation/start', { 
        method: 'POST',
        credentials: 'include'
      });
      if (!response.ok) throw new Error('Failed to start simulation');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/state'] });
    }
  });

  const stopSimulationMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch('/api/admin/simulation/stop', { 
        method: 'POST',
        credentials: 'include'
      });
      if (!response.ok) throw new Error('Failed to stop simulation');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/state'] });
    }
  });

  const resetSimulationMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch('/api/admin/simulation/reset', { 
        method: 'POST',
        credentials: 'include'
      });
      if (!response.ok) throw new Error('Failed to reset simulation');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/state'] });
    }
  });

  const setSpeedMutation = useMutation({
    mutationFn: async (speed: number) => {
      const response = await fetch('/api/admin/simulation/speed', { 
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ speed })
      });
      if (!response.ok) throw new Error('Failed to set speed');
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

  // Handle speed change
  const handleSpeedChange = (newSpeed: number[]) => {
    const speed = newSpeed[0];
    setSpeedMutation.mutate(speed);
  };

  // Speed options for quick selection
  const speedPresets = [1, 5, 10, 30, 60, 120, 300]; // 1x to 300x speed

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
              <Calendar className="w-6 h-6 text-blue-600" />
              <h1 className="text-2xl font-bold">NFL Season Simulator</h1>
            </div>
          </div>
          <Badge variant={isConnected ? "default" : "secondary"} className="flex items-center space-x-1">
            {isConnected ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
            <span>{isConnected ? "Connected" : "Offline"}</span>
          </Badge>
        </div>

        {/* Current Date Display */}
        <Card className="mb-6">
          <CardContent className="pt-6">
            <div className="text-center space-y-4">
              <div className="text-4xl font-bold text-blue-600 dark:text-blue-400">
                {currentDate}
              </div>
              <div className="flex justify-center space-x-6 text-sm text-muted-foreground">
                <div className="flex items-center space-x-2">
                  <Clock className="w-4 h-4" />
                  <span>Week {currentWeek}</span>
                </div>
                <div className="flex items-center space-x-2">
                  <Zap className="w-4 h-4" />
                  <span>{processedGames} games processed</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Simulation Controls */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-center">Time Simulation Controls</CardTitle>
            <p className="text-center text-sm text-muted-foreground">
              Control NFL season time flow and game simulation
            </p>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Play/Pause/Reset Controls */}
            <div className="flex justify-center space-x-4">
              <Button
                onClick={() => isRunning ? stopSimulationMutation.mutate() : startSimulationMutation.mutate()}
                size="lg"
                variant={isRunning ? "destructive" : "default"}
                className="w-32"
                disabled={startSimulationMutation.isPending || stopSimulationMutation.isPending}
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
                onClick={() => resetSimulationMutation.mutate()}
                size="lg"
                variant="outline"
                className="w-32"
                disabled={resetSimulationMutation.isPending}
              >
                <RotateCcw className="w-5 h-5 mr-2" />
                Reset
              </Button>
            </div>

            {/* Speed Control */}
            <div className="space-y-4">
              <div className="text-center">
                <p className="text-sm font-medium mb-2">Time Speed: {simulationSpeed}x</p>
                <p className="text-xs text-muted-foreground">
                  {simulationSpeed === 1 ? 'Real time' : 
                   simulationSpeed < 60 ? `${simulationSpeed} minutes = 1 hour` :
                   simulationSpeed === 60 ? '1 minute = 1 hour' :
                   simulationSpeed === 120 ? '1 minute = 2 hours' :
                   simulationSpeed === 300 ? '1 minute = 5 hours' :
                   `${Math.round(simulationSpeed/60*10)/10} hours per minute`}
                </p>
              </div>
              
              <Slider
                value={[simulationSpeed]}
                onValueChange={handleSpeedChange}
                min={1}
                max={300}
                step={1}
                className="w-full"
                disabled={setSpeedMutation.isPending}
              />

              {/* Speed Presets */}
              <div className="flex flex-wrap justify-center gap-2">
                {speedPresets.map(preset => (
                  <Button
                    key={preset}
                    onClick={() => setSpeedMutation.mutate(preset)}
                    size="sm"
                    variant={simulationSpeed === preset ? "default" : "outline"}
                    disabled={setSpeedMutation.isPending}
                  >
                    {preset}x
                  </Button>
                ))}
              </div>
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