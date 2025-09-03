// Debug imports removed
import { useEffect, useRef, useState, useCallback } from 'react';

type WSStatus = 'idle' | 'connecting' | 'connected' | 'closed';

export interface DraftWebSocketMessage {
  type:
    | 'connected'
    | 'pong'
    | 'pick_made'
    | 'timer_update'
    | 'draft_state'
    | 'auto_pick'
    | 'draft_completed'
    | 'time_sync_response';
  [k: string]: any;
}

const BASE = 750;
const MAX  = 10_000;
const backoff = (n: number) => Math.min(MAX, BASE * Math.pow(2, n));

import { wsUrl } from '@/lib/endpoints';
import { useAuth } from '@/contexts/auth-context';

export function useDraftWebSocket(draftId: string | null) {
  const { user } = useAuth();
  const [connectionStatus, setConnectionStatus] = useState<WSStatus>('idle');
  const [lastMessage, setLastMessage] = useState<DraftWebSocketMessage | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const attemptsRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stoppedRef = useRef(false);

  const clearTimer = () => { if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null; } };

  const connect = useCallback(() => {
    // RACE CONDITION FIX: Don't connect until we have all requirements
    if (!user?.id || !draftId || stoppedRef.current) {
      console.log('[WebSocket] ❌ Connection requirements not met', { 
        hasUser: !!user?.id, 
        draftId,
        stopped: stoppedRef.current 
      });
      return;
    }

    if (wsRef.current) {
      console.log('[WebSocket] ⚠️ Already connected, skipping double-connect');
      return; // don't double-connect
    }

    setConnectionStatus('connecting');
    
    const url = wsUrl('/draft-ws', { draftId, userId: user.id });
    console.log('[WebSocket] ✅ Connecting to:', url);
    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onopen = () => { 
      attemptsRef.current = 0; 
      setConnectionStatus('connected'); 
      
      // ✅ Immediately request full state on connection
      ws.send(JSON.stringify({ type: "draft:get_state", draftId }));
    };
    ws.onmessage = (ev) => { try { setLastMessage(JSON.parse(ev.data)); } catch {} };
    ws.onerror = () => { /* let onclose schedule reconnect */ };
    ws.onclose = (ev) => {
      setConnectionStatus('closed');
      wsRef.current = null;
      if (stoppedRef.current) return;

      // Fast reconnect on policy codes from server, no long backoff
      if (ev.code === 4008 /* timeout/policy */) {
        clearTimer();
        timerRef.current = setTimeout(connect, 200);
        return;
      }

      // Slow down reconnects when hidden; speed up when visible
      const delay = document.visibilityState === 'hidden' ? MAX : backoff(++attemptsRef.current);
      clearTimer();
      timerRef.current = setTimeout(connect, delay);
    };
  }, [draftId, user?.id]);

  useEffect(() => {
    // RACE CONDITION FIX: Wait for auth + draftId before connecting
    if (!user?.id || !draftId) {
      console.log('[WebSocket] 🛑 Not connecting - missing requirements', { 
        hasUser: !!user?.id, 
        draftId 
      });
      return;
    }

    stoppedRef.current = false;
    connect();

    const onVisibility = () => {
      if (document.visibilityState === 'visible' && connectionStatus === 'closed') {
        attemptsRef.current = 0;
        clearTimer();
        timerRef.current = setTimeout(connect, 200);
      }
    };
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      stoppedRef.current = true;
      document.removeEventListener('visibilitychange', onVisibility);
      clearTimer();
      wsRef.current?.close(4003, 'unmount');
      wsRef.current = null;
      setConnectionStatus('closed');
    };
  }, [draftId, connect, connectionStatus]);

  const sendMessage = useCallback((msg: unknown) => {
    const json = JSON.stringify(msg);
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(json);
      return true;
    }
    return false;
  }, []);

  return {
    connectionStatus,
    lastMessage,
    sendMessage,
    isConnected: connectionStatus === 'connected',
  };
}