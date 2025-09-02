import { useState, useEffect, useRef } from 'react';
import { DraftMessage, DraftMessageSchema } from '@shared/types/draft';
import type { ConnectionStatus } from '@/draft/draft-types';
import { TIMER_CONSTANTS } from '@/draft/draft-types';

interface WebSocketStatus {
  status: ConnectionStatus;
  message: DraftMessage | null;
}

// Use centralized constants to avoid duplication
const { BASE_DELAY, MAX_DELAY, HEARTBEAT_INTERVAL } = TIMER_CONSTANTS;

function backoffDelay(attempt: number): number {
  return Math.min(MAX_DELAY, BASE_DELAY * Math.pow(2, attempt));
}

export function useResilientWebSocket(url: string | null): WebSocketStatus {
  const [status, setStatus] = useState<ConnectionStatus>('idle');
  const [message, setMessage] = useState<DraftMessage | null>(null);
  
  const wsRef = useRef<WebSocket | null>(null);
  const attemptRef = useRef(0);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const heartbeatRef = useRef<NodeJS.Timeout | null>(null);
  const stopRef = useRef(false);
  
  // HARDENING: Message de-duplication to prevent stale/duplicate messages
  const turnIdRef = useRef<string | null>(null);
  const seqRef = useRef<number>(0);
  const lastMessageIdRef = useRef<string | null>(null);

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
          
          // HARDENING: Message de-duplication logic
          if (validatedMessage.type === 'timer_update') {
            // Check for stale timer messages
            if (turnIdRef.current && data.turnId && data.turnId !== turnIdRef.current) {
              console.log('[WS] Ignoring stale timer message for old turn:', data.turnId);
              return;
            }
            
            // Check for out-of-order messages
            if (typeof data.seq === 'number' && data.seq <= seqRef.current) {
              console.log('[WS] Ignoring out-of-order message:', data.seq, '<=', seqRef.current);
              return;
            }
            
            // Update sequence number
            seqRef.current = data.seq ?? seqRef.current;
            
          } else if (validatedMessage.type === 'draft_state_update' && data.turnId) {
            // Adopt new turn epoch when turn changes
            if (turnIdRef.current !== data.turnId) {
              turnIdRef.current = data.turnId;
              seqRef.current = 0;
              console.log('[WS] New turn started:', data.turnId);
            }
            
          } else if (validatedMessage.type === 'pick_made') {
            // Prevent duplicate pick notifications
            const messageId = data.pickId || `${data.userId}-${data.teamId}-${Date.now()}`;
            if (lastMessageIdRef.current === messageId) {
              console.log('[WS] Ignoring duplicate pick message:', messageId);
              return;
            }
            lastMessageIdRef.current = messageId;
          }
          
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