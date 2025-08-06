import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Play, Settings, Users, Clock, RotateCcw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { useLocation } from "wouter";

interface DraftControlsProps {
  leagueId: string;
  canCreateDraft: boolean;
  canStartDraft: boolean;
  draftId?: string;
  onDraftCreated?: (draftId: string) => void;
  onDraftStarted?: () => void;
}

export default function DraftControls({
  leagueId,
  canCreateDraft,
  canStartDraft,
  draftId,
  onDraftCreated,
  onDraftStarted
}: DraftControlsProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();
  
  const [showSettings, setShowSettings] = useState(false);
  const [pickTimeLimit, setPickTimeLimit] = useState(60);
  const totalRounds = 5; // Fixed to 5 rounds for 6-person leagues

  // Combined create and start draft mutation
  const createAndStartDraftMutation = useMutation({
    mutationFn: async () => {
      // If draft already exists, just start it
      if (draftId) {
        const startResponse = await fetch(`/api/drafts/${draftId}/start`, {
          method: 'POST',
          credentials: 'include'
        });
        
        if (!startResponse.ok) {
          const error = await startResponse.json();
          throw new Error(error.message || 'Failed to start existing draft');
        }
        
        return { draftId };
      }
      
      // Otherwise create and start new draft
      const createResponse = await fetch('/api/drafts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          leagueId,
          totalRounds,
          pickTimeLimit
        }),
        credentials: 'include'
      });
      
      if (!createResponse.ok) {
        const error = await createResponse.json();
        throw new Error(error.message || 'Failed to create draft');
      }
      
      const createData = await createResponse.json();
      const newDraftId = createData.draft.id;
      
      // Then immediately start the draft
      const startResponse = await fetch(`/api/drafts/${newDraftId}/start`, {
        method: 'POST',
        credentials: 'include'
      });
      
      if (!startResponse.ok) {
        const error = await startResponse.json();
        throw new Error(error.message || 'Failed to start draft');
      }
      
      return { ...createData, draftId: newDraftId };
    },
    onSuccess: (data) => {
      toast({
        title: "Draft started!",
        description: "The live draft is now beginning. Good luck!",
      });
      queryClient.invalidateQueries({ queryKey: ['league', leagueId] });
      queryClient.invalidateQueries({ queryKey: ['draft', data.draftId] });
      if (onDraftStarted) {
        onDraftStarted();
      }
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to start draft",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Legacy start draft mutation (for existing drafts)
  const startDraftMutation = useMutation({
    mutationFn: async () => {
      if (!draftId) throw new Error('No draft ID');
      const response = await fetch(`/api/drafts/${draftId}/start`, {
        method: 'POST',
        credentials: 'include'
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to start draft');
      }
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Draft started!",
        description: "The live draft is now beginning. Good luck!",
      });
      queryClient.invalidateQueries({ queryKey: ['draft', draftId] });
      if (onDraftStarted) { onDraftStarted(); }
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to start draft",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // SEAMLESS RESET: Create new draft and auto-navigate to it
  const resetDraftMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch('/api/testing/reset-draft', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ leagueId }),
        credentials: 'include'
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to reset draft');
      }
      
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Draft Reset Complete!",
        description: "New draft created with fresh timer. Joining draft room...",
      });
      
      // Invalidate all relevant queries
      queryClient.invalidateQueries({ queryKey: ['league', leagueId] });
      queryClient.invalidateQueries({ queryKey: ['draft'] });
      
      // Automatically navigate to the new draft room
      setTimeout(() => {
        setLocation(`/draft/${data.draftId}`);
      }, 1000);
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to reset draft",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Show the component if we can create a new draft OR start an existing one
  if (!canCreateDraft && !canStartDraft) {
    return null;
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center space-x-2">
          <Settings className="w-5 h-5" />
          <span>Draft Management</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        
        {canCreateDraft && (
          <>
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Draft Setup</span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowSettings(!showSettings)}
              >
                <Settings className="w-4 h-4 mr-2" />
                Settings
              </Button>
            </div>

            {showSettings && (
              <div className="space-y-4 p-4 bg-secondary/50 rounded-lg">
                <div className="space-y-4">
                  <div>
                    <Label className="text-sm">
                      Total Rounds
                    </Label>
                    <div className="text-sm text-muted-foreground mt-1">
                      Fixed at 5 rounds for 6-person leagues
                    </div>
                  </div>
                  
                  <div>
                    <Label htmlFor="pickTimeLimit" className="text-sm">
                      Pick Timer (seconds)
                    </Label>
                    <Select 
                      value={pickTimeLimit.toString()} 
                      onValueChange={(value) => setPickTimeLimit(Number(value))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="30">30 seconds</SelectItem>
                        <SelectItem value="60">60 seconds</SelectItem>
                        <SelectItem value="90">90 seconds</SelectItem>
                        <SelectItem value="120">2 minutes</SelectItem>
                        <SelectItem value="180">3 minutes</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="text-xs text-muted-foreground space-y-1">
                  <div className="flex items-center space-x-2">
                    <Users className="w-3 h-3" />
                    <span>Each user drafts {totalRounds} teams</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Clock className="w-3 h-3" />
                    <span>{pickTimeLimit}s timer per pick (auto-pick on timeout)</span>
                  </div>
                </div>
              </div>
            )}

            <Button
              onClick={() => createAndStartDraftMutation.mutate()}
              disabled={createAndStartDraftMutation.isPending}
              className="w-full"
              size="lg"
            >
              <Play className="w-4 h-4 mr-2" />
              {createAndStartDraftMutation.isPending ? 'Starting Draft...' : 'Start Draft Now'}
            </Button>
          </>
        )}

        {canStartDraft && draftId && (
          <div className="space-y-3">
            <div className="flex items-center space-x-2">
              <Badge variant="secondary" className="text-xs">
                Draft Ready
              </Badge>
              <span className="text-sm text-muted-foreground">
                Ready to begin live draft
              </span>
            </div>
            
            <div className="flex space-x-2">
              <Button
                onClick={() => startDraftMutation.mutate()}
                disabled={startDraftMutation.isPending}
                className="flex-1"
                size="lg"
              >
                <Play className="w-4 h-4 mr-2" />
                {startDraftMutation.isPending ? 'Starting...' : 'Start Draft'}
              </Button>
              
              <Button
                onClick={() => resetDraftMutation.mutate()}
                disabled={resetDraftMutation.isPending}
                variant="outline"
                size="lg"
                className="px-3"
                title="Reset Draft - Creates new draft with fresh timer"
              >
                <RotateCcw className="w-4 h-4" />
              </Button>
            </div>
          </div>
        )}

        {/* Reset option for existing drafts without start capability */}
        {draftId && !canStartDraft && (
          <div className="space-y-3">
            <div className="flex items-center space-x-2">
              <Badge variant="outline" className="text-xs">
                Draft Active
              </Badge>
              <span className="text-sm text-muted-foreground">
                Draft is currently in progress
              </span>
            </div>
            
            <Button
              onClick={() => resetDraftMutation.mutate()}
              disabled={resetDraftMutation.isPending}
              variant="outline"
              className="w-full"
              size="lg"
            >
              <RotateCcw className="w-4 h-4 mr-2" />
              {resetDraftMutation.isPending ? 'Resetting...' : 'Reset Draft'}
            </Button>
          </div>
        )}

      </CardContent>
    </Card>
  );
}