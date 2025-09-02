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
import { apiRequest } from "@/features/query/api";
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
  
  // CLIENT HYGIENE: Prevent double-clicks and noise
  const [starting, setStarting] = useState(false);

  // CLIENT HYGIENE: Improved start draft function with double-click protection
  const onStartDraft = async () => {
    if (starting) {
      console.log('[StartDraft] ⚠️ Already starting, ignoring duplicate click');
      return;
    }
    setStarting(true);
    try {
      console.log('[StartDraft] ✅ Starting draft for league:', leagueId);
      
      const response = await fetch(`/api/leagues/${leagueId}/draft/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include'
      });
      
      if (!response.ok) {
        const errorText = await response.text().catch(() => "");
        throw new Error(errorText || `Failed to start draft (${response.status})`);
      }
      
      const data = await response.json();
      console.log('[StartDraft] ✅ Draft response:', data);
      
      // CRITICAL: Update stores BEFORE navigation logic relies on draftId
      queryClient.setQueryData(['/api/user/leagues'], (oldLeagues: any) => {
        if (!oldLeagues) return oldLeagues;
        
        return oldLeagues.map((league: any) => {
          if (league.id === leagueId) {
            return {
              ...league,
              draftId: data.draftId,
              draftStarted: true,
              draftStatus: data.status
            };
          }
          return league;
        });
      });
      
      // Update draft info cache
      queryClient.setQueryData(['/api/drafts/league', leagueId], {
        draft: {
          id: data.draftId,
          status: data.status,
          leagueId: leagueId
        },
        ...data.state
      });
      
      console.log('[StartDraft] ✅ Store updated with draft info before navigation');
      console.log('[StartDraft] 🚀 NAVIGATING to draft room:', leagueId);
      
      // Navigate to draft room using league ID (consistent with our useSmartRedirect logic)
      setLocation(`/draft/${leagueId}`, { replace: true });
      
      toast({
        title: "Draft started!",
        description: data.message || "The live draft is now beginning. Good luck!",
      });
      
      if (onDraftStarted) {
        onDraftStarted();
      }
      
      return data;
    } catch (error: any) {
      toast({
        title: "Failed to start draft",
        description: error.message || "Failed to start draft",
        variant: "destructive",
      });
      throw error;
    } finally {
      setStarting(false);
    }
  };

  // Start draft mutation using the proper league-based endpoint
  const startDraftMutation = useMutation({
    mutationFn: onStartDraft,
    // Success and error handling moved to onStartDraft function for better control
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
              onClick={() => startDraftMutation.mutate()}
              disabled={startDraftMutation.isPending || starting}
              className="w-full"
              size="lg"
            >
              <Play className="w-4 h-4 mr-2" />
              {(startDraftMutation.isPending || starting) ? 'Starting Draft...' : 'Start Draft Now'}
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
                disabled={startDraftMutation.isPending || starting}
                className="flex-1"
                size="lg"
              >
                <Play className="w-4 h-4 mr-2" />
                {(startDraftMutation.isPending || starting) ? 'Starting...' : 'Start Draft'}
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