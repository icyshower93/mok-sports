import { useEffect, useRef, useState } from 'react';

// Replit-optimized WebSocket implementation
// Works around platform-specific connection issues by using HTTP fallback
export function useReplitWebSocket(draftId: string, userId: string) {
  const [status, setStatus] = useState<'connecting' | 'connected' | 'disconnected'>('disconnected');
  const [lastMessage, setLastMessage] = useState<string>('');
  const [useHttpFallback, setUseHttpFallback] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttemptsRef = useRef(0);

  const startHttpPolling = () => {
    console.log('[ReplitWS] Starting HTTP polling fallback');
    setStatus('connected');
    setUseHttpFallback(true);
    
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
    }
    
    pollIntervalRef.current = setInterval(async () => {
      try {
        const response = await fetch(`/api/drafts/${draftId}/state`);
        if (response.ok) {
          const data = await response.json();
          setLastMessage(JSON.stringify({
            type: 'timer_update',
            timeRemaining: data.timeRemaining,
            currentUserId: data.currentUserId,
            timestamp: Date.now()
          }));
        }
      } catch (error) {
        console.log('[ReplitWS] HTTP polling error:', error);
      }
    }, 1000); // Poll every second
  };

  const tryWebSocketConnection = () => {
    if (!draftId || !userId || useHttpFallback) return;
    
    reconnectAttemptsRef.current++;
    console.log(`[ReplitWS] WebSocket attempt #${reconnectAttemptsRef.current}`);
    
    if (reconnectAttemptsRef.current > 3) {
      console.log('[ReplitWS] Max WebSocket attempts reached, switching to HTTP polling');
      startHttpPolling();
      return;
    }

    try {
      // Close any existing connection
      if (wsRef.current) {
        wsRef.current.close();
      }

      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}/draft-ws?userId=${userId}&draftId=${draftId}`;
      
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;
      setStatus('connecting');

      // Set a connection timeout
      const connectionTimeout = setTimeout(() => {
        if (ws.readyState === WebSocket.CONNECTING) {
          console.log('[ReplitWS] Connection timeout, closing WebSocket');
          ws.close();
          setStatus('disconnected');
        }
      }, 5000);

      ws.onopen = () => {
        clearTimeout(connectionTimeout);
        console.log('[ReplitWS] WebSocket connected');
        setStatus('connected');
        reconnectAttemptsRef.current = 0; // Reset on successful connection
        
        // Send ping immediately
        ws.send(JSON.stringify({
          type: 'ping',
          timestamp: Date.now()
        }));
      };

      ws.onmessage = (event) => {
        console.log('[ReplitWS] WebSocket message:', event.data);
        setLastMessage(event.data);
      };

      ws.onclose = (event) => {
        clearTimeout(connectionTimeout);
        console.log(`[ReplitWS] WebSocket closed - Code: ${event.code}, Reason: ${event.reason}`);
        setStatus('disconnected');
        wsRef.current = null;
        
        // If close code 1001 (going away) or multiple failures, switch to HTTP polling
        if (event.code === 1001 || reconnectAttemptsRef.current >= 3) {
          console.log('[ReplitWS] WebSocket unreliable, switching to HTTP polling');
          startHttpPolling();
        } else {
          // Try reconnecting after a delay
          setTimeout(() => {
            if (!useHttpFallback) {
              tryWebSocketConnection();
            }
          }, 2000);
        }
      };

      ws.onerror = (error) => {
        clearTimeout(connectionTimeout);
        console.error('[ReplitWS] WebSocket error:', error);
        setStatus('disconnected');
      };

    } catch (error) {
      console.error('[ReplitWS] Failed to create WebSocket:', error);
      setStatus('disconnected');
      startHttpPolling();
    }
  };

  useEffect(() => {
    if (draftId && userId) {
      console.log('[ReplitWS] Initializing connection');
      tryWebSocketConnection();
    }

    return () => {
      console.log('[ReplitWS] Cleaning up connections');
      setUseHttpFallback(false);
      reconnectAttemptsRef.current = 0;
      
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
      
      if (wsRef.current) {
        wsRef.current.close(1000, 'Component cleanup');
        wsRef.current = null;
      }
    };
  }, [draftId, userId]);

  return {
    status: useHttpFallback ? 'connected' : status,
    lastMessage,
    isConnected: status === 'connected' || useHttpFallback,
    connectionType: useHttpFallback ? 'HTTP' : 'WebSocket',
    reconnectAttempts: reconnectAttemptsRef.current
  };
}