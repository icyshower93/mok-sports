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
import { useAuth } from '@/hooks/use-auth';
import { useToast } from './use-toast';

export interface DraftWebSocketMessage {
  type: 'pick_made' | 'timer_update' | 'draft_state' | 'auto_pick' | 'draft_completed' | 'connected' | 'pong';
  draftId: string;
  data?: any;
  timestamp: number;
}

export function useDraftWebSocket(draftId: string | null, leagueId: string | null = null) {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'disconnected' | 'draft_not_found'>('disconnected');
  const [lastMessage, setLastMessage] = useState<DraftWebSocketMessage | null>(null);

  console.log('[WebSocket] Hook called with:', { draftId, leagueId, userId: user?.id });

  const connectToWebSocket = useCallback(() => {
    console.log('[WebSocket] === STARTING NEW CONNECTION ATTEMPT ===');
    console.log('[WebSocket] Draft ID:', draftId, 'User ID:', user?.id);

    if (!draftId || !user?.id) {
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
    const wsUrl = `${protocol}//${wsHost}/draft-ws?userId=${encodeURIComponent(user.id)}&draftId=${encodeURIComponent(draftId)}`;

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
          const message: DraftWebSocketMessage = JSON.parse(event.data);
          console.log('[WebSocket] Message received:', message.type);
          setLastMessage(message);
          
          switch (message.type) {
            case 'connected':
              console.log('[WebSocket] Connected confirmation received');
              break;
            case 'pick_made':
              queryClient.invalidateQueries({ queryKey: ['draft', draftId] });
              toast({
                title: "Pick Made!",
                description: `${message.data.pick.user.name} selected ${message.data.pick.nflTeam.name}`,
              });
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
        if (event.code !== 1000 && draftId && user?.id) {
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
  }, [draftId, user?.id, toast, queryClient]);

  // Main effect to handle connections
  useEffect(() => {
    console.log('[WebSocket] MAIN useEffect trigger - draftId:', draftId, 'userId:', !!user?.id);
    
    if (draftId && user?.id) {
      console.log('[WebSocket] ✅ Conditions met, validating draft exists before connection...');
      
      // Validate draft exists before attempting WebSocket connection
      fetch(`/api/drafts/${draftId}`)
        .then(response => {
          if (response.ok) {
            console.log('[WebSocket] ✅ Draft exists, proceeding with connection');
            connectToWebSocket();
          } else {
            console.log('[WebSocket] ❌ Draft not found, skipping connection');
            setConnectionStatus('draft_not_found');
          }
        })
        .catch(error => {
          console.log('[WebSocket] ❌ Draft validation failed:', error);
          setConnectionStatus('disconnected');
        });
    } else {
      console.log('[WebSocket] ❌ Connection requirements not met:', {
        hasDraftId: !!draftId,
        hasUserId: !!user?.id,
        actualDraftId: draftId
      });
      setConnectionStatus('disconnected');
    }
  }, [draftId, user?.id, connectToWebSocket]);

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