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

export function useDraftWebSocket(draftId: string | null) {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'disconnected'>('disconnected');
  const [lastMessage, setLastMessage] = useState<DraftWebSocketMessage | null>(null);

  const connect = useCallback(() => {
    console.log('[WebSocket] Connect called with:', { 
      draftId, 
      userId: user?.id, 
      userLoaded: !!user,
      wsState: wsRef.current?.readyState 
    });
    
    if (!draftId || !user?.id || wsRef.current?.readyState === WebSocket.OPEN) {
      console.log('[WebSocket] Connect skipped:', { 
        draftId: !!draftId, 
        userId: !!user?.id, 
        wsOpen: wsRef.current?.readyState === WebSocket.OPEN,
        reason: !draftId ? 'no draftId' : !user?.id ? 'no userId' : 'already connected'
      });
      return;
    }

    console.log('[WebSocket] Attempting connection for draft:', draftId, 'user:', user.id);
    setConnectionStatus('connecting');
    
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    
    // Simplified WebSocket endpoint logic
    // Always connect to same host (Vite proxies to backend in dev, same server in prod)
    let wsHost = window.location.host;
    let wsPath = '/draft-ws';
    
    console.log('[WebSocket] Environment detection:', {
      hostname: window.location.hostname,
      port: window.location.port,
      protocol: window.location.protocol
    });
    
    const wsUrl = `${protocol}//${wsHost}${wsPath}?userId=${user.id}&draftId=${draftId}`;
    console.log('[WebSocket] Connecting to:', wsUrl);
    console.log('[WebSocket] Current location:', window.location.href);
    console.log('[WebSocket] Protocol detected:', protocol);
    console.log('[WebSocket] Target host:', wsHost);
    
    // Close any existing connection first
    if (wsRef.current) {
      console.log('[WebSocket] Closing existing connection before creating new one');
      wsRef.current.close();
      wsRef.current = null;
    }
    
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      console.log('[WebSocket] Successfully connected to draft:', draftId, 'for user:', user?.id);
      setConnectionStatus('connected');
      
      // Send a ping to verify the connection reaches our backend
      ws.send(JSON.stringify({
        type: 'ping',
        draftId: draftId,
        userId: user.id,
        timestamp: Date.now()
      }));

      // Set up client-side heartbeat ping every 25 seconds
      const heartbeatTimer = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({
            type: 'ping',
            draftId: draftId,
            userId: user.id,
            timestamp: Date.now()
          }));
        } else {
          clearInterval(heartbeatTimer);
        }
      }, 25000);
      
      // Clear any reconnection timeout
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
    };

    ws.onmessage = (event) => {
      try {
        const message: DraftWebSocketMessage = JSON.parse(event.data);
        setLastMessage(message);
        handleWebSocketMessage(message);
      } catch (error) {
        console.error('[WebSocket] Error parsing message:', error);
      }
    };

    ws.onclose = (event) => {
      console.log('[WebSocket] Connection closed:', event.code, event.reason);
      setConnectionStatus('disconnected');
      wsRef.current = null;

      // In production environments where WebSocket might be blocked,
      // don't attempt infinite reconnects
      if (event.code !== 1000 && draftId && user?.id) {
        if (window.location.hostname.includes('replit.app')) {
          console.log('[WebSocket] Production WebSocket closed, relying on HTTP polling fallback');
          // Don't reconnect in production - use HTTP polling instead
        } else {
          // In development, try to reconnect normally
          reconnectTimeoutRef.current = setTimeout(() => {
            console.log('[WebSocket] Attempting to reconnect...');
            connect();
          }, 3000);
        }
      }
    };

    ws.onerror = (error) => {
      console.error('[WebSocket] Connection error:', error);
      console.error('[WebSocket] Error details:', {
        type: error.type,
        target: (error.target as WebSocket)?.readyState,
        url: wsUrl,
        timestamp: new Date().toISOString()
      });
      setConnectionStatus('disconnected');
      
      // In production, don't keep retrying failed WebSocket connections
      if (window.location.hostname.includes('replit.app')) {
        console.log('[WebSocket] Production WebSocket failed, will rely on HTTP polling');
      }
    };
  }, [draftId, user?.id]);

  const handleWebSocketMessage = useCallback((message: DraftWebSocketMessage) => {
    console.log('[WebSocket] Received message:', message.type, message);
    
    switch (message.type) {
      case 'connected':
        console.log('[WebSocket] Connected to draft successfully');
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
        console.log('[WebSocket] Timer update:', message.data.timeRemaining);
        
        // Update timer state in cache if needed
        queryClient.setQueryData(['draft', draftId], (oldData: any) => {
          if (oldData) {
            return {
              ...oldData,
              state: {
                ...oldData.state,
                timeRemaining: message.data.timeRemaining
              }
            };
          }
          return oldData;
        });
        break;

      case 'connected':
        console.log('[WebSocket] Connected to draft successfully');
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

  // Connect when draft ID changes
  useEffect(() => {
    if (draftId && user?.id) {
      connect();
    } else {
      disconnect();
    }

    return () => {
      disconnect();
    };
  }, [draftId, user?.id, connect, disconnect]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      disconnect();
    };
  }, [disconnect]);

  return {
    connectionStatus,
    lastMessage,
    sendMessage,
    isConnected: connectionStatus === 'connected'
  };
}