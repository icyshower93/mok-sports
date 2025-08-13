import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';

// Real-time score updates hook using WebSocket
export function useRealtimeScores() {
  const queryClient = useQueryClient();
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttempts = useRef(0);
  const maxReconnectAttempts = 5;

  const connectWebSocket = () => {
    try {
      // Connect to the same WebSocket endpoint used for drafts (admin_updates group)
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}/draft-ws`;
      
      console.log('[RealtimeScores] Connecting to WebSocket:', wsUrl);
      
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log('[RealtimeScores] WebSocket connected successfully');
        reconnectAttempts.current = 0;
        
        // Join the admin_updates group to receive score updates
        ws.send(JSON.stringify({
          type: 'join_admin_updates',
          userId: 'score_listener_' + Date.now(),
          timestamp: Date.now()
        }));
      };

      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          console.log('[RealtimeScores] Received message:', message.type);
          
          // Handle different types of score updates
          switch (message.type) {
            case 'admin_date_advanced':
              console.log('[RealtimeScores] Admin advanced date - refreshing all score data');
              // Invalidate all scoring-related queries
              queryClient.invalidateQueries({ queryKey: ['/api/leagues'] });
              queryClient.invalidateQueries({ queryKey: ['/api/scoring'] });
              queryClient.invalidateQueries({ queryKey: ['/api/user/stable'] });
              queryClient.invalidateQueries({ queryKey: ['/api/admin/current-week'] });
              break;
              
            case 'weekly_bonuses_calculated':
              console.log('[RealtimeScores] Weekly bonuses calculated - refreshing score data');
              // Specific refresh for bonus calculations
              queryClient.invalidateQueries({ queryKey: ['/api/leagues'] });
              queryClient.invalidateQueries({ queryKey: ['/api/scoring'] });
              break;
              
            case 'game_completed':
              console.log('[RealtimeScores] Game completed - refreshing current data');
              // Refresh current scores when individual games complete
              queryClient.invalidateQueries({ queryKey: ['/api/leagues'] });
              queryClient.invalidateQueries({ queryKey: ['/api/scoring'] });
              break;
              
            case 'admin_season_reset':
              console.log('[RealtimeScores] Season reset - refreshing all data');
              // Comprehensive refresh when season is reset
              queryClient.invalidateQueries({ queryKey: ['/api/leagues'] });
              queryClient.invalidateQueries({ queryKey: ['/api/scoring'] });
              queryClient.invalidateQueries({ queryKey: ['/api/user/stable'] });
              queryClient.invalidateQueries({ queryKey: ['/api/admin'] });
              break;
              
            default:
              // Ignore other message types (draft-specific, etc.)
              break;
          }
        } catch (error) {
          console.error('[RealtimeScores] Error parsing WebSocket message:', error);
        }
      };

      ws.onerror = (error) => {
        console.error('[RealtimeScores] WebSocket error:', error);
      };

      ws.onclose = (event) => {
        console.log('[RealtimeScores] WebSocket closed:', event.code, event.reason);
        wsRef.current = null;
        
        // Attempt to reconnect if not intentionally closed
        if (event.code !== 1000 && reconnectAttempts.current < maxReconnectAttempts) {
          const delay = Math.min(1000 * Math.pow(2, reconnectAttempts.current), 30000);
          console.log(`[RealtimeScores] Reconnecting in ${delay}ms (attempt ${reconnectAttempts.current + 1}/${maxReconnectAttempts})`);
          
          reconnectTimeoutRef.current = setTimeout(() => {
            reconnectAttempts.current++;
            connectWebSocket();
          }, delay);
        } else {
          console.log('[RealtimeScores] Max reconnection attempts reached or connection closed intentionally');
        }
      };
      
    } catch (error) {
      console.error('[RealtimeScores] Error creating WebSocket connection:', error);
    }
  };

  useEffect(() => {
    connectWebSocket();
    
    return () => {
      // Cleanup on unmount
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      
      if (wsRef.current) {
        wsRef.current.close(1000, 'Component unmounting');
        wsRef.current = null;
      }
    };
  }, []);

  // Return connection status for debugging
  return {
    isConnected: wsRef.current?.readyState === WebSocket.OPEN,
    connectionState: wsRef.current?.readyState
  };
}