import { useEffect, useRef, useState } from 'react';

// Persistent WebSocket implementation with browser-specific handling
export function usePersistentWebSocket(draftId: string, userId: string) {
  const wsRef = useRef<WebSocket | null>(null);
  const [status, setStatus] = useState<'connecting' | 'connected' | 'disconnected'>('disconnected');
  const [lastMessage, setLastMessage] = useState<string>('');
  const [connectionAttempts, setConnectionAttempts] = useState(0);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isManualCloseRef = useRef(false);

  const connect = () => {
    if (!draftId || !userId) return;
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    console.log('[PersistentWS] Attempting connection #', connectionAttempts + 1);
    
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/draft-ws?userId=${userId}&draftId=${draftId}`;

    try {
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;
      setStatus('connecting');
      setConnectionAttempts(prev => prev + 1);

      // Prevent browser from closing connection on navigation
      ws.binaryType = 'arraybuffer';
      
      ws.onopen = (event) => {
        console.log('[PersistentWS] ✅ Connected successfully');
        setStatus('connected');
        setConnectionAttempts(0);
        
        // Send keep-alive ping immediately
        ws.send(JSON.stringify({
          type: 'ping',
          timestamp: Date.now(),
          keepAlive: true
        }));
      };

      ws.onmessage = (event) => {
        console.log('[PersistentWS] Message received:', event.data);
        setLastMessage(event.data);
        
        // Respond to server pings to maintain connection
        try {
          const message = JSON.parse(event.data);
          if (message.type === 'ping') {
            ws.send(JSON.stringify({
              type: 'pong',
              timestamp: Date.now()
            }));
          }
        } catch (e) {
          // Ignore JSON parse errors
        }
      };

      ws.onclose = (event) => {
        console.log('[PersistentWS] Connection closed');
        console.log('[PersistentWS] Close code:', event.code);
        console.log('[PersistentWS] Close reason:', event.reason);
        console.log('[PersistentWS] Was clean:', event.wasClean);
        console.log('[PersistentWS] Manual close:', isManualCloseRef.current);
        
        setStatus('disconnected');
        wsRef.current = null;
        
        // Auto-reconnect unless manually closed
        if (!isManualCloseRef.current && connectionAttempts < 5) {
          const delay = Math.min(1000 * Math.pow(2, connectionAttempts), 10000);
          console.log(`[PersistentWS] Reconnecting in ${delay}ms...`);
          
          reconnectTimeoutRef.current = setTimeout(() => {
            connect();
          }, delay);
        }
      };

      ws.onerror = (error) => {
        console.error('[PersistentWS] Error:', error);
        setStatus('disconnected');
      };

      // Heartbeat to keep connection alive
      const heartbeat = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({
            type: 'heartbeat',
            timestamp: Date.now()
          }));
        } else {
          clearInterval(heartbeat);
        }
      }, 10000); // Every 10 seconds

    } catch (error) {
      console.error('[PersistentWS] Connection failed:', error);
      setStatus('disconnected');
    }
  };

  const disconnect = () => {
    console.log('[PersistentWS] Manual disconnect requested');
    isManualCloseRef.current = true;
    
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    
    if (wsRef.current) {
      wsRef.current.close(1000, 'Manual disconnect');
      wsRef.current = null;
    }
    
    setStatus('disconnected');
  };

  useEffect(() => {
    if (draftId && userId) {
      isManualCloseRef.current = false;
      connect();
    }

    // Cleanup on unmount or parameter change
    return () => {
      disconnect();
    };
  }, [draftId, userId]);

  // Handle page visibility changes
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && status === 'disconnected') {
        console.log('[PersistentWS] Page visible, attempting reconnection');
        isManualCloseRef.current = false;
        connect();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [status]);

  return {
    status,
    lastMessage,
    isConnected: status === 'connected',
    connectionAttempts,
    reconnect: connect,
    disconnect
  };
}