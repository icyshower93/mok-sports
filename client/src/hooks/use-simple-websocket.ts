import { useEffect, useRef, useState } from 'react';

// Minimal WebSocket implementation to isolate the disconnection issue
export function useSimpleWebSocket(draftId: string, userId: string) {
  const wsRef = useRef<WebSocket | null>(null);
  const [status, setStatus] = useState<'connecting' | 'connected' | 'disconnected'>('disconnected');
  const [lastMessage, setLastMessage] = useState<string>('');

  useEffect(() => {
    if (!draftId || !userId) {
      console.log('[SimpleWS] Missing parameters');
      return;
    }

    console.log('[SimpleWS] Starting connection attempt');
    console.log('[SimpleWS] draftId:', draftId);
    console.log('[SimpleWS] userId:', userId);

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/draft-ws?userId=${userId}&draftId=${draftId}`;

    console.log('[SimpleWS] Connecting to:', wsUrl);
    
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;
    setStatus('connecting');

    ws.onopen = () => {
      console.log('[SimpleWS] ✅ Connected successfully');
      setStatus('connected');
      
      // Send initial ping
      ws.send(JSON.stringify({
        type: 'ping',
        timestamp: Date.now()
      }));
      console.log('[SimpleWS] Initial ping sent');
    };

    ws.onmessage = (event) => {
      console.log('[SimpleWS] Message received:', event.data);
      setLastMessage(event.data);
    };

    ws.onclose = (event) => {
      console.log('[SimpleWS] Connection closed - Code:', event.code, 'Reason:', event.reason);
      console.log('[SimpleWS] Was clean close:', event.code === 1000);
      setStatus('disconnected');
      wsRef.current = null;
    };

    ws.onerror = (error) => {
      console.error('[SimpleWS] Error:', error);
      setStatus('disconnected');
    };

    // CRITICAL: NO CLEANUP - Let connection persist
    // The cleanup function may be causing premature disconnections
    // return () => {
    //   console.log('[SimpleWS] Cleanup - closing connection');
    //   if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
    //     ws.close(1000, 'Component cleanup');
    //   }
    // };
  }, [draftId, userId]);

  return {
    status,
    lastMessage,
    isConnected: status === 'connected'
  };
}