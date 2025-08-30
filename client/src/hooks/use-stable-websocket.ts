import { useEffect, useRef, useState, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/hooks/use-auth';

interface WebSocketMessage {
  type: string;
  data?: any;
  timestamp?: number;
}

type MessageCallback = (message: WebSocketMessage) => void;
type ConnectionStatus = 'waiting_auth' | 'connecting' | 'connected' | 'disconnected' | 'reconnecting';

// Safe WebSocket close codes (1000 or 3000-4999)
const CLOSE_CODES = {
  NORMAL: 1000,
  SW_UPDATE: 4001,  // Custom code for service worker updates
  AUTH_LOST: 4002,  // Custom code for authentication loss
  MANUAL: 4003      // Custom code for manual disconnect
} as const;

/**
 * Production-ready WebSocket hook for real-time updates
 * 
 * Features:
 * - Waits for authentication before connecting
 * - Uses safe browser close codes (1000, 3000-4999)
 * - Handles service worker updates gracefully
 * - 25-second keepalive pings to prevent timeouts
 * - Exponential backoff reconnection (max 8 attempts)
 * - Proper cleanup to prevent multiple parallel connections
 * - Comprehensive error handling and logging
 * 
 * @param onMessage Optional callback for handling incoming messages
 * @returns Connection status and utility functions
 */
export function useStableWebSocket(onMessage?: MessageCallback) {
  const queryClient = useQueryClient();
  const { user, isLoading: authLoading } = useAuth();
  
  // Refs for managing connection state
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const pingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const cleanupTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isConnectingRef = useRef(false);
  
  // State
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('waiting_auth');
  const reconnectAttempts = useRef(0);
  const maxReconnectAttempts = 8;
  
  // Keep callback ref updated
  const messageCallbackRef = useRef<MessageCallback | undefined>(onMessage);
  messageCallbackRef.current = onMessage;

  /**
   * Safely close WebSocket connection with proper error handling
   */
  const closeConnection = useCallback((code: number = CLOSE_CODES.NORMAL, reason: string = 'disconnect') => {
    if (wsRef.current) {
      const currentSocket = wsRef.current;
      wsRef.current = null;
      
      try {
        if (currentSocket.readyState === WebSocket.OPEN || currentSocket.readyState === WebSocket.CONNECTING) {
          console.log(`[StableWebSocket] 🔌 Closing connection with code ${code}: ${reason}`);
          currentSocket.close(code, reason);
        }
      } catch (error) {
        console.warn('[StableWebSocket] ⚠️ Error closing WebSocket:', error);
        // Don't throw - just log the error and continue cleanup
      }
    }
  }, []);

  /**
   * Clean up all timers and intervals
   */
  const cleanup = useCallback(() => {
    console.log('[StableWebSocket] 🧹 Cleaning up all timers and connections');
    
    // Clear all timers
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    
    if (pingIntervalRef.current) {
      clearInterval(pingIntervalRef.current);
      pingIntervalRef.current = null;
    }
    
    if (cleanupTimeoutRef.current) {
      clearTimeout(cleanupTimeoutRef.current);
      cleanupTimeoutRef.current = null;
    }
    
    isConnectingRef.current = false;
  }, []);

  /**
   * Start keepalive ping interval (25 seconds)
   */
  const startKeepalive = useCallback(() => {
    // Clear existing interval first
    if (pingIntervalRef.current) {
      clearInterval(pingIntervalRef.current);
    }
    
    pingIntervalRef.current = setInterval(() => {
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        try {
          console.log('[StableWebSocket] 💓 Sending keepalive ping');
          wsRef.current.send(JSON.stringify({
            type: 'ping',
            timestamp: Date.now(),
            connectionId: `keepalive_${Date.now()}`
          }));
        } catch (error) {
          console.warn('[StableWebSocket] ⚠️ Failed to send keepalive ping:', error);
        }
      }
    }, 25000); // 25 seconds - optimized for mobile/PWA
    
    console.log('[StableWebSocket] ⏰ Keepalive started (25s interval)');
  }, []);

  /**
   * Handle incoming WebSocket messages
   */
  const handleMessage = useCallback((event: MessageEvent) => {
    try {
      const message: WebSocketMessage = JSON.parse(event.data);
      console.log('[StableWebSocket] 📨 Message received:', message.type);
      
      // Handle system messages
      switch (message.type) {
        case 'pong':
          console.log('[StableWebSocket] 💚 Keepalive pong received - connection healthy');
          break;
          
        case 'admin_date_advanced':
          console.log('[StableWebSocket] 📅 Admin date advanced - refreshing all data');
          // Invalidate all scoring-related queries
          queryClient.invalidateQueries({ queryKey: ['/api/scoring'] });
          // Invalidate all league queries (includes standings, members, etc)
          queryClient.invalidateQueries({ 
            predicate: (query) => {
              const key = query.queryKey[0] as string;
              return key?.startsWith('/api/leagues') || key?.startsWith('/api/user/leagues');
            }
          });
          queryClient.invalidateQueries({ queryKey: ['/api/admin/current-week'] });
          break;
          
        case 'admin_season_reset':
          console.log('[StableWebSocket] 🔄 Season reset - refreshing all data');
          // Invalidate ALL queries to ensure complete refresh after reset
          queryClient.invalidateQueries({ 
            predicate: (query) => {
              const key = query.queryKey[0] as string;
              return key?.startsWith('/api/leagues') || 
                     key?.startsWith('/api/scoring') || 
                     key?.startsWith('/api/user/leagues') ||
                     key?.startsWith('/api/admin');
            }
          });
          console.log('[StableWebSocket] 🔄 All league, scoring, and user data invalidated');
          break;
          
        case 'score_update':
        case 'weekly_bonuses_calculated':
        case 'weekly_skins_awarded':
        case 'weekly_skins_rollover':
          console.log('[StableWebSocket] 🏆 Score/skins update - refreshing scores and league standings');
          // Invalidate scoring queries (includes weekly scores, skins, etc)
          queryClient.invalidateQueries({ queryKey: ['/api/scoring'] });
          // Invalidate league standings since points changed
          queryClient.invalidateQueries({ 
            predicate: (query) => {
              const key = query.queryKey[0] as string;
              return key?.startsWith('/api/leagues') && key?.includes('/standings');
            }
          });
          break;
          
        case 'admin_ready':
        case 'connected':
        case 'health_check':
        case 'identified':
          // Server confirmations - no action needed
          console.log('[StableWebSocket] ✅ Server confirmation:', message.type);
          break;
          
        default:
          console.log('[StableWebSocket] ❓ Unknown message type:', message.type);
      }
      
      // Call custom callback if provided
      if (messageCallbackRef.current) {
        messageCallbackRef.current(message);
      }
      
    } catch (error) {
      console.error('[StableWebSocket] ❌ Error parsing message:', error);
    }
  }, [queryClient]);

  /**
   * Calculate exponential backoff delay
   */
  const getReconnectDelay = useCallback(() => {
    const baseDelay = 1000; // 1 second
    const maxDelay = 30000; // 30 seconds max
    const delay = Math.min(baseDelay * Math.pow(2, reconnectAttempts.current), maxDelay);
    return delay + Math.random() * 1000; // Add jitter
  }, []);

  /**
   * Establish WebSocket connection with comprehensive error handling
   */
  const connect = useCallback(() => {
    // Prevent multiple simultaneous connections
    if (isConnectingRef.current || !user || authLoading) {
      if (!user && !authLoading) {
        console.log('[StableWebSocket] 🚫 No authenticated user, skipping connection');
        setConnectionStatus('waiting_auth');
      } else if (isConnectingRef.current) {
        console.log('[StableWebSocket] 🔄 Connection already in progress, skipping');
      }
      return;
    }
    
    // Clean up any existing connection
    cleanup();
    closeConnection(CLOSE_CODES.MANUAL, 'new-connection');
    
    isConnectingRef.current = true;
    setConnectionStatus('connecting');
    
    try {
      console.log('[StableWebSocket] 🚀 Establishing connection for user:', user.name);
      
      // Create WebSocket connection
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}/draft-ws`;
      
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;
      
      // Connection opened successfully
      ws.onopen = () => {
        console.log('[StableWebSocket] ✅ Connection established');
        isConnectingRef.current = false;
        setConnectionStatus('connected');
        reconnectAttempts.current = 0;
        
        // Subscribe to admin broadcasts
        try {
          ws.send(JSON.stringify({
            type: 'join_admin_updates',
            userId: user.id,
            userName: user.name,
            timestamp: Date.now()
          }));
          console.log('[StableWebSocket] 📡 Subscribed to admin broadcasts');
        } catch (error) {
          console.warn('[StableWebSocket] ⚠️ Failed to subscribe:', error);
        }
        
        // Start keepalive
        startKeepalive();
      };
      
      // Handle incoming messages
      ws.onmessage = handleMessage;
      
      // Connection closed
      ws.onclose = (event) => {
        isConnectingRef.current = false;
        wsRef.current = null;
        
        console.log(`[StableWebSocket] 🔌 Connection closed - Code: ${event.code}, Reason: ${event.reason}`);
        
        // Clean up keepalive
        if (pingIntervalRef.current) {
          clearInterval(pingIntervalRef.current);
          pingIntervalRef.current = null;
        }
        
        // Determine if we should reconnect
        const shouldReconnect = 
          event.code !== CLOSE_CODES.MANUAL && 
          event.code !== CLOSE_CODES.AUTH_LOST &&
          reconnectAttempts.current < maxReconnectAttempts &&
          user && !authLoading;
        
        if (shouldReconnect) {
          const delay = getReconnectDelay();
          reconnectAttempts.current++;
          
          console.log(`[StableWebSocket] 🔄 Reconnecting in ${delay}ms (attempt ${reconnectAttempts.current}/${maxReconnectAttempts})`);
          setConnectionStatus('reconnecting');
          
          reconnectTimeoutRef.current = setTimeout(() => {
            connect();
          }, delay);
          
        } else {
          console.log('[StableWebSocket] ⛔ Not reconnecting - manual close or max attempts reached');
          setConnectionStatus('disconnected');
          reconnectAttempts.current = 0;
        }
      };
      
      // Connection error
      ws.onerror = (error) => {
        console.error('[StableWebSocket] ❌ Connection error:', error);
        isConnectingRef.current = false;
      };
      
    } catch (error) {
      console.error('[StableWebSocket] ❌ Failed to create WebSocket:', error);
      isConnectingRef.current = false;
      setConnectionStatus('disconnected');
    }
  }, [user, authLoading, cleanup, closeConnection, handleMessage, startKeepalive, getReconnectDelay]);

  /**
   * Handle service worker updates gracefully
   */
  const handleServiceWorkerUpdate = useCallback(() => {
    console.log('[StableWebSocket] 🔄 Service worker updated, gracefully reconnecting');
    
    closeConnection(CLOSE_CODES.SW_UPDATE, 'sw-update');
    
    // Brief delay before reconnecting to let SW settle
    cleanupTimeoutRef.current = setTimeout(() => {
      if (user && !authLoading) {
        connect();
      }
    }, 2000);
  }, [user, authLoading, closeConnection, connect]);

  // Effect: Wait for auth then connect
  useEffect(() => {
    if (authLoading) {
      console.log('[StableWebSocket] ⏳ Waiting for authentication...');
      setConnectionStatus('waiting_auth');
      return;
    }
    
    if (!user) {
      console.log('[StableWebSocket] 🚫 No authenticated user');
      setConnectionStatus('waiting_auth');
      cleanup();
      closeConnection(CLOSE_CODES.AUTH_LOST, 'auth-lost');
      return;
    }
    
    console.log('[StableWebSocket] 🔐 Auth confirmed, establishing connection');
    connect();
  }, [user, authLoading, connect, cleanup, closeConnection]);

  // Effect: Listen for service worker updates
  useEffect(() => {
    if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
      navigator.serviceWorker.addEventListener('controllerchange', handleServiceWorkerUpdate);
      
      return () => {
        navigator.serviceWorker.removeEventListener('controllerchange', handleServiceWorkerUpdate);
      };
    }
  }, [handleServiceWorkerUpdate]);

  // Effect: Cleanup on unmount
  useEffect(() => {
    return () => {
      console.log('[StableWebSocket] 🧹 Component unmounting, cleaning up');
      cleanup();
      closeConnection(CLOSE_CODES.MANUAL, 'unmount');
    };
  }, [cleanup, closeConnection]);

  // Public API
  const disconnect = useCallback(() => {
    console.log('[StableWebSocket] 🔌 Manual disconnect requested');
    cleanup();
    closeConnection(CLOSE_CODES.MANUAL, 'manual-disconnect');
    setConnectionStatus('disconnected');
    reconnectAttempts.current = 0;
  }, [cleanup, closeConnection]);

  const reconnect = useCallback(() => {
    console.log('[StableWebSocket] 🔄 Manual reconnect requested');
    reconnectAttempts.current = 0;
    connect();
  }, [connect]);

  return {
    connectionStatus,
    isConnected: connectionStatus === 'connected',
    isConnecting: connectionStatus === 'connecting' || connectionStatus === 'reconnecting',
    reconnectAttempts: reconnectAttempts.current,
    maxReconnectAttempts,
    disconnect,
    reconnect
  };
}

