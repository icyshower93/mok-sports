import { useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';

// Production-optimized WebSocket connection for real-time updates
// Designed for hundreds of concurrent users with efficient broadcasts
export function useProductionRealtime() {
  const queryClient = useQueryClient();
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'disconnected'>('disconnected');
  const [reconnectAttempts, setReconnectAttempts] = useState(0);
  const maxReconnectAttempts = 5;
  const baseReconnectDelay = 1000; // 1 second

  const connect = () => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      return;
    }

    setConnectionStatus('connecting');
    console.log('[ProductionRealtime] Establishing WebSocket connection...');

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/draft-ws`;

    try {
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      // Production heartbeat handling
      const heartbeatInterval = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: 'ping', timestamp: Date.now() }));
        }
      }, 30000); // 30 second heartbeat

      ws.onopen = () => {
        console.log('[ProductionRealtime] WebSocket connected successfully');
        setConnectionStatus('connected');
        setReconnectAttempts(0);
        
        // Subscribe to admin broadcasts for real-time updates
        ws.send(JSON.stringify({
          type: 'join_admin_updates',
          timestamp: Date.now()
        }));
      };

      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          console.log('[ProductionRealtime] Received broadcast:', message.type);
          
          // Handle specific broadcast types efficiently
          switch (message.type) {
            case 'admin_date_advanced':
            case 'admin_season_reset':
            case 'weekly_bonuses_calculated':
            case 'score_update':
              // Efficient selective query invalidation for production
              queryClient.invalidateQueries({ queryKey: ['/api/leagues'] });
              queryClient.invalidateQueries({ queryKey: ['/api/scoring'] });
              queryClient.invalidateQueries({ queryKey: ['/api/admin/current-week'] });
              break;
            case 'pong':
              // Server heartbeat response - connection is alive
              break;
            default:
              console.log('[ProductionRealtime] Unknown broadcast type:', message.type);
          }
        } catch (error) {
          console.error('[ProductionRealtime] Error parsing WebSocket message:', error);
        }
      };

      ws.onclose = (event) => {
        console.log(`[ProductionRealtime] WebSocket closed: ${event.code} - ${event.reason}`);
        setConnectionStatus('disconnected');
        clearInterval(heartbeatInterval);
        wsRef.current = null;

        // Exponential backoff reconnection for production reliability
        if (reconnectAttempts < maxReconnectAttempts) {
          const delay = baseReconnectDelay * Math.pow(2, reconnectAttempts);
          console.log(`[ProductionRealtime] Reconnecting in ${delay}ms (attempt ${reconnectAttempts + 1}/${maxReconnectAttempts})`);
          
          reconnectTimeoutRef.current = setTimeout(() => {
            setReconnectAttempts(prev => prev + 1);
            connect();
          }, delay);
        } else {
          console.log('[ProductionRealtime] Max reconnection attempts reached, giving up');
        }
      };

      ws.onerror = (error) => {
        console.error('[ProductionRealtime] WebSocket error:', error);
        setConnectionStatus('disconnected');
      };

    } catch (error) {
      console.error('[ProductionRealtime] Failed to create WebSocket connection:', error);
      setConnectionStatus('disconnected');
    }
  };

  useEffect(() => {
    connect();

    return () => {
      console.log('[ProductionRealtime] Cleaning up WebSocket connection');
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (wsRef.current) {
        wsRef.current.close(1000, 'Component cleanup');
      }
    };
  }, []);

  return {
    connectionStatus,
    isConnected: connectionStatus === 'connected',
    reconnectAttempts,
    maxReconnectAttempts
  };
}