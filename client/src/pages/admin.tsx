import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { queryClient } from "@/lib/queryClient";
import { Calendar, Clock, Play, Pause, SkipForward, Settings, Trophy, Target, ArrowLeft, Home, FastForward, RotateCcw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";

export default function AdminPanel() {
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const [selectedWeek, setSelectedWeek] = useState("0");
  const [selectedDay, setSelectedDay] = useState("sunday");
  const [gameTime, setGameTime] = useState("12:00");
  const [simulationSpeed, setSimulationSpeed] = useState(1);

  // Get current admin state
  const { data: adminState, isLoading, refetch } = useQuery({
    queryKey: ['/api/admin/state'],
    staleTime: 0, // Always fetch fresh data
    cacheTime: 0, // Don't cache the data
  });

  // Type guard for admin state
  const state = adminState as {
    currentWeek?: number;
    currentDay?: string;
    currentTime?: string;
    currentDate?: string;
    currentDateISO?: string;
    lockDeadlinePassed?: boolean;
    activeLocks?: number;
    totalPlayers?: number;
    gamesPlayed?: number;
    lastSimulation?: { week: number; gamesSimulated: number };
    timeSimulation?: {
      isRunning: boolean;
      speed: number;
      simulatedTime: string;
      processedGames: number;
    };
  } | undefined;
  
  // Initialize form controls with current admin state
  useEffect(() => {
    if (state) {
      setSelectedWeek(String(state.currentWeek || 0));
      setSelectedDay(state.currentDay || 'sunday');
      setGameTime(state.currentTime || '12:00');
    }
  }, [state]);

  // Time control mutations
  const advanceWeekMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch('/api/admin/advance-week', { 
        method: 'POST',
        credentials: 'include' 
      });
      if (!response.ok) throw new Error('Failed to advance week');
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/state'] });
      // Update local form state to match new admin state
      if (data?.state) {
        setSelectedWeek(String(data.state.currentWeek || 0));
        setSelectedDay(data.state.currentDay || 'monday');
        setGameTime(data.state.currentTime || '12:00');
      }
      // Refresh all other data that might be affected
      queryClient.invalidateQueries({ queryKey: ['/api/leagues'] });
      queryClient.invalidateQueries({ queryKey: ['/api/games'] });
      toast({ description: "Advanced to next week successfully" });
    },
  });

  // Time simulation control mutations
  const startSimulationMutation = useMutation({
    mutationFn: async (speed: number) => {
      const response = await fetch('/api/admin/start-simulation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ speed }),
        credentials: 'include'
      });
      if (!response.ok) throw new Error('Failed to start simulation');
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/state'] });
      toast({ description: `Time simulation started at ${data.simulation.speed}x speed` });
    },
  });

  const stopSimulationMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch('/api/admin/stop-simulation', {
        method: 'POST',
        credentials: 'include'
      });
      if (!response.ok) throw new Error('Failed to stop simulation');
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/state'] });
      toast({ description: "Time simulation stopped" });
    },
  });

  const setSpeedMutation = useMutation({
    mutationFn: async (speed: number) => {
      const response = await fetch('/api/admin/set-speed', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ speed }),
        credentials: 'include'
      });
      if (!response.ok) throw new Error('Failed to set speed');
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/state'] });
      toast({ description: `Simulation speed set to ${data.simulation.speed}x` });
    },
  });

  const resetSimulationMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch('/api/admin/reset-simulation', {
        method: 'POST',
        credentials: 'include'
      });
      if (!response.ok) throw new Error('Failed to reset simulation');
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/state'] });
      toast({ description: "Simulation reset to September 1, 2024" });
    },
  });

  const setTimeMutation = useMutation({
    mutationFn: async (timeData: { week: string; day: string; time: string }) => {
      const response = await fetch('/api/admin/set-time', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(timeData),
      });
      if (!response.ok) throw new Error('Failed to set time');
      return response.json();
    },
    onSuccess: () => {
      // Force refresh the query to get latest state
      queryClient.invalidateQueries({ queryKey: ['/api/admin/state'] });
      queryClient.refetchQueries({ queryKey: ['/api/admin/state'] });
      // Refresh all other data that might be affected
      queryClient.invalidateQueries({ queryKey: ['/api/leagues'] });
      queryClient.invalidateQueries({ queryKey: ['/api/games'] });
      toast({ description: "Time updated successfully" });
    },
  });

  const resetAppStateMutation = useMutation({
    mutationFn: async (resetData: { resetToWeek?: number; season?: number }) => {
      const response = await fetch('/api/admin/reset-app-state', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(resetData),
      });
      if (!response.ok) throw new Error('Failed to reset app state');
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/state'] });
      // Reset form controls to match reset state
      setSelectedWeek("0");
      setSelectedDay("sunday");
      setGameTime("12:00");
      // Refresh all other data that might be affected
      queryClient.invalidateQueries({ queryKey: ['/api/leagues'] });
      queryClient.invalidateQueries({ queryKey: ['/api/games'] });
      toast({ description: data.message || "App state reset successfully" });
    },
    onError: (error: Error) => {
      toast({ 
        variant: "destructive",
        description: `Reset failed: ${error.message}` 
      });
    },
  });

  const generateGamesMutation = useMutation({
    mutationFn: async (week: string) => {
      const response = await fetch('/api/admin/generate-games', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ week }),
      });
      if (!response.ok) throw new Error('Failed to generate games');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/state'] });
      toast({ description: "Games generated successfully" });
    },
  });

  const simulateGamesMutation = useMutation({
    mutationFn: async (week: string) => {
      const response = await fetch('/api/admin/simulate-games', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ week }),
      });
      if (!response.ok) throw new Error('Failed to simulate games');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/state'] });
      toast({ description: "Games simulated successfully" });
    },
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background p-6">
        <div className="max-w-6xl mx-auto">
          <div className="animate-pulse space-y-6">
            <div className="h-8 bg-muted rounded w-48"></div>
            <div className="grid gap-6 md:grid-cols-2">
              <div className="h-64 bg-muted rounded"></div>
              <div className="h-64 bg-muted rounded"></div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Settings className="w-8 h-8 text-primary" />
            <div>
              <h1 className="text-3xl font-bold">Admin Panel</h1>
              <p className="text-muted-foreground">Time travel through the 2024 NFL season with real game data</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button
              onClick={() => {
                resetAppStateMutation.mutate({ resetToWeek: 0, season: 2024 });
                setSelectedWeek("0");
                setSelectedDay("sunday");  
                setGameTime("12:00");
              }}
              disabled={resetAppStateMutation.isPending}
              variant="default"
              size="sm"
            >
              {resetAppStateMutation.isPending ? "Loading..." : "Reset to Sep 1, 2024"}
            </Button>
            <Button 
              variant="outline" 
              onClick={() => navigate('/main')}
              className="flex items-center space-x-2"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back to Home</span>
            </Button>
          </div>
        </div>

        {/* Time Simulation Control Panel */}
        <Card className="bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-950/20 dark:to-purple-950/20 border-2 border-primary/20">
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <FastForward className="w-5 h-5" />
                <span>Time Simulation Control</span>
              </div>
              <Badge variant={state?.timeSimulation?.isRunning ? "default" : "secondary"}>
                {state?.timeSimulation?.isRunning ? `Running ${state.timeSimulation.speed}x` : 'Stopped'}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-sm text-muted-foreground">Simulated Time</Label>
                <div className="text-lg font-semibold">
                  {state?.timeSimulation?.simulatedTime 
                    ? new Date(state.timeSimulation.simulatedTime).toLocaleString('en-US', {
                        weekday: 'short',
                        month: 'short', 
                        day: 'numeric',
                        hour: 'numeric',
                        minute: '2-digit',
                        timeZone: 'America/New_York'
                      })
                    : 'Sep 1, 2024 12:00 PM'
                  }
                </div>
              </div>
              <div>
                <Label className="text-sm text-muted-foreground">Games Auto-Completed</Label>
                <div className="text-lg font-semibold">
                  {state?.timeSimulation?.processedGames || 0}
                </div>
              </div>
            </div>
            
            <Separator />
            
            <div className="space-y-3">
              <div>
                <Label htmlFor="speed-select">Simulation Speed</Label>
                <Select value={String(simulationSpeed)} onValueChange={(v) => setSimulationSpeed(Number(v))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">1x Speed (Real Time)</SelectItem>
                    <SelectItem value="5">5x Speed</SelectItem>
                    <SelectItem value="10">10x Speed</SelectItem>
                    <SelectItem value="50">50x Speed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div className="flex space-x-2">
                <Button 
                  onClick={() => startSimulationMutation.mutate(simulationSpeed)}
                  disabled={state?.timeSimulation?.isRunning || startSimulationMutation.isPending}
                  size="sm"
                  className="flex-1"
                >
                  <Play className="w-4 h-4 mr-2" />
                  Start
                </Button>
                <Button 
                  onClick={() => stopSimulationMutation.mutate()}
                  disabled={!state?.timeSimulation?.isRunning || stopSimulationMutation.isPending}
                  size="sm"
                  variant="outline"
                  className="flex-1"
                >
                  <Pause className="w-4 h-4 mr-2" />
                  Stop
                </Button>
                <Button 
                  onClick={() => setSpeedMutation.mutate(simulationSpeed)}
                  disabled={!state?.timeSimulation?.isRunning || setSpeedMutation.isPending}
                  size="sm"
                  variant="outline"
                  className="flex-1"
                >
                  <FastForward className="w-4 h-4 mr-2" />
                  Set Speed
                </Button>
                <Button 
                  onClick={() => resetSimulationMutation.mutate()}
                  disabled={resetSimulationMutation.isPending}
                  size="sm"
                  variant="destructive"
                >
                  <RotateCcw className="w-4 h-4" />
                </Button>
              </div>
            </div>
            
            <div className="text-sm text-muted-foreground bg-muted/50 p-3 rounded-lg">
              <div className="font-semibold mb-1">How It Works:</div>
              <ul className="space-y-1 text-xs">
                <li>• Simulation starts from Sep 1, 2024 and marches forward automatically</li>
                <li>• When clock passes game times, real NFL scores are injected and points calculated</li>
                <li>• Lock mechanisms are disabled during active games</li>
                <li>• Use variable speeds to test entire season quickly</li>
              </ul>
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-6 md:grid-cols-2">
          {/* Current State */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Clock className="w-5 h-5" />
                <span>Current State</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label className="text-sm text-muted-foreground">Current Date</Label>
                <div className="text-xl font-bold text-primary mb-1">
                  {state?.currentDate || 'Loading...'}
                </div>
                <div className="text-lg font-semibold text-muted-foreground">
                  {state?.currentTime || 'Loading...'}
                </div>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => refetch()}
                  className="mt-2 text-xs"
                >
                  Refresh Time
                </Button>
              </div>

              <Separator />
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm text-muted-foreground">Current Week</Label>
                  <div className="text-2xl font-bold">
                    {state?.currentWeek === 0 ? 'Pre-Season' : `Week ${state?.currentWeek}`}
                  </div>
                </div>
                <div>
                  <Label className="text-sm text-muted-foreground">Status</Label>
                  <div className="text-lg font-semibold capitalize">
                    {state?.currentWeek === 0 ? 'Awaiting Season' : 'Season Active'}
                  </div>
                </div>
              </div>

              <Separator />

              <div>
                <Label className="text-sm text-muted-foreground mb-2 block">Season Progress</Label>
                <div className="flex items-center space-x-2">
                  <div className="flex-1 bg-muted rounded-full h-2">
                    <div 
                      className="bg-primary h-2 rounded-full transition-all duration-300"
                      style={{ width: `${Math.max(((state?.currentWeek || 0) / 18) * 100, 2)}%` }}
                    />
                  </div>
                  <span className="text-sm text-muted-foreground">
                    {state?.currentWeek === 0 ? 'Pre-Season' : `Week ${state?.currentWeek || 1} of 18`}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Time Controls */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Calendar className="w-5 h-5" />
                <span>Time Controls</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                <div>
                  <Label htmlFor="week-select">Set Week</Label>
                  <Select value={selectedWeek} onValueChange={setSelectedWeek}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="0">Pre-Season (Sep 1)</SelectItem>
                      {Array.from({ length: 18 }, (_, i) => (
                        <SelectItem key={i + 1} value={String(i + 1)}>
                          Week {i + 1}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="day-select">Set Day</Label>
                  <Select value={selectedDay} onValueChange={setSelectedDay}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="monday">Monday</SelectItem>
                      <SelectItem value="tuesday">Tuesday</SelectItem>
                      <SelectItem value="wednesday">Wednesday</SelectItem>
                      <SelectItem value="thursday">Thursday</SelectItem>
                      <SelectItem value="friday">Friday</SelectItem>
                      <SelectItem value="saturday">Saturday</SelectItem>
                      <SelectItem value="sunday">Sunday</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="time-input">Set Time (24hr format)</Label>
                  <Input
                    id="time-input"
                    type="time"
                    value={gameTime}
                    onChange={(e) => setGameTime(e.target.value)}
                  />
                </div>
              </div>

              <div className="flex space-x-2">
                <Button 
                  onClick={() => setTimeMutation.mutate({ week: selectedWeek, day: selectedDay, time: gameTime })}
                  disabled={setTimeMutation.isPending}
                  size="sm"
                  className="flex-1"
                >
                  <Play className="w-4 h-4 mr-2" />
                  Set Time
                </Button>
                <Button 
                  onClick={() => advanceWeekMutation.mutate()}
                  disabled={advanceWeekMutation.isPending}
                  size="sm"
                  variant="outline"
                  className="flex-1"
                >
                  <SkipForward className="w-4 h-4 mr-2" />
                  Next Week
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Game Management */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Trophy className="w-5 h-5" />
                <span>Game Management</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="text-sm text-muted-foreground mb-3">
                Generate and simulate games for testing league mechanics
              </div>
              
              <div className="space-y-2">
                <Button 
                  onClick={() => generateGamesMutation.mutate(selectedWeek)}
                  disabled={generateGamesMutation.isPending}
                  className="w-full"
                  variant="outline"
                >
                  <Target className="w-4 h-4 mr-2" />
                  Generate Week {selectedWeek} Games
                </Button>
                
                <Button 
                  onClick={() => simulateGamesMutation.mutate(selectedWeek)}
                  disabled={simulateGamesMutation.isPending}
                  className="w-full"
                >
                  <Play className="w-4 h-4 mr-2" />
                  Simulate Week {selectedWeek} Results
                </Button>
              </div>

              {state?.lastSimulation && (
                <div className="mt-4 p-3 bg-muted rounded-lg">
                  <div className="text-sm">
                    <div className="font-medium">Last Simulation</div>
                    <div className="text-muted-foreground">
                      Week {state.lastSimulation.week} - {state.lastSimulation.gamesSimulated} games
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* League Status */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Trophy className="w-5 h-5" />
                <span>League EEW2YU Status</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <Label className="text-muted-foreground">Total Players</Label>
                  <div className="font-semibold">{state?.totalPlayers || 6}</div>
                </div>
                <div>
                  <Label className="text-muted-foreground">Active Locks</Label>
                  <div className="font-semibold">{state?.activeLocks || 0}</div>
                </div>
                <div>
                  <Label className="text-muted-foreground">Games Played</Label>
                  <div className="font-semibold">{state?.gamesPlayed || 0}</div>
                </div>
                <div>
                  <Label className="text-muted-foreground">Lock Deadline</Label>
                  <div className="font-semibold">
                    <Badge variant={state?.lockDeadlinePassed ? "destructive" : "secondary"}>
                      {state?.lockDeadlinePassed ? "Passed" : "Active"}
                    </Badge>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}