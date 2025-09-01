import { trace } from "@/debug/trace";
trace("websocket-manager.ts");
// Singleton WebSocket manager for persistent connections across component lifecycles
import { QueryClient } from '@tanstack/react-query';

class WebSocketManager {
  private ws: WebSocket | null = null;
  private reconnectTimeout: NodeJS.Timeout | null = null;
  private pingInterval: NodeJS.Timeout | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private queryClient: QueryClient | null = null;
  private isConnecting = false;
  private connectionListeners = new Set<() => void>();
  private disconnectionListeners = new Set<() => void>();

  setQueryClient(queryClient: QueryClient) {
    this.queryClient = queryClient;
  }

  addConnectionListener(listener: () => void) {
    this.connectionListeners.add(listener);
  }

  removeConnectionListener(listener: () => void) {
    this.connectionListeners.delete(listener);
  }

  addDisconnectionListener(listener: () => void) {
    this.disconnectionListeners.add(listener);
  }

  removeDisconnectionListener(listener: () => void) {
    this.disconnectionListeners.delete(listener);
  }

  private notifyConnectionListeners() {
    this.connectionListeners.forEach(listener => listener());
  }

  private notifyDisconnectionListeners() {
    this.disconnectionListeners.forEach(listener => listener());
  }

  connect() {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      console.log('[WebSocketManager] Already connected');
      return;
    }

    if (this.isConnecting) {
      console.log('[WebSocketManager] Connection already in progress');
      return;
    }

    this.isConnecting = true;

