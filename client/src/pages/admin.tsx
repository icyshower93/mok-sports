import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Play, Pause, RotateCcw, Clock, Wifi, WifiOff, FastForward, Calendar, Trophy } from "lucide-react";
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

  // Safely extract admin state with proper defaults
  const simulationDate = adminState?.simulationDate ? new Date(adminState.simulationDate) : new Date('2024-09-01T00:00:00Z');
  const isRunning = Boolean(adminState?.isSimulationRunning);
  const currentSpeed = Number(adminState?.timeAcceleration) || 1;
  const completedGames = Number(adminState?.completedGames) || 0;
  const upcomingGames = Array.isArray(adminState?.upcomingGames) ? adminState.upcomingGames : [];
  const currentWeek = Number(adminState?.currentWeek) || 1;
  const leagueStandings = Array.isArray(adminState?.leagueStandings) ? adminState.leagueStandings : [];

  // Season simulation controls
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

  const setTimeAccelerationMutation = useMutation({
    mutationFn: async (speed: number) => {
      const response = await fetch('/api/admin/simulation/speed', { 
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ speed }),
        credentials: 'include'
      });
      if (!response.ok) throw new Error('Failed to set time acceleration');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/state'] });
    }
  });

  const jumpToWeekMutation = useMutation({
    mutationFn: async (week: number) => {
      const response = await fetch('/api/admin/simulation/jump-to-week', { 
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ week }),
        credentials: 'include'
      });
      if (!response.ok) throw new Error('Failed to jump to week');
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
          if (message.type === 'admin-update' || message.type === 'game-completed' || message.type === 'week-completed') {
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

  // Format date and time
  const formatDateTime = (date: Date) => {
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      timeZoneName: 'short'
    });
  };

  const getSpeedLabel = (speed: number) => {
    if (speed === 1) return 'Real Time';
    if (speed < 60) return `${speed}x Speed`;
    if (speed < 3600) return `${Math.floor(speed / 60)}min/sec`;
    if (speed < 86400) return `${Math.floor(speed / 3600)}hr/sec`;
    return `${Math.floor(speed / 86400)}day/sec`;
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-6xl mx-auto p-4 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
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
              <h1 className="text-2xl font-bold">2024 NFL Season Simulator</h1>
            </div>
          </div>
          <Badge variant={isConnected ? "default" : "secondary"} className="flex items-center space-x-1">
            {isConnected ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
            <span>{isConnected ? "Connected" : "Offline"}</span>
          </Badge>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Simulation Control */}
          <div className="lg:col-span-2 space-y-6">
            {/* Current Date & Time */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Clock className="w-5 h-5" />
                  <span>Simulation Time</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-center space-y-4">
                  <div className="text-3xl font-mono font-bold text-blue-600 dark:text-blue-400">
                    {formatDateTime(simulationDate)}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    Week {currentWeek} • {getSpeedLabel(currentSpeed)}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Simulation Controls */}
            <Card>
              <CardHeader>
                <CardTitle>Simulation Controls</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Play/Pause/Reset */}
                <div className="flex justify-center space-x-3">
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

                {/* Time Acceleration */}
                <div className="space-y-2">
                  <label className="text-sm font-medium">Time Acceleration</label>
                  <Select 
                    key={`speed-${currentSpeed}`}
                    value={currentSpeed.toString()} 
                    onValueChange={(value) => {
                      if (value && !setTimeAccelerationMutation.isPending) {
                        setTimeAccelerationMutation.mutate(parseInt(value));
                      }
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={getSpeedLabel(currentSpeed)} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">Real Time (1x)</SelectItem>
                      <SelectItem value="10">10x Speed</SelectItem>
                      <SelectItem value="60">1 minute/second</SelectItem>
                      <SelectItem value="300">5 minutes/second</SelectItem>
                      <SelectItem value="1800">30 minutes/second</SelectItem>
                      <SelectItem value="3600">1 hour/second</SelectItem>
                      <SelectItem value="86400">1 day/second</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Quick Jump */}
                <div className="space-y-2">
                  <label className="text-sm font-medium">Jump to Week</label>
                  <Select 
                    key={`week-jump-${currentWeek}`}
                    onValueChange={(value) => {
                      if (value && !jumpToWeekMutation.isPending) {
                        jumpToWeekMutation.mutate(parseInt(value));
                      }
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={`Current: Week ${currentWeek}`} />
                    </SelectTrigger>
                    <SelectContent>
                      {Array.from({ length: 18 }, (_, i) => i + 1).map(week => (
                        <SelectItem key={week} value={week.toString()}>
                          Week {week}
                        </SelectItem>
                      ))}
                      <SelectItem value="19">Wild Card</SelectItem>
                      <SelectItem value="20">Divisional</SelectItem>
                      <SelectItem value="21">Conference Championship</SelectItem>
                      <SelectItem value="22">Super Bowl</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                )}
              </CardContent>
            </Card>

            {/* Upcoming Games */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span>Next Games</span>
                  <Badge variant="secondary">{upcomingGames.length} pending</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3 max-h-64 overflow-y-auto">
                  {upcomingGames.slice(0, 5).map((game: any, index: number) => (
                    <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="flex items-center space-x-3">
                        <div className="text-sm font-medium">
                          {game.awayTeam} @ {game.homeTeam}
                        </div>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {new Date(game.gameTime).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </div>
                    </div>
                  ))}
                  {upcomingGames.length === 0 && (
                    <div className="text-center text-muted-foreground py-8">
                      No upcoming games
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* League Standings */}
          <div className="space-y-6">
            {/* Season Stats */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Trophy className="w-5 h-5" />
                  <span>Season Progress</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Games Completed</span>
                  <span className="font-medium">{completedGames}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Current Week</span>
                  <span className="font-medium">Week {currentWeek}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Simulation Status</span>
                  <Badge variant={isRunning ? "default" : "secondary"}>
                    {isRunning ? "Running" : "Paused"}
                  </Badge>
                </div>
              </CardContent>
            </Card>

            {/* League Standings */}
            <Card>
              <CardHeader>
                <CardTitle>League Standings</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3 max-h-96 overflow-y-auto">
                  {leagueStandings.map((user: any, index: number) => (
                    <div key={user.id} className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="flex items-center space-x-3">
                        <div className="w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs flex items-center justify-center">
                          {index + 1}
                        </div>
                        <div>
                          <div className="font-medium">{user.username}</div>
                          <div className="text-xs text-muted-foreground">
                            {user.locksUsed || 0} locks used
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-bold text-lg">{user.totalPoints || 0}</div>
                        <div className="text-xs text-muted-foreground">points</div>
                      </div>
                    </div>
                  ))}
                  {leagueStandings.length === 0 && (
                    <div className="text-center text-muted-foreground py-8">
                      No league data available
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Status */}
        <div className="text-center space-y-2">
          <div className="text-sm text-muted-foreground">
            Simulation is <span className="font-medium">{isRunning ? 'running' : 'paused'}</span>
          </div>
          <div className="text-xs text-muted-foreground">
            {isConnected ? 
              "Real-time sync active - changes will appear on all devices instantly" : 
              "Offline mode - reconnecting..."
            }
          </div>
        </div>
      </div>
    </div>
  );
}