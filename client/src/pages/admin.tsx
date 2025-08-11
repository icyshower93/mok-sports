import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Calendar, ChevronRight, RotateCcw } from "lucide-react";
import { useLocation } from "wouter";
import { queryClient } from "@/lib/queryClient";

// Define simple admin state type
interface AdminState {
  currentDate: string;
  gamesProcessedToday: number;
  totalGamesProcessed: number;
  totalGames: number;
  currentWeek: number;
  processingInProgress: boolean;
}

export default function AdminPanel() {
  const [, navigate] = useLocation();

  // Fetch admin state from server
  const { data: adminState, isLoading } = useQuery<AdminState>({
    queryKey: ['/api/admin/state'],
    refetchInterval: 2000, // Refetch every 2 seconds
    staleTime: 0
  });

  // Safely extract admin state with defaults
  const currentDate = adminState?.currentDate ? new Date(adminState.currentDate) : new Date('2024-09-01');
  const gamesProcessedToday = adminState?.gamesProcessedToday || 0;
  const totalGamesProcessed = adminState?.totalGamesProcessed || 0;
  const totalGames = adminState?.totalGames || 272;
  const currentWeek = adminState?.currentWeek || 1;
  const processingInProgress = adminState?.processingInProgress || false;

  // Simple day progression controls
  const advanceDayMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch('/api/admin/advance-day', { 
        method: 'POST',
        credentials: 'include'
      });
      if (!response.ok) throw new Error('Failed to advance day');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/state'] });
    }
  });

  const resetSeasonMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch('/api/admin/reset-season', { 
        method: 'POST',
        credentials: 'include'
      });
      if (!response.ok) throw new Error('Failed to reset season');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/state'] });
    }
  });

  // Helper functions
  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const getWeekLabel = (week: number) => {
    if (week <= 18) return `Week ${week}`;
    if (week === 19) return 'Wild Card';
    if (week === 20) return 'Divisional';
    if (week === 21) return 'Conference Championship';
    if (week === 22) return 'Super Bowl';
    return `Week ${week}`;
  };

  const getProgressPercentage = () => {
    if (totalGames === 0) return 0;
    return Math.round((totalGamesProcessed / totalGames) * 100);
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-4xl mx-auto p-4 space-y-6">
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
              <h1 className="text-2xl font-bold">2024 NFL Season Admin</h1>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Main Control Panel */}
          <div className="space-y-6">
            {/* Current Date */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Calendar className="w-5 h-5" />
                  <span>Current Date</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-center space-y-4">
                  <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                    {formatDate(currentDate)}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {getWeekLabel(currentWeek)}
                  </div>
                  {gamesProcessedToday > 0 && (
                    <Badge variant="secondary">
                      {gamesProcessedToday} games processed today
                    </Badge>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Simple Controls */}
            <Card>
              <CardHeader>
                <CardTitle>Day Progression</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="text-center space-y-4">
                  <p className="text-sm text-muted-foreground">
                    Click to advance one day forward. Games scheduled for that day will be automatically processed with authentic NFL scores.
                  </p>
                  
                  <Button
                    onClick={() => advanceDayMutation.mutate()}
                    size="lg"
                    className="w-full"
                    disabled={advanceDayMutation.isPending || processingInProgress}
                  >
                    <ChevronRight className="w-5 h-5 mr-2" />
                    {processingInProgress ? 'Processing Games...' : 'Advance One Day'}
                  </Button>

                  <Button
                    onClick={() => resetSeasonMutation.mutate()}
                    size="sm"
                    variant="outline"
                    className="w-full"
                    disabled={resetSeasonMutation.isPending}
                  >
                    <RotateCcw className="w-4 h-4 mr-2" />
                    Reset to September 1, 2024
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Season Stats */}
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Season Progress</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Games Completed</span>
                  <span className="font-medium">{totalGamesProcessed} / {totalGames}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Progress</span>
                  <span className="font-medium">{getProgressPercentage()}%</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Current Week</span>
                  <span className="font-medium">Week {currentWeek}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Status</span>
                  <Badge variant={processingInProgress ? "default" : "secondary"}>
                    {processingInProgress ? "Processing" : "Ready"}
                  </Badge>
                </div>
                
                {/* Progress Bar */}
                <div className="space-y-2">
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>Season Progress</span>
                    <span>{getProgressPercentage()}%</span>
                  </div>
                  <div className="w-full bg-secondary rounded-full h-2">
                    <div 
                      className="bg-primary h-2 rounded-full transition-all duration-300"
                      style={{ width: `${getProgressPercentage()}%` }}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}