import { useEffect, useRef, useCallback } from 'react';

type DraftSocketMessage =
  | { type: 'connected' }
  | { type: 'draft_state'; payload: any }
  | { type: 'timer_update'; payload: { display: number } }
  | { type: string; payload?: any };

export function useDraftWebSocket(opts?: {
  draftId?: string;
  userId?: string;
  onDraftState?: (s: any) => void;
  onTimerUpdate?: (t: { display: number }) => void;
}) {
  const { draftId, userId, onDraftState, onTimerUpdate } = opts || {};

  const socketRef = useRef<WebSocket | null>(null);
  const reconnectTimerRef = useRef<number | null>(null);
  const epochRef = useRef(0);

  function clearReconnectTimer() {
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
  }

  const onMessage = useCallback((ev: MessageEvent) => {
    try {
      const msg: DraftSocketMessage =
        typeof ev.data === 'string' ? JSON.parse(ev.data) : ev.data;
      console.log('[WebSocket] Message received:', msg.type);
      if (msg.type === 'draft_state') onDraftState?.(msg.payload);
      else if (msg.type === 'timer_update') onTimerUpdate?.(msg.payload as any);
    } catch {
      // tolerate non-JSON like "connected"
    }
  }, [onDraftState, onTimerUpdate]);

  const openSocket = useCallback(() => {
    if (!draftId || !userId) return;
    if (socketRef.current) return;

    const myEpoch = ++epochRef.current;
    console.log('[WebSocket] === STARTING NEW CONNECTION ATTEMPT ===');
    console.log('[WebSocket] Draft ID:', draftId, 'User ID:', userId);

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsHost = window.location.host;
    const url = `${protocol}//${wsHost}/draft-ws?userId=${encodeURIComponent(userId)}&draftId=${encodeURIComponent(draftId)}`;
    const ws = new WebSocket(url);
    socketRef.current = ws;

    ws.onopen = () => {
      if (myEpoch !== epochRef.current) { try { ws.close(); } catch {} return; }
      console.log('[WebSocket] ✅ CONNECTION ESTABLISHED');
      clearReconnectTimer();
    };
    ws.onmessage = onMessage;
    ws.onerror = (e) => console.log('[WebSocket] Connection error:', e);
    ws.onclose = (e) => {
      if (myEpoch !== epochRef.current) return;
      console.log('[WebSocket] Connection closed:', e.code, e.reason);
      socketRef.current = null;
      if (e.code !== 1000 && !reconnectTimerRef.current) {
        reconnectTimerRef.current = window.setTimeout(() => {
          reconnectTimerRef.current = null;
          openSocket();
        }, 1000);
      }
    };
  }, [draftId, userId, onMessage]);

  useEffect(() => {
    if (draftId && userId && !socketRef.current) openSocket();

    return () => {
      clearReconnectTimer();
      const s = socketRef.current;
      socketRef.current = null;
      epochRef.current++;
      try { s?.close(1000, 'route change'); } catch {}
    };
  }, [draftId, userId, openSocket]);

  // Return connection status
  return {
    connectionStatus: socketRef.current ? 'connected' : 'disconnected',
    isConnected: !!socketRef.current,
    lastMessage: null // Could track this if needed
  };
}