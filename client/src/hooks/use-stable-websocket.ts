import { useEffect, useRef, useState, useCallback } from 'react';

// Stable WebSocket implementation that bypasses browser disconnect issues
export function useStableWebSocket(draftId: string, userId: string) {
  const wsRef = useRef<WebSocket | null>(null);
  const [status, setStatus] = useState<'connecting' | 'connected' | 'disconnected'>('disconnected');
  const [lastMessage, setLastMessage] = useState<string>('');
  const mountedRef = useRef(true);
  const connectionIdRef = useRef(0);

  const connectWebSocket = useCallback(() => {
    if (!draftId || !userId || !mountedRef.current) {
      console.log('[StableWS] Not connecting - missing params or unmounted');
      return;
    }

    // Close existing connection first
    if (wsRef.current && wsRef.current.readyState !== WebSocket.CLOSED) {
      console.log('[StableWS] Closing existing connection');
      wsRef.current.close();
    }

    const currentConnectionId = ++connectionIdRef.current;
    console.log(`[StableWS] Starting connection attempt #${currentConnectionId}`);
    
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/draft-ws?userId=${userId}&draftId=${draftId}&connectionId=${currentConnectionId}`;

    try {
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;
      setStatus('connecting');

      // Prevent immediate garbage collection
      (window as any).__stableWebSocket = ws;

      let openTimeout: NodeJS.Timeout | null = null;
      let messageTimeout: NodeJS.Timeout | null = null;

      ws.onopen = () => {
        if (connectionIdRef.current !== currentConnectionId || !mountedRef.current) {
          console.log('[StableWS] Connection opened but outdated, closing');
          ws.close();
          return;
        }

        console.log(`[StableWS] ✅ Connection #${currentConnectionId} opened successfully`);
        setStatus('connected');
        
        // Send immediate identification
        const identifyMessage = JSON.stringify({
          type: 'identify',
          userId,
          draftId,
          connectionId: currentConnectionId,
          timestamp: Date.now(),
          userAgent: navigator.userAgent
        });
        
        ws.send(identifyMessage);
        console.log('[StableWS] Identity message sent');

        // Set up keep-alive ping
        openTimeout = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN && mountedRef.current) {
            ws.send(JSON.stringify({
              type: 'keep_alive',
              connectionId: currentConnectionId,
              timestamp: Date.now()
            }));
            console.log('[StableWS] Keep-alive ping sent');
          }
        }, 15000);
      };

      ws.onmessage = (event) => {
        if (connectionIdRef.current !== currentConnectionId || !mountedRef.current) {
          console.log('[StableWS] Message received but connection outdated');
          return;
        }

        console.log(`[StableWS] Message received on connection #${currentConnectionId}:`, event.data);
        setLastMessage(event.data);
        
        // Auto-respond to server pings
        try {
          const message = JSON.parse(event.data);
          if (message.type === 'ping') {
            ws.send(JSON.stringify({
              type: 'pong',
              connectionId: currentConnectionId,
              timestamp: Date.now()
            }));
          }
        } catch (e) {
          // Ignore JSON parsing errors
        }
      };

      ws.onclose = (event) => {
        console.log(`[StableWS] Connection #${currentConnectionId} closed`);
        console.log(`[StableWS] Close code: ${event.code}, reason: "${event.reason}"`);
        console.log(`[StableWS] Was clean: ${event.wasClean}`);
        
        // Clear timeouts
        if (openTimeout) clearInterval(openTimeout);
        if (messageTimeout) clearTimeout(messageTimeout);
        
        if (connectionIdRef.current === currentConnectionId && mountedRef.current) {
          setStatus('disconnected');
          wsRef.current = null;
          
          // Only reconnect if not a manual close (code 1000)
          if (event.code !== 1000 && mountedRef.current) {
            console.log('[StableWS] Unexpected close, scheduling reconnection...');
            setTimeout(() => {
              if (mountedRef.current) {
                connectWebSocket();
              }
            }, 2000);
          }
        }
      };

      ws.onerror = (error) => {
        console.error(`[StableWS] Connection #${currentConnectionId} error:`, error);
        if (connectionIdRef.current === currentConnectionId && mountedRef.current) {
          setStatus('disconnected');
        }
      };

    } catch (error) {
      console.error('[StableWS] Failed to create WebSocket:', error);
      setStatus('disconnected');
    }
  }, [draftId, userId]);

  useEffect(() => {
    mountedRef.current = true;
    console.log('[StableWS] Component mounted, initializing connection');
    
    if (draftId && userId) {
      connectWebSocket();
    }

    // Cleanup on unmount
    return () => {
      console.log('[StableWS] Component unmounting, cleaning up');
      mountedRef.current = false;
      
      if (wsRef.current && wsRef.current.readyState !== WebSocket.CLOSED) {
        wsRef.current.close(1000, 'Component unmount');
      }
      
      // Clean up global reference
      if ((window as any).__stableWebSocket) {
        delete (window as any).__stableWebSocket;
      }
    };
  }, [connectWebSocket]);

  // Handle page visibility changes
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        console.log('[StableWS] Page hidden');
      } else {
        console.log('[StableWS] Page visible, checking connection');
        if (status === 'disconnected' && mountedRef.current) {
          connectWebSocket();
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [status, connectWebSocket]);

  return {
    status,
    lastMessage,
    isConnected: status === 'connected',
    reconnect: connectWebSocket,
    connectionId: connectionIdRef.current
  };
}