    try {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}/draft-ws`;
      
      console.log('[WebSocketManager] PWA-optimized connection to:', wsUrl);
      
      this.ws = new WebSocket(wsUrl);

      // Prevent browser/PWA from prematurely closing connection
      this.ws.binaryType = 'arraybuffer';

      this.ws.onopen = () => {
        console.log('[WebSocketManager] ✅ PWA WebSocket connected successfully');
        this.isConnecting = false;
        this.reconnectAttempts = 0;
        
        // Immediate and persistent setup for PWA environment
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
          // Send join message immediately
          this.ws.send(JSON.stringify({
            type: 'join_admin_updates',
            userId: 'pwa_persistent_listener_' + Date.now(),
            timestamp: Date.now()
          }));
          
          // Start ultra-frequent keep-alive for PWA stability (10 seconds)
          this.pingInterval = setInterval(() => {
            if (this.ws && this.ws.readyState === WebSocket.OPEN) {
              this.ws.send(JSON.stringify({ 
                type: 'ping', 
                timestamp: Date.now(),
                pwaKeepAlive: true 
              }));
            } else {
              console.log('[WebSocketManager] Connection lost during ping, reconnecting...');
              this.reconnect();
            }
          }, 10000); // Very frequent pings for PWA (10 seconds)
          
          // Additional PWA-specific connection stability measures
          this.setupPWAConnectionMaintenance();
          
          this.notifyConnectionListeners();
        }
      };

      this.ws.onmessage = async (event) => {
        try {
          const message = JSON.parse(event.data);
          console.log('[WebSocketManager] 📨 Received:', message.type, new Date().toLocaleTimeString());
          
          if (!this.queryClient) {
            console.log('[WebSocketManager] No query client available for cache refresh');
            return;
          }

          // Handle different message types with immediate data refresh
          switch (message.type) {
            case 'admin_date_advanced':
              console.log('[WebSocketManager] 🎯 Admin date advanced - immediate refresh');
              await this.refreshAllData();
              break;
              
            case 'admin_season_reset':
              console.log('[WebSocketManager] 🔄 Season reset - comprehensive refresh');
              await this.refreshAllData();
              break;
              
            case 'weekly_bonuses_calculated':
              console.log('[WebSocketManager] 🏆 Weekly bonuses calculated - refresh scores');
              await this.refreshScoreData();
              break;
              
            case 'game_completed':
              console.log('[WebSocketManager] 🏈 Game completed - refresh current data');
              await this.refreshScoreData();
              break;
          }
        } catch (error) {
          console.error('[WebSocketManager] Error handling message:', error);
        }
      };

      this.ws.onerror = (error) => {
        console.error('[WebSocketManager] ❌ WebSocket error:', error);
        this.isConnecting = false;
      };

      this.ws.onclose = (event) => {
        console.log('[WebSocketManager] Connection closed:', event.code, event.reason);
        this.isConnecting = false;
        this.ws = null;
        
        // Clear ping interval
        if (this.pingInterval) {
          clearInterval(this.pingInterval);
          this.pingInterval = null;
        }
        
        this.notifyDisconnectionListeners();
        
        // Only reconnect if not a clean close and we haven't exceeded max attempts
        if (event.code !== 1000 && this.reconnectAttempts < this.maxReconnectAttempts) {
          console.log(`[WebSocketManager] Scheduling reconnection attempt ${this.reconnectAttempts + 1}`);
          this.scheduleReconnect();
        }
      };

    } catch (error) {
      console.error('[WebSocketManager] Connection error:', error);
      this.isConnecting = false;
      this.scheduleReconnect();
    }
  }

  private scheduleReconnect() {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
    }
    
    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000);
    this.reconnectAttempts++;
    
    console.log(`[WebSocketManager] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})`);
    
    this.reconnectTimeout = setTimeout(() => {
      this.reconnect();
    }, delay);
  }

  private reconnect() {
    console.log('[WebSocketManager] Attempting reconnection...');
    this.connect();
  }

  private async refreshAllData() {
    if (!this.queryClient) return;
    
    try {
      await Promise.all([
        this.queryClient.invalidateQueries({ queryKey: ['/api/leagues'], refetchType: 'active' }),
        this.queryClient.invalidateQueries({ queryKey: ['/api/scoring'], refetchType: 'active' }),
        this.queryClient.invalidateQueries({ queryKey: ['/api/user/stable'], refetchType: 'active' }),
        this.queryClient.invalidateQueries({ queryKey: ['/api/admin/current-week'], refetchType: 'active' }),
      ]);
      console.log('[WebSocketManager] ✅ All data refreshed');
    } catch (error) {
      console.error('[WebSocketManager] ❌ Data refresh failed:', error);
    }
  }

  private async refreshScoreData() {
    if (!this.queryClient) return;
    
    try {
      await Promise.all([
        this.queryClient.invalidateQueries({ queryKey: ['/api/leagues'], refetchType: 'active' }),
        this.queryClient.invalidateQueries({ queryKey: ['/api/scoring'], refetchType: 'active' }),
      ]);
      console.log('[WebSocketManager] ✅ Score data refreshed');
    } catch (error) {
      console.error('[WebSocketManager] ❌ Score refresh failed:', error);
    }
  }

  disconnect() {
    console.log('[WebSocketManager] Disconnecting...');
    
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
    
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
    
    if (this.ws) {
      this.ws.close(1000, 'Normal closure');
      this.ws = null;
    }
    
    this.reconnectAttempts = 0;
    this.isConnecting = false;
  }

  isConnected(): boolean {
    return this.ws !== null && this.ws.readyState === WebSocket.OPEN;
  }

  getConnectionState(): string {
    if (!this.ws) return 'DISCONNECTED';
    
    switch (this.ws.readyState) {
      case WebSocket.CONNECTING: return 'CONNECTING';
      case WebSocket.OPEN: return 'OPEN';
      case WebSocket.CLOSING: return 'CLOSING';
      case WebSocket.CLOSED: return 'CLOSED';
      default: return 'UNKNOWN';
    }
  }

  // PWA-specific connection maintenance
  private setupPWAConnectionMaintenance() {
    console.log('[WebSocketManager] Setting up PWA connection maintenance');
    
    // Listen for PWA visibility changes
    if (typeof document !== 'undefined') {
      const handleVisibilityChange = () => {
        if (document.visibilityState === 'visible' && this.ws?.readyState !== WebSocket.OPEN) {
          console.log('[WebSocketManager] PWA became visible, checking connection...');
          this.reconnect();
        }
      };
      
      document.addEventListener('visibilitychange', handleVisibilityChange);
    }
    
    // Listen for PWA lifecycle events
    if (typeof window !== 'undefined') {
      const handleFocus = () => {
        if (this.ws?.readyState !== WebSocket.OPEN) {
          console.log('[WebSocketManager] PWA focused, ensuring connection...');
          this.reconnect();
        }
      };
      
      const handleOnline = () => {
        console.log('[WebSocketManager] PWA back online, reconnecting...');
        this.reconnect();
      };
      
      window.addEventListener('focus', handleFocus);
      window.addEventListener('online', handleOnline);
    }
  }
}

// ✅ Lazy accessor pattern to prevent TDZ errors
let _webSocketManager: WebSocketManager | null = null;
export function getWebSocketManager(): WebSocketManager {
  return (_webSocketManager ??= new WebSocketManager());
}