/**
 * Enhanced WebSocket hook for draft management with hardened connection handling
 * Features:
 * - Real-time draft state synchronization
 * - Automatic reconnection on disconnect
 * - Pick notifications and timer updates
 * - Draft state persistence across page reloads
 * - Prevention of duplicate sockets and reconnect storms
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import type { DraftWebSocketMessage, ConnectionStatus } from '@/draft/draft-types';

// Types for enhanced message handling
type DraftSocketMessage =
  | { type: 'connected' }
  | { type: 'draft_state'; payload: any }
  | { type: 'timer_update'; payload: { display: number } }
  | { type: string; payload?: any };

export function useDraftWebSocket(opts?: {
  draftId?: string;
  userId?: string;
  onDraftState?: (state: any) => void;
  onTimerUpdate?: (t: { display: number }) => void;
}) {
  const { draftId, userId, onDraftState, onTimerUpdate } = opts || {};
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  // Hardened connection management
  const socketRef = useRef<WebSocket | null>(null);
  const reconnectTimerRef = useRef<number | null>(null);
  const epochRef = useRef(0); // bump to invalidate in-flight connects
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('disconnected');
  const [lastMessage, setLastMessage] = useState<DraftWebSocketMessage | null>(null);

  console.log('[WebSocket] Hook called with:', { draftId, userId });

  function clearReconnectTimer() {
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
  }

  function scheduleReconnect(delayMs: number) {
    if (reconnectTimerRef.current) return; // already scheduled
    reconnectTimerRef.current = window.setTimeout(() => {
      reconnectTimerRef.current = null;
      openSocket(); // try again
    }, delayMs);
  }

  const onMessage = useCallback((event: MessageEvent) => {
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
  }, [onDraftState, onTimerUpdate, queryClient, draftId, toast]);

  function openSocket() {
    if (!draftId || !userId) return;
    if (socketRef.current) return; // already connected or connecting

    const myEpoch = ++epochRef.current; // capture this attempt
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsHost = window.location.host;
    const url = `${protocol}//${wsHost}/draft-ws?userId=${encodeURIComponent(userId)}&draftId=${encodeURIComponent(draftId)}`;

    console.log('[WebSocket] === STARTING NEW CONNECTION ATTEMPT ===');
    console.log('[WebSocket] Draft ID:', draftId, 'User ID:', userId);
    setConnectionStatus('connecting');

    const ws = new WebSocket(url);
    socketRef.current = ws;

    ws.onopen = () => {
      // if another attempt superseded us, bail
      if (myEpoch !== epochRef.current) { 
        try { ws.close(); } catch {} 
        return; 
      }
      console.log('[WebSocket] ✅ CONNECTION ESTABLISHED');
      setConnectionStatus('connected');
      clearReconnectTimer(); // ✅ cancel any pending reconnect
    };

    ws.onmessage = onMessage; // your fan-out from Patch #1

    ws.onerror = (e) => {
      console.log('[WebSocket] Connection error:', e);
      setConnectionStatus('error');
      // don't null ref here; wait for onclose
    };

    ws.onclose = (e) => {
      // if a newer attempt already exists, ignore close
      if (myEpoch !== epochRef.current) return;

      console.log('[WebSocket] Connection closed:', e.code, e.reason);
      setConnectionStatus('disconnected');
      socketRef.current = null;

      // Reconnect on abnormal (1006) or server reset (1011). Backoff 0.5s→5s
      if (e.code !== 1000) {
        const attempt = Math.min(5, Math.max(1, myEpoch)); // crude backoff by epoch
        const delay = 500 * attempt;
        console.log('[WebSocket] Unexpected close, will reconnect in', delay, 'ms');
        scheduleReconnect(delay);
      }
    };
  }

  // Hardened connection effect with proper cleanup
  useEffect(() => {
    // connect when identifiers are present
    if (draftId && userId && !socketRef.current) openSocket();

    // cleanup on dependency change (e.g., navigating to another draft)
    return () => {
      clearReconnectTimer();
      const s = socketRef.current;
      socketRef.current = null;
      epochRef.current++; // invalidate any inflight attempt
      try { s?.close(1000, 'route change'); } catch {}
    };
  }, [draftId, userId]); // keep deps minimal; don't include draft status/messages

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      clearReconnectTimer();
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
      if (socketRef.current) {
        socketRef.current.close(1000, 'Component unmounted');
        socketRef.current = null;
      }
    };
  }, []);

  return {
    connectionStatus,
    lastMessage,
    isConnected: connectionStatus === 'connected'
  };
}