import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';

// Real-time score updates hook using WebSocket with polling fallback
export function useRealtimeScores() {
  const queryClient = useQueryClient();
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const pingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
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
        
        // Small delay to ensure connection is stable before joining
        setTimeout(() => {
          if (ws.readyState === WebSocket.OPEN) {
            console.log('[RealtimeScores] Joining admin_updates group for real-time score updates');
            ws.send(JSON.stringify({
              type: 'join_admin_updates',
              userId: 'score_listener_' + Date.now(),
              timestamp: Date.now()
            }));
            
            // Start keep-alive ping to maintain connection
            pingIntervalRef.current = setInterval(() => {
              if (ws.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify({ type: 'ping', timestamp: Date.now() }));
              }
            }, 30000); // Ping every 30 seconds
            
            // Start polling fallback for reliable updates (every 5 seconds with active refetch)
            pollingIntervalRef.current = setInterval(async () => {
              console.log('[RealtimeScores] 🔄 Polling fallback - force refreshing all data');
              try {
                // Force refetch all critical queries to ensure fresh data
                await Promise.all([
                  queryClient.invalidateQueries({ queryKey: ['/api/leagues'], refetchType: 'active' }),
                  queryClient.invalidateQueries({ queryKey: ['/api/scoring'], refetchType: 'active' }),
                  queryClient.invalidateQueries({ queryKey: ['/api/user/stable'], refetchType: 'active' }),
                  queryClient.invalidateQueries({ queryKey: ['/api/admin/current-week'], refetchType: 'active' }),
                ]);
                console.log('[RealtimeScores] ✅ Force refresh complete');
              } catch (error) {
                console.error('[RealtimeScores] ❌ Force refresh failed:', error);
              }
            }, 5000); // More frequent polling (5 seconds)
          }
        }, 100);
      };

      ws.onmessage = async (event) => {
        try {
          const message = JSON.parse(event.data);
          console.log('[RealtimeScores] 📨 Received message:', message.type, 'at', new Date().toLocaleTimeString());
          
          // Handle different types of score updates
          switch (message.type) {
            case 'admin_date_advanced':
              console.log('[RealtimeScores] 🎯 Admin advanced date - triggering immediate cache refresh');
              // Force immediate refresh of all scoring queries with error handling
              try {
                await Promise.all([
                  queryClient.invalidateQueries({ queryKey: ['/api/leagues'], refetchType: 'active' }),
                  queryClient.invalidateQueries({ queryKey: ['/api/scoring'], refetchType: 'active' }),
                  queryClient.invalidateQueries({ queryKey: ['/api/user/stable'], refetchType: 'active' }),
                  queryClient.invalidateQueries({ queryKey: ['/api/admin/current-week'], refetchType: 'active' })
                ]);
                console.log('[RealtimeScores] ✅ All caches refreshed successfully - points should now be visible immediately!');
              } catch (error) {
                console.error('[RealtimeScores] Error refreshing caches:', error);
                // Fallback: trigger refetch anyway
                queryClient.refetchQueries({ queryKey: ['/api/leagues'] });
                queryClient.refetchQueries({ queryKey: ['/api/scoring'] });
              }
              break;
              
            case 'weekly_bonuses_calculated':
              console.log('[RealtimeScores] Weekly bonuses calculated - force refreshing score data');
              await Promise.all([
                queryClient.invalidateQueries({ queryKey: ['/api/leagues'], refetchType: 'active' }),
                queryClient.invalidateQueries({ queryKey: ['/api/scoring'], refetchType: 'active' }),
              ]);
              break;
              
            case 'game_completed':
              console.log('[RealtimeScores] Game completed - force refreshing current data');
              await Promise.all([
                queryClient.invalidateQueries({ queryKey: ['/api/leagues'], refetchType: 'active' }),
                queryClient.invalidateQueries({ queryKey: ['/api/scoring'], refetchType: 'active' }),
              ]);
              break;
              
            case 'admin_season_reset':
              console.log('[RealtimeScores] Season reset - force refreshing all data');
              await Promise.all([
                queryClient.invalidateQueries({ queryKey: ['/api/leagues'], refetchType: 'active' }),
                queryClient.invalidateQueries({ queryKey: ['/api/scoring'], refetchType: 'active' }),
                queryClient.invalidateQueries({ queryKey: ['/api/user/stable'], refetchType: 'active' }),
                queryClient.invalidateQueries({ queryKey: ['/api/admin'], refetchType: 'active' }),
              ]);
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
        
        // Clear ping interval
        if (pingIntervalRef.current) {
          clearInterval(pingIntervalRef.current);
          pingIntervalRef.current = null;
        }
        
        // Clear polling interval
        if (pollingIntervalRef.current) {
          clearInterval(pollingIntervalRef.current);
          pollingIntervalRef.current = null;
        }
        
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
      
      if (pingIntervalRef.current) {
        clearInterval(pingIntervalRef.current);
      }
      
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
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