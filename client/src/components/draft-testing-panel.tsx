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
import { useAuth } from "@/features/auth/useAuth";
import { apiFetch } from "@/lib/api";
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
import type { ConnectionStatus } from "@/draft/draft-types";


interface DraftTestingPanelProps {
  leagueId: string;
  draftId?: string;
  isCreator: boolean;
  connectionStatus: ConnectionStatus;
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
  const { isAuthenticated } = useAuth();
  const queryClient = useQueryClient();
  const [isExpanded, setIsExpanded] = useState(false);

  // Add robots to league mutation
  const addRobotsMutation = useMutation({
    mutationFn: async () => {
      const response = await apiFetch(`/api/leagues/${leagueId}/add-robots`, {
        method: 'POST',
      });
      
      if (!response.ok) {
        const error = await response.text();
        throw new Error(error || 'Failed to add robots');
      }
      
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Robots Added",
        description: "5 robot users have been added to the league for testing.",
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
      const response = await apiFetch('/api/testing/reset-draft', {
        method: 'POST',
        body: JSON.stringify({ leagueId }),
      });
      
      if (!response.ok) {
        const error = await response.text();
        throw new Error(error || 'Failed to reset draft');
      }
      
      return response.json();
    },
    onSuccess: async (data) => {
      console.log('[Reset] Success response:', data);
      
      // Nuclear cache clearing - remove everything
      queryClient.removeQueries({ queryKey: [`/api/leagues/${leagueId}`] });
      queryClient.removeQueries({ queryKey: ['/api/leagues/user'] });
      
      toast({
        title: "Draft Reset Complete!",
        description: `New draft created: ${data?.draftId || 'Unknown ID'}. Ready to start manually.`,
      });
      
      console.log('[Reset] Successfully reset draft, new draft ID:', data?.draftId);
      
      // Immediate cache refresh with forced refetch
      const freshData = await queryClient.fetchQuery({
        queryKey: [`/api/leagues/${leagueId}`],
        queryFn: async () => {
          const response = await fetch(`/api/leagues/${leagueId}`, {
            credentials: 'include'
          });
          if (!response.ok) throw new Error('Failed to fetch');
          return response.json();
        }
      });
      
      console.log('[Reset] Fresh data fetched, new draft ID:', freshData?.draftId);
      
      // Force immediate cache invalidation and refetch
      queryClient.invalidateQueries({ queryKey: [`/api/leagues/${leagueId}`] });
      
      // Small delay to ensure cache propagation before triggering onReset
      setTimeout(() => {
        onReset?.();
      }, 200);
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
        {/* Enhanced Connection & Draft Status */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              {getConnectionIcon()}
              <span className="text-sm text-muted-foreground">
                WebSocket Status
              </span>
            </div>
            {getConnectionStatus()}
          </div>
          
          {/* Draft ID Information */}
          <div className="bg-muted p-2 rounded text-xs space-y-1">
            <div><strong>Current Draft ID:</strong> {draftId || 'None'}</div>
            <div><strong>Socket Connected To:</strong> {draftId && connectionStatus === 'connected' ? draftId : 'Not connected'}</div>
            <div><strong>League ID:</strong> {leagueId}</div>
            <div><strong>Connection Status:</strong> {connectionStatus}</div>
            <div className="text-yellow-600"><strong>Debug:</strong> Prop received: {draftId ? `"${draftId}"` : 'null/undefined'}</div>
          </div>
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
                disabled={!isAuthenticated || addRobotsMutation.isPending}
                variant="outline"
                size="sm"
                className="w-full"
              >
                <Users className="w-4 h-4 mr-2" />
                {addRobotsMutation.isPending ? 'Adding...' : 'Add 5 Robot Users'}
              </Button>
              
              <p className="text-xs text-muted-foreground">
                Adds all 5 robot users to the league for testing. They will auto-draft 15 seconds into their timer.
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
                {resetDraftMutation.isPending ? 'Resetting...' : 'Reset Draft (Create New, Don\'t Start)'}
              </Button>
              
              <p className="text-xs text-muted-foreground">
                Creates a new draft but doesn't start it. The draft will be ready for manual start via "Start Draft" button.
              </p>
            </div>

            <Separator />
            
            {/* Draft Status Diagnostics */}
            <div className="space-y-3">
              <h4 className="text-sm font-semibold flex items-center space-x-2">
                <Settings className="w-4 h-4" />
                <span>Draft Diagnostics</span>
              </h4>
              
              <Button
                onClick={() => {
                  // Force refresh current draft status
                  queryClient.invalidateQueries({ queryKey: ['/api/leagues/user'] });
                  queryClient.invalidateQueries({ queryKey: [`/api/leagues/${leagueId}`] });
                  if (draftId) {
                    queryClient.invalidateQueries({ queryKey: ['draft', draftId] });
                  }
                  toast({
                    title: "Refreshed",
                    description: "Draft status and league data refreshed from server",
                  });
                }}
                variant="outline"
                size="sm"
                className="w-full"
              >
                <Timer className="w-4 h-4 mr-2" />
                Refresh Draft Status
              </Button>
              
              <div className="text-xs space-y-1">
                <div><strong>Expected Flow:</strong></div>
                <div>1. Reset Draft → Creates new draft ID (not_started)</div>
                <div>2. Start Draft → Changes status to "active", starts timer</div>
                <div>3. WebSocket connects to active draft automatically</div>
              </div>
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