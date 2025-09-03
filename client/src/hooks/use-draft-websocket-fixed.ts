/**
 * Enhanced WebSocket hook for real-time draft communication with Reserved VM support
 * Features:
 * - Single WebSocket instance management 
 * - Automatic reconnection on disconnect
 * - Pick notifications and timer updates
 * - Draft state persistence across page reloads
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/features/auth/useAuth';
import { useToast } from '@/hooks/use-toast';
import type { DraftWebSocketMessage, ConnectionStatus } from '@/draft/draft-types';

// Types for enhanced message handling
type DraftSocketMessage =
  | { type: 'connected' }
  | { type: 'draft_state'; payload: any }
  | { type: 'timer_update'; payload: { display: number } }
  | { type: string; payload?: any };

export function useDraftWebSocket(opts: {
  draftId?: string;
  userId?: string;
  onDraftState?: (state: any) => void;
  onTimerUpdate?: (t: { display: number }) => void;
}) {
  const { draftId, userId, onDraftState, onTimerUpdate } = opts;
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('disconnected');
  const [lastMessage, setLastMessage] = useState<DraftWebSocketMessage | null>(null);

  console.log('[WebSocket] Hook called with:', { draftId, userId });

  const connectToWebSocket = useCallback(() => {
    console.log('[WebSocket] === STARTING NEW CONNECTION ATTEMPT ===');
    console.log('[WebSocket] Draft ID:', draftId, 'User ID:', userId);

    if (!draftId || !userId) {
      console.log('[WebSocket] ❌ Cannot connect - missing draftId or userId');
      setConnectionStatus('disconnected');
      return;
    }

    // Clean close existing connection
    if (wsRef.current) {
      console.log('[WebSocket] Closing existing connection before creating new one');
      wsRef.current.close(1000, 'Creating new connection');
      wsRef.current = null;
    }

    // Enhanced URL handling for Reserved VM deployments
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsHost = window.location.host;
    const wsUrl = `${protocol}//${wsHost}/draft-ws?userId=${encodeURIComponent(userId)}&draftId=${encodeURIComponent(draftId)}`;

    console.log('[WebSocket] Creating connection to:', wsUrl);
    setConnectionStatus('connecting');

    try {
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log('[WebSocket] ✅ CONNECTION ESTABLISHED');
        setConnectionStatus('connected');
      };

      ws.onmessage = (event) => {
        try {
          const msg: DraftSocketMessage = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
          console.log('[WebSocket] Message received:', msg.type);
          setLastMessage(msg as DraftWebSocketMessage);
          
          // Enhanced message fan-out with callbacks
          if (msg.type === 'draft_state' && onDraftState) {
            onDraftState(msg.payload);
          } else if (msg.type === 'timer_update' && onTimerUpdate) {
            onTimerUpdate(msg.payload);
          }
          
          // Keep existing functionality
          switch (msg.type) {
            case 'connected':
              console.log('[WebSocket] Connected confirmation received');
              break;
            case 'pick_made':
              queryClient.invalidateQueries({ queryKey: ['draft', draftId] });
              if (msg.payload?.pick) {
                toast({
                  title: "Pick Made!",
                  description: `${msg.payload.pick.user.name} selected ${msg.payload.pick.nflTeam.name}`,
                });
              }
              break;
            case 'timer_update':
              queryClient.invalidateQueries({ queryKey: ['draft-timer', draftId] });
              break;
          }
        } catch (error) {
          console.error('[WebSocket] Error parsing message:', error);
        }
      };

      ws.onclose = (event) => {
        console.log('[WebSocket] Connection closed:', event.code, event.reason);
        setConnectionStatus('disconnected');
        wsRef.current = null;

        // Reconnect if unexpected close
        if (event.code !== 1000 && draftId && userId) {
          console.log('[WebSocket] Unexpected close, will reconnect...');
          reconnectTimeoutRef.current = setTimeout(() => {
            connectToWebSocket();
          }, 2000);
        }
      };

      ws.onerror = (error) => {
        console.error('[WebSocket] Connection error:', error);
        setConnectionStatus('disconnected');
      };

    } catch (error) {
      console.error('[WebSocket] Failed to create WebSocket:', error);
      setConnectionStatus('disconnected');
    }
  }, [draftId, userId, toast, queryClient, onDraftState, onTimerUpdate]);

  // Main effect to handle connections - simplified to only require draftId + userId
  useEffect(() => {
    const hasUser = !!userId;
    const hasDraftId = !!draftId;
    
    console.log('[WebSocket] MAIN useEffect trigger', { hasUser, hasDraftId, draftId });

    // ✅ Only require these two - let the socket bring the page to life
    if (!hasUser || !hasDraftId) {
      console.log('[WebSocket] 🛑 Not connecting - missing requirements', { hasUser, hasDraftId });
      setConnectionStatus('disconnected');
      return;
    }

    // Don't create duplicate connections
    if (wsRef.current) {
      console.log('[WebSocket] ⚠️ Socket already exists, skipping');
      return;
    }

    console.log('[WebSocket] ✅ Requirements met, connecting immediately');
    connectToWebSocket();
  }, [draftId, userId, connectToWebSocket]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (wsRef.current) {
        wsRef.current.close(1000, 'Component cleanup');
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
    };
  }, []);

  return {
    connectionStatus,
    lastMessage,
    isConnected: connectionStatus === 'connected'
  };
}