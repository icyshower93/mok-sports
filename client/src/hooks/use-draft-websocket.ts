/**
 * Draft WebSocket Hook
 * 
 * Provides real-time draft synchronization via WebSocket connection:
 * - Automatic reconnection on disconnect
 * - Pick notifications and timer updates
 * - Draft state persistence across page reloads
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from './use-auth';
import { useToast } from './use-toast';

export interface DraftWebSocketMessage {
  type: 'pick_made' | 'timer_update' | 'draft_state' | 'auto_pick' | 'draft_completed' | 'connected' | 'pong';
  draftId: string;
  data?: any;
  timestamp: number;
}

export function useDraftWebSocket(draftId: string | null, leagueId?: string | null) {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'disconnected' | 'draft_not_found'>('disconnected');
  const [lastMessage, setLastMessage] = useState<DraftWebSocketMessage | null>(null);
  const previousDraftIdRef = useRef<string | null>(null);

  const connect = useCallback(() => {
    console.log('[WebSocket] 🔄 LIFECYCLE: Connect called with:', { 
      draftId, 
      userId: user?.id, 
      userLoaded: !!user,
      wsState: wsRef.current?.readyState,
      previousDraftId: previousDraftIdRef.current
    });
    
    // FIX #1: WEBSOCKET LIFECYCLE - Ensure only ONE WebSocket per draft session
    console.log('[WebSocket] 🔍 LIFECYCLE CHECK: Validating single connection per session');
    
    if (!draftId) {
      console.log('[WebSocket] ❌ LIFECYCLE: Connect skipped - No draft ID provided');
      return;
    }
    
    if (!user?.id) {
      console.log('[WebSocket] ❌ LIFECYCLE: Connect skipped - No user ID available (auth not loaded)');
      return;
    }
    
    // FIX #1: Prevent duplicate connections - close any existing before creating new
    if (wsRef.current) {
      console.log('[WebSocket] 🔄 LIFECYCLE: Existing WebSocket found (state:', wsRef.current.readyState, ') - closing cleanly');
      wsRef.current.close(1000, 'Creating new connection');
      wsRef.current = null;
    }
    
    console.log('[WebSocket] ✅ LIFECYCLE: All requirements met, creating single WebSocket instance');
    console.log('[WebSocket] 🔍 VALIDATION: Draft ID:', draftId, 'length:', draftId?.length);
    console.log('[WebSocket] 🔍 VALIDATION: User ID:', user.id, 'length:', user.id?.length);

    // FIX #1: CLEAN DRAFT TRANSITIONS - No stale WebSocket instances
    if (previousDraftIdRef.current && previousDraftIdRef.current !== draftId) {
      console.log('[WebSocket] 🔄 DRAFT TRANSITION: Draft changed - ensuring clean connection transition');
      console.log('[WebSocket] 🔍 TRANSITION: Old draft ID:', previousDraftIdRef.current);
      console.log('[WebSocket] 🔍 TRANSITION: New draft ID:', draftId);
      
      if (wsRef.current && wsRef.current.readyState !== undefined) {
        console.log('[WebSocket] 🔄 TRANSITION: Closing old connection cleanly for new draft');
        if (wsRef.current.readyState === WebSocket.OPEN) {
          wsRef.current.close(1000, 'Draft changed - clean transition');
        }
        wsRef.current = null;
      }
      
      // FIX #2: Clear server-side state references
      if (reconnectTimeoutRef.current) {
        console.log('[WebSocket] 🔄 TRANSITION: Clearing reconnection timers for old draft');
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
      
      // COMPREHENSIVE CACHE INVALIDATION FOR DRAFT RESET
      console.log('[WebSocket] Clearing all cached draft data for reset...');
      
      // Clear all draft-related cache entries
      queryClient.removeQueries({ queryKey: [`/api/drafts/${previousDraftIdRef.current}`] });
      queryClient.removeQueries({ queryKey: [`/api/drafts/${previousDraftIdRef.current}/picks`] });
      queryClient.removeQueries({ queryKey: [`/api/drafts/${previousDraftIdRef.current}/timer`] });
      queryClient.removeQueries({ queryKey: [`/api/drafts/${previousDraftIdRef.current}/status`] });
      
      // Clear new draft cache to force fresh data
      queryClient.removeQueries({ queryKey: [`/api/drafts/${draftId}`] });
      queryClient.removeQueries({ queryKey: [`/api/drafts/${draftId}/picks`] });
      queryClient.removeQueries({ queryKey: [`/api/drafts/${draftId}/timer`] });
      queryClient.removeQueries({ queryKey: [`/api/drafts/${draftId}/status`] });
      
      // Invalidate league cache to get updated draft ID
      queryClient.invalidateQueries({ queryKey: ['/api/leagues'] });
      
      // Force service worker to update caches
      if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
        console.log('[WebSocket] Triggering service worker cache refresh for draft reset');
        navigator.serviceWorker.controller.postMessage({
          type: 'FORCE_CACHE_REFRESH',
          reason: 'draft_reset',
          timestamp: Date.now()
        });
      }
      
      // Force connection status reset
      setConnectionStatus('disconnected');
      console.log('[WebSocket] Connection status reset and cache cleared for new draft');
    }
    
    previousDraftIdRef.current = draftId;

    // PERMANENT FIX: Always connect immediately after draft reset/changes
    console.log('[WebSocket] Connecting to draft immediately after reset/change...');
    setConnectionStatus('connecting');
    
    // Connect immediately - don't wait for validation
    connectToWebSocket();
  }, [draftId, user?.id, queryClient]);
  
  // CRITICAL: Trigger connection when both draft ID and user are available
  useEffect(() => {
    console.log('[WebSocket] useEffect trigger - draftId:', !!draftId, 'userId:', !!user?.id, 'authLoading:', !user);
    
    if (draftId && user?.id) {
      console.log('[WebSocket] ✅ Conditions met, attempting connection...');
      connect();
    } else {
      console.log('[WebSocket] ❌ Connection requirements not met:', {
        hasDraftId: !!draftId,
        hasUserId: !!user?.id,
        userObject: !!user
      });
    }
  }, [draftId, user?.id, connect]);

  const connectToWebSocket = useCallback(() => {
    console.log('[WebSocket] === STARTING NEW CONNECTION ATTEMPT ===');
    console.log('[WebSocket] Draft ID:', draftId, 'User ID:', user?.id);
    console.log('[WebSocket] Current wsRef state:', !!wsRef.current);
    
    // Prevent multiple concurrent connections
    if (wsRef.current && wsRef.current.readyState === WebSocket.CONNECTING) {
      console.log('[WebSocket] Connection already in progress, skipping');
      return;
    }
    
    // Clean close existing connection
    if (wsRef.current) {
      console.log('[WebSocket] Closing existing connection before creating new one');
      wsRef.current.close(1000, 'Creating new connection');
      wsRef.current = null;
    }
    
    // PERMANENT FIX: Enhanced URL handling for Reserved VM deployments
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    let wsHost = window.location.host;
    
    // Handle Reserved VM deployment URL rewriting if needed
    if (wsHost.includes('.replit.app') || wsHost.includes('.repl.co') || wsHost.includes('.replit.dev')) {
      console.log('[WebSocket] Detected Replit deployment domain:', wsHost);
    }
    
    const wsUrl = `${protocol}//${wsHost}/draft-ws?userId=${encodeURIComponent(user!.id)}&draftId=${encodeURIComponent(draftId || '')}`;
    
    console.log('[WebSocket] ========== CREATING NEW CONNECTION ==========');
    console.log('[WebSocket] URL:', wsUrl);
    console.log('[WebSocket] Draft ID:', draftId);
    console.log('[WebSocket] User ID:', user!.id);
    console.log('[WebSocket] Protocol:', protocol);
    console.log('[WebSocket] Host:', wsHost);
    console.log('[WebSocket] Timestamp:', new Date().toISOString());
    console.log('[WebSocket] ==============================================');
    
    try {
      // FIX #4: Create WebSocket with explicit subprotocol for Replit proxy compatibility
      const ws = new WebSocket(wsUrl, ['draft-protocol']);
      wsRef.current = ws;
      
      console.log('[WebSocket] 🔄 LIFECYCLE: WebSocket object created with Replit compatibility, readyState:', ws.readyState);
    } catch (error) {
      console.error('[WebSocket] Failed to create WebSocket:', error);
      setConnectionStatus('disconnected');
      return;
    }
    
    const ws = wsRef.current;

    // Store reference for cleanup
    let heartbeatTimer: NodeJS.Timeout | null = null;

    ws.onopen = () => {
      console.log('🚀 [WebSocket] CONNECTION OPENED SUCCESSFULLY');
      console.log('🔍 [WebSocket] LIFECYCLE EVENT: Connection Open');
      console.log('🔍 [WebSocket] Draft ID:', draftId);
      console.log('🔍 [WebSocket] User ID:', user?.id);
      console.log('🔍 [WebSocket] Ready state:', ws.readyState);
      console.log('🔍 [WebSocket] URL:', ws.url);
      console.log('🔍 [WebSocket] Connection timestamp:', new Date().toISOString());
      console.log('🔍 [WebSocket] Browser WebSocket supported:', 'WebSocket' in window);
      console.log('🔍 [WebSocket] Connection protocol:', ws.protocol || 'none');
      
      setConnectionStatus('connected');
      
      // Send initial ping with robust error handling
      try {
        if (ws.readyState === WebSocket.OPEN) {
          const pingMessage = JSON.stringify({
            type: 'ping',
            draftId: draftId,
            userId: user!.id,
            timestamp: Date.now()
          });
          ws.send(pingMessage);
          console.log('🏓 [WebSocket] PING SENT (Initial)');
          console.log('🔍 [WebSocket] PING/PONG: Initial heartbeat sent for draft:', draftId);
        } else {
          console.log('[WebSocket] ❌ Cannot send ping, socket not open:', ws.readyState);
        }
      } catch (error) {
        console.error('[WebSocket] ❌ Failed to send initial ping:', error);
      }

      // Set up heartbeat with cleanup tracking
      heartbeatTimer = setInterval(() => {
        try {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({
              type: 'ping',
              draftId: draftId,
              userId: user!.id,
              timestamp: Date.now()
            }));
            console.log('🏓 [WebSocket] PING SENT (Heartbeat)');
            console.log('🔍 [WebSocket] PING/PONG: Regular heartbeat for draft:', draftId);
          } else {
            console.log('[WebSocket] 💔 Heartbeat stopped - socket not open:', ws.readyState);
            if (heartbeatTimer) {
              clearInterval(heartbeatTimer);
              heartbeatTimer = null;
            }
          }
        } catch (error) {
          console.error('[WebSocket] 💔 Heartbeat failed:', error);
          if (heartbeatTimer) {
            clearInterval(heartbeatTimer);
            heartbeatTimer = null;
          }
        }
      }, 25000);
      
      // Clear any reconnection timeout
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
    };

    ws.onmessage = (event) => {
      console.log('📨 [WebSocket] MESSAGE RECEIVED');
      console.log('🔍 [WebSocket] LIFECYCLE EVENT: Message Received');
      console.log('🔍 [WebSocket] Raw data:', event.data);
      console.log('🔍 [WebSocket] Socket state:', ws.readyState);
      console.log('🔍 [WebSocket] Timestamp:', new Date().toISOString());
      
      try {
        const message: DraftWebSocketMessage = JSON.parse(event.data);
        console.log('🔍 [WebSocket] Draft ID in message:', message.draftId);
        console.log('🔍 [WebSocket] Expected Draft ID:', draftId);
        console.log('🔍 [WebSocket] Message type:', message.type);
        console.log('🔍 [WebSocket] Message timestamp:', message.timestamp);
        console.log('🔍 [WebSocket] Draft ID match:', message.draftId === draftId ? '✅ MATCH' : '❌ MISMATCH');
        
        // Validate draft ID to ensure client/server are talking about same session
        if (message.draftId !== draftId) {
          console.log('⚠️ [WebSocket] DRAFT ID MISMATCH - Server/client talking about different sessions');
          console.log('🔍 [WebSocket] Server draft:', message.draftId);
          console.log('🔍 [WebSocket] Client draft:', draftId);
          return;
        }
        
        // Handle ping/pong explicitly
        if (message.type === 'pong') {
          console.log('🏓 [WebSocket] PONG RECEIVED - Heartbeat acknowledged');
          console.log('🔍 [WebSocket] PING/PONG: Connection healthy');
          return;
        }
        
        // Update last message state
        setLastMessage(message);
        
        // Handle the message
        handleWebSocketMessage(message);
        
        console.log('✅ [WebSocket] Message processed successfully');
      } catch (error) {
        console.error('🚨 [WebSocket] JSON Parse failed:', error);
        console.error('🚨 [WebSocket] Failed data:', event.data);
        console.error('🚨 [WebSocket] Data type:', typeof event.data);
      }
    };

    ws.onclose = (event) => {
      console.log('🔌 [WebSocket] CONNECTION CLOSED');
      console.log('🔍 [WebSocket] LIFECYCLE EVENT: Connection Close');
      console.log('🔍 [WebSocket] Close code:', event.code);
      console.log('🔍 [WebSocket] Close reason:', event.reason);
      console.log('🔍 [WebSocket] Draft ID:', draftId);
      console.log('🔍 [WebSocket] Close was clean:', event.code === 1000);
      console.log('🔍 [WebSocket] WebSocket state before close:', ws.readyState);
      console.log('🔍 [WebSocket] Close timestamp:', new Date().toISOString());
      
      // EXPLICIT CLEANUP: Destroy timers and WebSocket on cleanup
      if (heartbeatTimer) {
        console.log('🧹 [WebSocket] CLEANUP: Clearing heartbeat timer');
        clearInterval(heartbeatTimer);
        heartbeatTimer = null;
      }
      
      setConnectionStatus('disconnected');
      wsRef.current = null;

      // PERMANENT FIX: Enhanced reconnection logic for Reserved VM deployments
      if (event.code !== 1000 && event.reason !== 'Component cleanup' && draftId && user?.id) {
        console.log('[WebSocket] Unexpected disconnection, will attempt reconnect for Reserved VM');
        console.log('[WebSocket] Disconnect code:', event.code, 'reason:', event.reason);
        
        // Validate draft still exists before reconnecting 
        fetch(`/api/drafts/${draftId}`)
          .then(response => {
            if (response.ok) {
              console.log('[WebSocket] Draft validated, proceeding with reconnection');
              reconnectTimeoutRef.current = setTimeout(() => {
                console.log('[WebSocket] Reconnecting after unexpected close...');
                connect();
              }, 1500); // Faster reconnection for Reserved VM
            } else {
              console.log('[WebSocket] Draft no longer exists, stopping reconnection');
              setConnectionStatus('draft_not_found');
            }
          })
          .catch(err => {
            console.error('[WebSocket] Draft validation failed during reconnect:', err);
            // Still attempt reconnection in case it's a temporary network issue
            reconnectTimeoutRef.current = setTimeout(() => {
              console.log('[WebSocket] Reconnecting despite validation error...');
              connect();
            }, 2000);
          });
      } else {
        console.log('[WebSocket] Connection closed cleanly, no reconnection needed');
      }
    };

    ws.onerror = (error) => {
      console.error('[WebSocket] ❌ CONNECTION ERROR DETAILS (Reserved VM):');
      console.error('[WebSocket] Error object:', error);
      console.error('[WebSocket] WebSocket URL:', wsUrl);
      console.error('[WebSocket] Current location:', window.location.href);
      console.error('[WebSocket] User ID:', user?.id);
      console.error('[WebSocket] Draft ID:', draftId);
      console.error('[WebSocket] WebSocket readyState:', (error.target as WebSocket)?.readyState);
      console.error('[WebSocket] Timestamp:', new Date().toISOString());
      setConnectionStatus('disconnected');
      
      // PERMANENT FIX: Enhanced error handling for Reserved VM
      if (window.location.hostname.includes('replit.app')) {
        console.log('[WebSocket] Reserved VM WebSocket failed, attempting single retry before fallback');
        // Attempt one retry before falling back to HTTP polling
        setTimeout(() => {
          if (draftId && user?.id && !wsRef.current) {
            console.log('[WebSocket] Attempting single retry after error...');
            connect();
          }
        }, 2000);
      }
    };
  }, [draftId, user?.id]);

  const handleWebSocketMessage = useCallback((message: DraftWebSocketMessage) => {
    console.log('[WebSocket] 🔍 COMPREHENSIVE DEBUG - Received message:', message.type, message);
    console.log('[WebSocket] 🔍 Raw message data:', JSON.stringify(message, null, 2));
    console.log('[WebSocket] 🔍 Message timestamp:', new Date().toISOString());
    console.log('[WebSocket] 🔍 Current draft ID:', draftId);
    console.log('[WebSocket] 🔍 Current user ID:', user?.id);
    
    switch (message.type) {
      case 'connected':
        console.log('[WebSocket] Connected to draft successfully on Reserved VM');
        // PERMANENT FIX: Immediately refresh draft data on connection to prevent stuck drafts
        queryClient.invalidateQueries({ queryKey: ['draft', draftId] });
        queryClient.invalidateQueries({ queryKey: ['draft-teams', draftId] });
        console.log('[WebSocket] ✅ Draft queries invalidated on connection for immediate sync');
        break;
        
      case 'pick_made':
        console.log('[WebSocket] Pick made:', message.data.pick);
        
        // Update draft state cache
        queryClient.invalidateQueries({ queryKey: ['draft', draftId] });
        queryClient.invalidateQueries({ queryKey: ['draft-teams', draftId] });
        
        // Show notification
        toast({
          title: "Pick Made!",
          description: `${message.data.pick.user.name} selected ${message.data.pick.nflTeam.name}`,
        });
        break;

      case 'auto_pick':
        console.log('[WebSocket] Auto-pick:', message.data.pick);
        
        // Update draft state cache
        queryClient.invalidateQueries({ queryKey: ['draft', draftId] });
        queryClient.invalidateQueries({ queryKey: ['draft-teams', draftId] });
        
        // Show auto-pick notification
        toast({
          title: "Auto-Pick",
          description: `${message.data.pick.user.name} was auto-picked ${message.data.pick.nflTeam.name}`,
          variant: "default",
        });
        break;

      case 'timer_update':
        console.log('[WebSocket] ⏰ TIMER UPDATE - Received:', message.data.timeRemaining, 'seconds');
        console.log('[WebSocket] ⏰ TIMER UPDATE - Full message:', message);
        console.log('[WebSocket] ⏰ TIMER UPDATE - Message timestamp:', new Date().toISOString());
        console.log('[WebSocket] ⏰ TIMER UPDATE - Draft ID match:', message.data?.draftId === draftId);
        
        // PERMANENT FIX: Enhanced timer state management to prevent flashing 0:00
        queryClient.setQueryData(['draft', draftId], (oldData: any) => {
          console.log('[WebSocket] ⏰ TIMER UPDATE - Updating cache with oldData:', !!oldData);
          if (oldData) {
            // Only update timer if the received time is valid (prevent 0:00 flashing)
            const newTimeRemaining = message.data.timeRemaining;
            if (newTimeRemaining >= 0 && newTimeRemaining <= 60) {
              return {
                ...oldData,
                state: {
                  ...oldData.state,
                  timeRemaining: newTimeRemaining,
                  lastTimerUpdate: Date.now() // Track when timer was last updated
                }
              };
            } else {
              console.log('[WebSocket] ⏰ TIMER UPDATE - Invalid time received, keeping current state:', newTimeRemaining);
              return oldData;
            }
          }
          return oldData;
        });
        break;

      case 'pong':
        console.log('[WebSocket] Received pong from server');
        break;

      case 'draft_completed':
        console.log('[WebSocket] Draft completed');
        
        // Update final state
        queryClient.invalidateQueries({ queryKey: ['draft', draftId] });
        
        toast({
          title: "Draft Complete!",
          description: "All picks have been made. Check your final roster!",
        });
        break;

      case 'draft_state':
        console.log('[WebSocket] Draft state update');
        
        // Refresh draft data for reconnections
        queryClient.invalidateQueries({ queryKey: ['draft', draftId] });
        break;

      default:
        console.log('[WebSocket] Unknown message type:', message.type);
    }
  }, [draftId, queryClient, toast]);

  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    
    if (wsRef.current) {
      wsRef.current.close(1000, 'Client disconnect');
      wsRef.current = null;
    }
    
    setConnectionStatus('disconnected');
  }, []);

  const sendMessage = useCallback((message: any) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(message));
    }
  }, []);

  // ROBUST CONNECTION MANAGEMENT - Enhanced for draft resets on Reserved VM  
  useEffect(() => {
    console.log('[WebSocket] ==== EFFECT TRIGGERED ====');
    console.log('[WebSocket] Dependencies - draftId:', !!draftId, 'userId:', !!user?.id);
    console.log('[WebSocket] Current connection state:', connectionStatus);
    console.log('[WebSocket] wsRef exists:', !!wsRef.current);
    console.log('[WebSocket] Previous draft ID:', previousDraftIdRef.current);
    console.log('[WebSocket] Current draft ID:', draftId);
    
    if (draftId && user?.id) {
      console.log('[WebSocket] ✅ Dependencies ready - initiating connection');
      
      // PERMANENT FIX: Always force new connection for any draft change
      const draftChanged = previousDraftIdRef.current && previousDraftIdRef.current !== draftId;
      if (draftChanged) {
        console.log('[WebSocket] 🔄 Draft ID changed - forcing fresh connection');
        setConnectionStatus('connecting');
        
        // Clear any existing connection immediately  
        if (wsRef.current) {
          wsRef.current.close(1000, 'Draft changed');
          wsRef.current = null;
        }
        
        // Force new connection after brief delay
        setTimeout(() => {
          connectToWebSocket();
        }, 100);
      } else {
        connect();
      }
    } else {
      console.log('[WebSocket] ❌ Missing dependencies - disconnecting if needed');
      if (wsRef.current) {
        disconnect();
      }
    }
    
    // NO CLEANUP FUNCTION - let connections live until explicitly closed
  }, [draftId, user?.id]);

  // CRITICAL FIX: Remove cleanup that causes premature disconnections
  // Component unmount cleanup DISABLED to prevent immediate disconnections
  // useEffect(() => {
  //   const cleanupOnUnmount = () => {
  //     console.log('[WebSocket] 🧹 COMPONENT UNMOUNTING - Final cleanup');
  //     if (wsRef.current) {
  //       wsRef.current.close(1000, 'Component unmount');
  //       wsRef.current = null;
  //     }
  //     if (reconnectTimeoutRef.current) {
  //       clearTimeout(reconnectTimeoutRef.current);
  //       reconnectTimeoutRef.current = null;
  //     }
  //   };

  //   return cleanupOnUnmount;
  // }, []); // Empty dependency - only run on mount/unmount

  return {
    connectionStatus,
    lastMessage,
    sendMessage,
    isConnected: connectionStatus === 'connected'
  };
}