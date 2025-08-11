import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Play, Pause, RotateCcw, Clock } from "lucide-react";
import { useLocation } from "wouter";

export default function AdminPanel() {
  const [, navigate] = useLocation();
  const [isRunning, setIsRunning] = useState(false);
  const [time, setTime] = useState(0); // Time in seconds
  const [intervalId, setIntervalId] = useState<NodeJS.Timeout | null>(null);

  // Format time as MM:SS
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Start/Stop timer
  const toggleTimer = () => {
    if (isRunning) {
      // Stop timer
      if (intervalId) {
        clearInterval(intervalId);
        setIntervalId(null);
      }
      setIsRunning(false);
    } else {
      // Start timer
      const id = setInterval(() => {
        setTime(prevTime => prevTime + 1);
      }, 1000);
      setIntervalId(id);
      setIsRunning(true);
    }
  };

  // Reset timer
  const resetTimer = () => {
    if (intervalId) {
      clearInterval(intervalId);
      setIntervalId(null);
    }
    setTime(0);
    setIsRunning(false);
  };

  // Cleanup interval on unmount
  useEffect(() => {
    return () => {
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, [intervalId]);

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
              <h1 className="text-2xl font-bold">Admin Panel</h1>
            </div>
          </div>
        </div>

        {/* Stopwatch Card */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-center">Stopwatch</CardTitle>
          </CardHeader>
          <CardContent className="text-center space-y-6">
            {/* Time Display */}
            <div className="text-6xl font-mono font-bold text-blue-600 dark:text-blue-400">
              {formatTime(time)}
            </div>

            {/* Controls */}
            <div className="flex justify-center space-x-4">
              <Button
                onClick={toggleTimer}
                size="lg"
                variant={isRunning ? "destructive" : "default"}
                className="w-32"
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
                onClick={resetTimer}
                size="lg"
                variant="outline"
                className="w-32"
              >
                <RotateCcw className="w-5 h-5 mr-2" />
                Reset
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Status */}
        <div className="text-center text-sm text-muted-foreground">
          Timer is {isRunning ? 'running' : 'stopped'}
        </div>
      </div>
    </div>
  );
}