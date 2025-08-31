import { useState, useEffect, useRef } from 'react';
import { DraftMessage, DraftMessageSchema } from '@shared/types/draft';

interface WebSocketStatus {
  status: 'idle' | 'connecting' | 'open' | 'closed';
  message: DraftMessage | null;
}

const BASE_DELAY = 750;
const MAX_DELAY = 10_000;
const HEARTBEAT_INTERVAL = 25_000; // 25 seconds

function backoffDelay(attempt: number): number {
  return Math.min(MAX_DELAY, BASE_DELAY * Math.pow(2, attempt));
}

export function useResilientWebSocket(url: string | null): WebSocketStatus {
  const [status, setStatus] = useState<'idle' | 'connecting' | 'open' | 'closed'>('idle');
  const [message, setMessage] = useState<DraftMessage | null>(null);
  
  const wsRef = useRef<WebSocket | null>(null);
  const attemptRef = useRef(0);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const heartbeatRef = useRef<NodeJS.Timeout | null>(null);
  const stopRef = useRef(false);

  useEffect(() => {
    if (!url) {
      setStatus('idle');
      return;
    }

    stopRef.current = false;
    attemptRef.current = 0;

    const connect = () => {
      if (stopRef.current) return;
      
      setStatus('connecting');
      const ws = new WebSocket(url);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log('[WS] Connected successfully');
        attemptRef.current = 0; // Reset backoff on successful connection
        setStatus('open');
        
        // Start heartbeat - send a simple ping message
        if (heartbeatRef.current) {
          clearInterval(heartbeatRef.current);
        }
        heartbeatRef.current = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'ping' }));
          }
        }, HEARTBEAT_INTERVAL);
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          const validatedMessage = DraftMessageSchema.parse(data);
          setMessage(validatedMessage);
        } catch (error) {
          console.warn('[WS] Invalid message format:', error);
        }
      };

      ws.onerror = (error) => {
        console.warn('[WS] Connection error:', error);
      };

      ws.onclose = (event) => {
        console.log('[WS] Connection closed:', event.code, event.reason);
        setStatus('closed');
        
        // Clear heartbeat
        if (heartbeatRef.current) {
          clearInterval(heartbeatRef.current);
          heartbeatRef.current = null;
        }

        if (stopRef.current) return;

        // Determine reconnection delay based on visibility
        const isHidden = document.visibilityState === 'hidden';
        const delay = isHidden ? MAX_DELAY : backoffDelay(attemptRef.current++);
        
        console.log(`[WS] Reconnecting in ${delay}ms (attempt ${attemptRef.current})`);
        timeoutRef.current = setTimeout(connect, delay);
      };
    };

    // Handle visibility changes for smart reconnection
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && status === 'closed') {
        // Fast-path reconnect when tab becomes visible
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current);
          timeoutRef.current = setTimeout(connect, 200);
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    connect();

    return () => {
      stopRef.current = true;
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
      
      if (heartbeatRef.current) {
        clearInterval(heartbeatRef.current);
        heartbeatRef.current = null;
      }
      
      if (wsRef.current) {
        wsRef.current.close(4003, 'component-unmount');
        wsRef.current = null;
      }
    };
  }, [url]);

  return { status, message };
}