import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { getWebSocketManager } from '@/services/websocket-manager';

// Real-time score updates hook using persistent WebSocket manager
export function useRealtimeScores() {
  const queryClient = useQueryClient();
  const [connectionState, setConnectionState] = useState('connecting');

  useEffect(() => {
    console.log('[RealtimeScores] Setting up persistent WebSocket connection');
    
    // Provide query client to the WebSocket manager
    const webSocketManager = getWebSocketManager();
    webSocketManager.setQueryClient(queryClient);
    
    // Add connection listeners to track state changes
    const onConnect = () => {
      console.log('[RealtimeScores] WebSocket connected');
      setConnectionState('connected');
    };
    
    const onDisconnect = () => {
      console.log('[RealtimeScores] WebSocket disconnected');
      setConnectionState('disconnected');
    };
    
    webSocketManager.addConnectionListener(onConnect);
    webSocketManager.addDisconnectionListener(onDisconnect);
    
    // Connect to WebSocket (will be persistent across component lifecycles)
    webSocketManager.connect();
    
    // Update initial state based on current connection
    setConnectionState(webSocketManager.isConnected() ? 'connected' : 'connecting');
    
    // Component cleanup - but DON'T disconnect the WebSocket
    return () => {
      console.log('[RealtimeScores] Component cleanup - keeping WebSocket connection active');
      webSocketManager.removeConnectionListener(onConnect);
      webSocketManager.removeDisconnectionListener(onDisconnect);
      // Note: We don't call webSocketManager.disconnect() here to maintain persistence
    };
  }, [queryClient]);

  return {
    connectionStatus: connectionState,
    isConnected: connectionState === 'connected'
  };
}