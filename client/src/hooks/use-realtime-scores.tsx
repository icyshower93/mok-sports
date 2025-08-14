import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { webSocketManager } from '../services/websocket-manager';

// Real-time score updates hook using persistent WebSocket manager
export function useRealtimeScores() {
  const queryClient = useQueryClient();

  useEffect(() => {
    console.log('[RealtimeScores] Setting up persistent WebSocket connection');
    
    // Provide query client to the WebSocket manager
    webSocketManager.setQueryClient(queryClient);
    
    // Connect to WebSocket (will be persistent across component lifecycles)
    webSocketManager.connect();
    
    // Component cleanup - but DON'T disconnect the WebSocket
    // This allows the connection to persist across component re-renders and page navigation
    return () => {
      console.log('[RealtimeScores] Component cleanup - keeping WebSocket connection active');
      // Note: We don't call webSocketManager.disconnect() here to maintain persistence
    };
  }, [queryClient]);

  return null; // This hook doesn't return anything, just manages the connection
}