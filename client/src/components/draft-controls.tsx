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
  const [pickTimeLimit, setPickTimeLimit] = useState(120); // Default 2 minutes to match server
  const totalRounds = 5; // Fixed to 5 rounds for 6-person leagues

  // Combined create and start draft mutation
  const createAndStartDraftMutation = useMutation({
    mutationFn: async () => {
      console.log('[StartDraft] ✅ ALWAYS CREATING COMPLETELY NEW DRAFT for league:', leagueId);
      console.log('[StartDraft] ✅ Ignoring any existing draft - creating fresh one');
      
      // Clear ALL cached data first - critical for clean state
      queryClient.clear();
      console.log('[StartDraft] ✅ Cleared all cached data before creating new draft');
      
      // ALWAYS create a brand new draft (ignore any existing draftId)
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
      
      console.log('[StartDraft] ✅ NEW DRAFT CREATED:', newDraftId);
      
      // Then immediately start the draft
      const startResponse = await fetch(`/api/drafts/${newDraftId}/start`, {
        method: 'POST',
        credentials: 'include'
      });
      
      if (!startResponse.ok) {
        const error = await startResponse.json();
        throw new Error(error.message || 'Failed to start draft');
      }
      
      console.log('[StartDraft] ✅ NEW DRAFT STARTED with timer system - Ready for WebSocket');
      return { ...createData, draftId: newDraftId };
    },
    onSuccess: (data) => {
      console.log('[StartDraft] ✅ SUCCESS - New draft ready:', data.draftId);
      
      toast({
        title: "Draft started!",
        description: "The live draft is now beginning. Good luck!",
      });
      
      // Clear cache and prepare for new draft
      queryClient.clear();
      queryClient.invalidateQueries({ queryKey: ['league', leagueId] });
      queryClient.invalidateQueries({ queryKey: ['draft', data.draftId] });
      queryClient.invalidateQueries({ queryKey: ['/api/leagues'] });
      
      console.log('[StartDraft] ✅ All systems ready for WebSocket connection to:', data.draftId);
      console.log('[StartDraft] 🚀 NAVIGATING to new draft immediately:', data.draftId);
      
      // Navigate to the new draft immediately
      setTimeout(() => {
        window.location.href = `/draft/${data.draftId}`;
      }, 100);
      
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
        description: "New draft created with fresh timer. Clearing caches and connecting...",
      });
      
      // COMPREHENSIVE CACHE INVALIDATION FOR SEAMLESS RESET
      console.log('[DraftReset] ✅ COMPLETE DATA CLEARING - Removing ALL old draft references...');
      console.log('[DraftReset] 🔍 VALIDATION: queryClient.clear() will purge all cached queries');
      
      // Clear ALL draft-related queries and cache - VERIFIED to purge all cached data
      queryClient.clear(); // Nuclear option - clears everything including draft, league, API responses
      queryClient.invalidateQueries({ queryKey: ['league', leagueId] });
      queryClient.invalidateQueries({ queryKey: ['draft'] });
      queryClient.removeQueries({ queryKey: ['/api/drafts'] });
      queryClient.removeQueries({ queryKey: ['/api/leagues'] });
      
      console.log('[DraftReset] ✅ All cached draft data cleared completely');
      console.log('[DraftReset] 🔍 VALIDATION: All TanStack queries purged from cache');
      
      // Force service worker cache refresh for fresh assets
      if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
        console.log('[DraftReset] Triggering service worker cache refresh...');
        navigator.serviceWorker.controller.postMessage({
          type: 'FORCE_CACHE_REFRESH',
          reason: 'draft_reset_button',
          newDraftId: data.draftId,
          timestamp: Date.now()
        });
      }
      
      // FIX #3: COMPREHENSIVE SERVICE WORKER CLEANUP
      console.log('[DraftReset] 🔍 PLATFORM-LEVEL CLEANUP: Service Worker interference prevention');
      
      // Perform comprehensive cleanup without blocking
      import('@/utils/service-worker-cleanup').then(async ({ ServiceWorkerManager }) => {
        try {
          await ServiceWorkerManager.performCompleteCleanup();
          console.log('[DraftReset] ✅ Service Worker cleanup complete');
        } catch (swError) {
          console.log('[DraftReset] Service Worker cleanup completed with warnings:', swError);
        }
      });
      
      if ('caches' in window) {
        caches.keys().then(cacheNames => {
          cacheNames.forEach(cacheName => {
            if (cacheName.includes('draft') || cacheName.includes('api')) {
              console.log('[DraftReset] ✅ CLEARING Service Worker cache:', cacheName);
              caches.delete(cacheName);
            }
          });
        });
      }
      
      // Clear localStorage/sessionStorage if used for draft data
      if (typeof Storage !== 'undefined') {
        const keysToRemove = [];
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key && (key.includes('draft') || key.includes('websocket'))) {
            keysToRemove.push(key);
          }
        }
        keysToRemove.forEach(key => {
          console.log('[DraftReset] ✅ CLEARING localStorage key:', key);
          localStorage.removeItem(key);
        });
        
        // Clear sessionStorage as well
        const sessionKeysToRemove = [];
        for (let i = 0; i < sessionStorage.length; i++) {
          const key = sessionStorage.key(i);
          if (key && (key.includes('draft') || key.includes('websocket'))) {
            sessionKeysToRemove.push(key);
          }
        }
        sessionKeysToRemove.forEach(key => {
          console.log('[DraftReset] ✅ CLEARING sessionStorage key:', key);
          sessionStorage.removeItem(key);
        });
      }
      
      // Clear all cached data first to prevent stale state
      queryClient.clear();
      
      // Automatically navigate to the new draft room with cache busting
      const navigationUrl = `/draft/${data.draftId}?reset=${Date.now()}`;
      console.log('[DraftReset] 🚀 IMMEDIATE NAVIGATION to new draft:', data.draftId);
      
      // Force page reload to ensure completely clean state for WebSocket connection
      window.location.href = navigationUrl;
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