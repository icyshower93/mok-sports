import { useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/hooks/use-auth';

// Production-optimized WebSocket connection for real-time updates
// Designed for hundreds of concurrent users with efficient broadcasts
// Implements keepalive, auth-aware connection, and resilient reconnection
export function useProductionRealtime() {
  const queryClient = useQueryClient();
  const { user, isLoading: authLoading } = useAuth();
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const pingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<'waiting_auth' | 'connecting' | 'connected' | 'disconnected'>('waiting_auth');
  const [reconnectAttempts, setReconnectAttempts] = useState(0);
  const maxReconnectAttempts = 8; // Increased for better resilience
  const baseReconnectDelay = 1000; // 1 second
  const keepaliveInterval = 25000; // 25 seconds (within mobile timeout limits)

  const startKeepalive = (ws: WebSocket) => {
    // Clear any existing ping interval
    if (pingIntervalRef.current) {
      clearInterval(pingIntervalRef.current);
    }

    // Start keepalive pings every 25 seconds for mobile/proxy compatibility
    pingIntervalRef.current = setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) {
        console.log('[ProductionRealtime] 💓 Sending keepalive ping');
        ws.send(JSON.stringify({ type: 'ping', timestamp: Date.now() }));
      } else {
        console.log('[ProductionRealtime] ⚠️ WebSocket not open, clearing ping interval');
        if (pingIntervalRef.current) {
          clearInterval(pingIntervalRef.current);
          pingIntervalRef.current = null;
        }
      }
    }, keepaliveInterval);
  };

  const connect = () => {
    // Don't connect if auth is still loading or user not available
    if (authLoading || !user) {
      console.log('[ProductionRealtime] ⏳ Waiting for auth completion before WebSocket connection');
      setConnectionStatus('waiting_auth');
      return;
    }

    if (wsRef.current?.readyState === WebSocket.OPEN) {
      console.log('[ProductionRealtime] ✅ WebSocket already connected');
      return;
    }

    setConnectionStatus('connecting');
    console.log('[ProductionRealtime] 🚀 Auth confirmed, establishing WebSocket connection...');
    console.log('[ProductionRealtime] User:', user.name, 'ID:', user.id);

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/draft-ws`;

    try {
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log('[ProductionRealtime] ✅ WebSocket connected successfully');
        setConnectionStatus('connected');
        setReconnectAttempts(0);
        
        // Start keepalive system immediately after connection
        startKeepalive(ws);
        
        // Subscribe to admin broadcasts for real-time updates
        ws.send(JSON.stringify({
          type: 'join_admin_updates',
          timestamp: Date.now(),
          userId: user.id,
          userName: user.name
        }));
        
        console.log('[ProductionRealtime] 📡 Subscribed to admin broadcasts with keepalive active');
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
              // Server keepalive response - connection is alive
              console.log('[ProductionRealtime] 💚 Keepalive pong received - connection healthy');
              break;
            case 'admin_ready':
            case 'connected':
            case 'health_check':
              // Server connection confirmations - no action needed
              console.log('[ProductionRealtime] Server confirmation received:', message.type);
              break;
            default:
              console.log('[ProductionRealtime] Unknown broadcast type:', message.type);
          }
        } catch (error) {
          console.error('[ProductionRealtime] Error parsing WebSocket message:', error);
        }
      };

      ws.onclose = (event) => {
        const closeReasons: Record<number, string> = {
          1000: 'Normal closure',
          1001: 'Going away (page navigation/browser close)',
          1002: 'Protocol error',
          1003: 'Unsupported data',
          1006: 'No close frame (network issue)',
          1011: 'Server error',
          1012: 'Service restart'
        };
        
        const reason = closeReasons[event.code] || 'Unknown';
        console.log(`[ProductionRealtime] 🔌 WebSocket closed: ${event.code} (${reason}) - ${event.reason}`);
        
        setConnectionStatus('disconnected');
        
        // Clear keepalive interval
        if (pingIntervalRef.current) {
          clearInterval(pingIntervalRef.current);
          pingIntervalRef.current = null;
        }
        
        wsRef.current = null;

        // Don't reconnect if user navigated away (code 1001) unless it's a service worker update
        const isNavigationClose = event.code === 1001;
        const shouldReconnect = !isNavigationClose || (isNavigationClose && event.reason?.includes('sw-update'));
        
        if (shouldReconnect && reconnectAttempts < maxReconnectAttempts && user && !authLoading) {
          const delay = Math.min(baseReconnectDelay * Math.pow(2, reconnectAttempts), 30000); // Cap at 30s
          console.log(`[ProductionRealtime] 🔄 Reconnecting in ${delay}ms (attempt ${reconnectAttempts + 1}/${maxReconnectAttempts})`);
          
          reconnectTimeoutRef.current = setTimeout(() => {
            setReconnectAttempts(prev => prev + 1);
            connect();
          }, delay);
        } else if (isNavigationClose && !event.reason?.includes('sw-update')) {
          console.log('[ProductionRealtime] 👋 Page navigation detected, not reconnecting');
        } else if (!user || authLoading) {
          console.log('[ProductionRealtime] ⏳ Auth not ready, not reconnecting');
        } else {
          console.log('[ProductionRealtime] ❌ Max reconnection attempts reached');
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

  // Effect to handle auth-aware connection and service worker updates
  useEffect(() => {
    // Only attempt connection when auth is ready and user exists
    if (!authLoading && user) {
      console.log('[ProductionRealtime] 🔐 Auth ready, initiating WebSocket connection');
      connect();
    } else if (!authLoading && !user) {
      console.log('[ProductionRealtime] 🚫 No authenticated user, skipping WebSocket connection');
      setConnectionStatus('disconnected');
    }

    // Service worker update handler - gracefully reconnect after SW updates
    const handleServiceWorkerUpdate = () => {
      console.log('[ProductionRealtime] 🔄 Service worker updated, preparing for reconnection');
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.close(1000, 'sw-update');
      }
    };

    // Listen for service worker updates
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('controllerchange', handleServiceWorkerUpdate);
    }

    return () => {
      console.log('[ProductionRealtime] 🧹 Cleaning up WebSocket connection');
      
      // Clear all intervals and timeouts
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
      if (pingIntervalRef.current) {
        clearInterval(pingIntervalRef.current);
        pingIntervalRef.current = null;
      }
      
      // Close connection gracefully
      if (wsRef.current) {
        wsRef.current.close(1000, 'Component cleanup');
        wsRef.current = null;
      }

      // Remove service worker listener
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.removeEventListener('controllerchange', handleServiceWorkerUpdate);
      }
    };
  }, [authLoading, user]); // Depend on auth state

  return {
    connectionStatus,
    isConnected: connectionStatus === 'connected',
    isWaitingAuth: connectionStatus === 'waiting_auth',
    reconnectAttempts,
    maxReconnectAttempts,
    user: user?.name || 'Unknown'
  };
}