/**
 * Draft Testing Panel
 * 
 * Provides comprehensive testing controls for draft functionality:
 * - Add/remove robot users to leagues
 * - Reset draft state for testing
 * - Manual timer controls
 * - Connection status monitoring
 */

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { 
  Bot, 
  RotateCcw, 
  Wifi, 
  WifiOff, 
  Timer, 
  Users, 
  Play,
  Pause,
  Settings
} from "lucide-react";
import { apiRequest } from "@/lib/queryClient";

interface DraftTestingPanelProps {
  leagueId: string;
  draftId?: string;
  isCreator: boolean;
  connectionStatus: 'connecting' | 'connected' | 'disconnected';
  onReset?: () => void;
}

export function DraftTestingPanel({ 
  leagueId, 
  draftId, 
  isCreator, 
  connectionStatus,
  onReset 
}: DraftTestingPanelProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isExpanded, setIsExpanded] = useState(false);

  // Add robots to league mutation
  const addRobotsMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest(`/api/leagues/${leagueId}/add-robots`, {
        method: 'POST'
      });
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Robots Added",
        description: "4 robot users have been added to the league for testing.",
      });
      queryClient.invalidateQueries({ queryKey: [`/api/leagues/${leagueId}`] });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to add robots",
        description: error.message,
        variant: "destructive",
      });
    }
  });

  // Reset draft mutation
  const resetDraftMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest(`/api/draft/reset/${leagueId}`, {
        method: 'POST'
      });
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Draft Reset",
        description: "Draft has been reset to pre-draft state. You can now create a new draft.",
      });
      queryClient.invalidateQueries({ queryKey: [`/api/leagues/${leagueId}`] });
      onReset?.();
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to reset draft",
        description: error.message,
        variant: "destructive",
      });
    }
  });

  const getConnectionIcon = () => {
    switch (connectionStatus) {
      case 'connected':
        return <Wifi className="w-4 h-4 text-green-500" />;
      case 'connecting':
        return <Wifi className="w-4 h-4 text-yellow-500 animate-pulse" />;
      case 'disconnected':
        return <WifiOff className="w-4 h-4 text-red-500" />;
    }
  };

  const getConnectionStatus = () => {
    switch (connectionStatus) {
      case 'connected':
        return <Badge variant="secondary" className="text-green-700 bg-green-100">Connected</Badge>;
      case 'connecting':
        return <Badge variant="secondary" className="text-yellow-700 bg-yellow-100">Connecting...</Badge>;
      case 'disconnected':
        return <Badge variant="destructive">Disconnected</Badge>;
    }
  };

  if (!isCreator) {
    // Show minimal status for non-creators
    return (
      <Card className="border-dashed">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              {getConnectionIcon()}
              <span className="text-sm text-muted-foreground">
                Real-time Connection
              </span>
            </div>
            {getConnectionStatus()}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-dashed border-orange-200">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center space-x-2">
            <Settings className="w-5 h-5" />
            <span>Testing Panel</span>
          </CardTitle>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsExpanded(!isExpanded)}
          >
            {isExpanded ? 'Collapse' : 'Expand'}
          </Button>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Connection Status */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            {getConnectionIcon()}
            <span className="text-sm text-muted-foreground">
              WebSocket Status
            </span>
          </div>
          {getConnectionStatus()}
        </div>

        {isExpanded && (
          <>
            <Separator />
            
            {/* Robot Management */}
            <div className="space-y-3">
              <h4 className="text-sm font-semibold flex items-center space-x-2">
                <Bot className="w-4 h-4" />
                <span>Robot Users</span>
              </h4>
              
              <Button
                onClick={() => addRobotsMutation.mutate()}
                disabled={addRobotsMutation.isPending}
                variant="outline"
                size="sm"
                className="w-full"
              >
                <Users className="w-4 h-4 mr-2" />
                {addRobotsMutation.isPending ? 'Adding...' : 'Add 4 Robot Users'}
              </Button>
              
              <p className="text-xs text-muted-foreground">
                Adds Alpha Bot, Beta Bot, Gamma Bot, and Delta Bot to the league for testing draft functionality.
              </p>
            </div>

            <Separator />
            
            {/* Draft Controls */}
            <div className="space-y-3">
              <h4 className="text-sm font-semibold flex items-center space-x-2">
                <Timer className="w-4 h-4" />
                <span>Draft Controls</span>
              </h4>
              
              <Button
                onClick={() => resetDraftMutation.mutate()}
                disabled={resetDraftMutation.isPending}
                variant="destructive"
                size="sm"
                className="w-full"
              >
                <RotateCcw className="w-4 h-4 mr-2" />
                {resetDraftMutation.isPending ? 'Resetting...' : 'Reset Draft State'}
              </Button>
              
              <p className="text-xs text-muted-foreground">
                Completely resets the league draft state. Clears all picks and allows creating a fresh draft.
              </p>
            </div>

            <Separator />
            
            {/* Testing Notes */}
            <div className="space-y-2">
              <h4 className="text-sm font-semibold">Testing Notes</h4>
              <div className="text-xs text-muted-foreground space-y-1">
                <div>• League EEW2YU is set up for testing</div>
                <div>• Mok user will test auto-draft timeouts</div>
                <div>• Sky Evans will test manual picks</div>
                <div>• Robots will auto-pick with realistic delays</div>
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}