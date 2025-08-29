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

export function useDraftWebSocket(draftId: string) {
  const [connectionStatus, setConnectionStatus] = useState<WSStatus>('idle');
  const [lastMessage, setLastMessage] = useState<DraftWebSocketMessage | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const attemptsRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stoppedRef = useRef(false);

  const clearTimer = () => { if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null; } };

  const connect = useCallback(() => {
    if (!draftId || stoppedRef.current) return;

    setConnectionStatus('connecting');
    const url = `${location.origin.replace(/^http/, 'ws')}/draft-ws?draftId=${encodeURIComponent(draftId)}`;
    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onopen = () => { attemptsRef.current = 0; setConnectionStatus('connected'); };
    ws.onmessage = (ev) => { try { setLastMessage(JSON.parse(ev.data)); } catch {} };
    ws.onerror = () => { /* let onclose schedule reconnect */ };
    ws.onclose = () => {
      setConnectionStatus('closed');
      wsRef.current = null;
      if (stoppedRef.current) return;

      // Slow down reconnects when hidden; speed up when visible
      const delay = document.visibilityState === 'hidden' ? MAX : backoff(++attemptsRef.current);
      clearTimer();
      timerRef.current = setTimeout(connect, delay);
    };
  }, [draftId]);

  useEffect(() => {
    if (!draftId) return;

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