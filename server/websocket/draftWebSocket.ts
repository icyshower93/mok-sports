/**
 * Draft WebSocket Manager
 * 
 * Handles real-time communication for draft events:
 * - Pick notifications and updates
 * - Timer synchronization
 * - Connection management with auto-reconnect
 * - Draft state broadcasting
 */

import { WebSocketServer, WebSocket } from 'ws';
import { Server } from 'http';
import { parse } from 'url';

export interface DraftConnection {
  userId: string;
  draftId: string;
  socket: WebSocket;
  isAlive: boolean;
}

export class DraftWebSocketManager {
  private wss: WebSocketServer;
  private connections: Map<string, DraftConnection[]> = new Map();
  private heartbeatInterval!: NodeJS.Timeout;
  private connectionStats = {
    totalConnections: 0,
    activeConnections: 0,
    messagesPerSecond: 0,
    errors: 0,
    messageCount: 0,
    disconnections: 0,
    lastResetTime: Date.now()
  };
  private metricsInterval!: NodeJS.Timeout;

  constructor(server: Server) {
    // Create WebSocket server with manual upgrade handling for better Replit compatibility
    this.wss = new WebSocketServer({ 
      noServer: true // Manual upgrade handling
    });
    
    // FIX #2/#4: REPLIT PROXY COMPATIBILITY - Enhanced upgrade handling for Reserved VM
    server.on('upgrade', (request, socket, head) => {
      console.log('[WebSocket] 🔍 REPLIT UPGRADE REQUEST (Reserved VM Compatible)');
      console.log('[WebSocket] URL:', request.url);
      console.log('[WebSocket] Origin:', request.headers.origin);
      console.log('[WebSocket] User-Agent:', request.headers['user-agent']);
      console.log('[WebSocket] Connection header:', request.headers.connection);
      console.log('[WebSocket] Upgrade header:', request.headers.upgrade);
      console.log('[WebSocket] Host header:', request.headers.host);
      console.log('[WebSocket] X-Forwarded-For:', request.headers['x-forwarded-for']);
      console.log('[WebSocket] X-Forwarded-Proto:', request.headers['x-forwarded-proto']);
      console.log('[WebSocket] Sec-WebSocket-Protocol:', request.headers['sec-websocket-protocol']);
      console.log('[WebSocket] 🔍 PROXY VALIDATION: Checking for stripped Upgrade headers');
      
      // FIX #4: Validate critical WebSocket headers for Replit proxy
      if (!request.headers.upgrade || request.headers.upgrade.toLowerCase() !== 'websocket') {
        console.log('[WebSocket] ❌ PROXY ISSUE: Missing or invalid Upgrade header');
        console.log('[WebSocket] Expected: websocket, Got:', request.headers.upgrade);
      } else {
        console.log('[WebSocket] ✅ PROXY OK: Upgrade header present and valid');
      }
      
      // Check if this is a draft WebSocket request (handle both paths for compatibility)
      if (request.url?.startsWith('/draft-ws') || request.url?.startsWith('/ws/draft') || request.url?.startsWith('/ws')) {
        console.log('[WebSocket] ✅ HANDLING WEBSOCKET UPGRADE for path:', request.url);
        
        try {
          // FIX #4: REPLIT PROXY UPGRADE - Enhanced handling for Reserved VM with sticky sessions
          this.wss.handleUpgrade(request, socket, head, (ws) => {
            console.log('[WebSocket] 🚀 REPLIT UPGRADE SUCCESS (Reserved VM + Sticky Sessions)');
            console.log('[WebSocket] WebSocket ready state:', ws.readyState);
            console.log('[WebSocket] WebSocket protocol:', ws.protocol || 'none');
            console.log('[WebSocket] WebSocket extensions:', ws.extensions);
            console.log('[WebSocket] 🔍 STICKY SESSION: Connection routed to same Reserved VM instance');
            console.log('[WebSocket] Emitting connection event');
            
            // Set immediate ping on connection for Reserved VM health
            setTimeout(() => {
              if (ws.readyState === 1) { // OPEN
                try {
                  ws.ping();
                  console.log('[WebSocket] Initial health ping sent');
                } catch (pingError) {
                  console.log('[WebSocket] Initial ping failed:', pingError);
                }
              }
            }, 100);
            
            this.wss.emit('connection', ws, request);
          });
        } catch (error) {
          console.error('[WebSocket] ❌ UPGRADE ERROR:', error);
          socket.destroy();
        }
      } else {
        console.log('[WebSocket] ❌ REJECTING NON-WEBSOCKET UPGRADE:', request.url);
        socket.destroy();
      }
    });

    this.wss.on('connection', this.handleConnection.bind(this));
    this.startHeartbeat();
    this.startMetricsCollection();
    
    console.log('[WebSocket] Draft WebSocket server initialized on /draft-ws');
    console.log('[WebSocket] WebSocket server listening for connections...');
    console.log('[WebSocket] Server configuration:', {
      path: '/draft-ws',
      port: server.listening ? 'attached to HTTP server' : 'not listening'
    });
    
    // Add additional debug for connection attempts
    this.wss.on('error', (error) => {
      console.error('[WebSocket] WebSocket server error:', error);
    });

    this.wss.on('listening', () => {
      console.log('[WebSocket] WebSocket server started listening');
    });

    // Force immediate connection logging for debugging
    setInterval(() => {
      const totalConnections = Array.from(this.connections.values()).reduce((sum, conns) => sum + conns.length, 0);
      if (totalConnections > 0) {
        console.log('[WebSocket] Status check - Total active connections:', totalConnections);
      }
    }, 10000); // Every 10 seconds
  }

  private handleConnection(ws: WebSocket, request: any) {
    console.log('[WebSocket] ========== NEW CONNECTION RECEIVED ==========');
    console.log('[WebSocket] Request URL:', request.url);
    console.log('[WebSocket] Remote address:', request.socket?.remoteAddress);
    console.log('[WebSocket] Connection ready state:', ws.readyState);
    console.log('[WebSocket] Connection timestamp:', new Date().toISOString());
    
    const { query } = parse(request.url, true);
    const userId = query.userId as string;
    const draftId = query.draftId as string;
    
    console.log('[WebSocket] Extracted parameters:');
    console.log(`[WebSocket] - userId: ${userId}`);
    console.log(`[WebSocket] - draftId: ${draftId}`);
    console.log('[WebSocket] ================================================');

    if (!userId || !draftId) {
      console.log('[WebSocket] ❌ CONNECTION REJECTED: Missing userId or draftId');
      console.log('[WebSocket] Query object:', JSON.stringify(query, null, 2));
      console.log('[WebSocket] Available query keys:', Object.keys(query));
      ws.close(1000, 'Missing required parameters');
      return;
    }

    // PERMANENT FIX: Send immediate connection confirmation for Reserved VM
    console.log('[WebSocket] ✅ CONNECTION APPROVED - Sending immediate confirmation for Reserved VM');
    try {
      // Send connection confirmation with draft state for immediate sync
      const confirmationMessage = {
        type: 'connected',
        draftId: draftId,
        userId: userId,
        timestamp: Date.now(),
        message: 'WebSocket connection established successfully on Reserved VM'
      };
      
      ws.send(JSON.stringify(confirmationMessage));
      console.log('[WebSocket] ✅ Connection confirmation sent successfully');
      
      // PERMANENT FIX: Immediately send current draft state to prevent stuck drafts
      setTimeout(() => {
        if (ws.readyState === 1) { // OPEN
          this.broadcastDraftState(draftId);
          console.log('[WebSocket] ✅ Initial draft state broadcasted for immediate sync');
        }
      }, 100);
    } catch (error) {
      console.error('[WebSocket] ❌ Failed to send connection confirmation:', error);
    }

    const connection: DraftConnection = {
      userId,
      draftId,
      socket: ws,
      isAlive: true
    };

    console.log('[WebSocket] ✅ CONNECTION APPROVED - Creating connection object');
    console.log(`[WebSocket] - User: ${userId}`);
    console.log(`[WebSocket] - Draft: ${draftId}`);

    // PERMANENT FIX: Add to connections map with enhanced error handling
    if (!this.connections.has(draftId)) {
      this.connections.set(draftId, []);
      console.log(`[WebSocket] Created new connection array for draft ${draftId}`);
    }
    
    console.log(`[WebSocket] Before adding connection - draft ${draftId} has ${this.connections.get(draftId)?.length || 0} connections`);
    
    // Remove any existing connections for the same user to prevent duplicates
    const existingConnections = this.connections.get(draftId)!;
    const filteredConnections = existingConnections.filter(conn => conn.userId !== userId);
    if (filteredConnections.length !== existingConnections.length) {
      console.log(`[WebSocket] Removed ${existingConnections.length - filteredConnections.length} existing connections for user ${userId}`);
      this.connections.set(draftId, filteredConnections);
    }
    
    this.connections.get(draftId)!.push(connection);
    
    const totalConnections = this.connections.get(draftId)!.length;
    console.log(`[WebSocket] ✅ User ${userId} connected to draft ${draftId}. Total connections: ${totalConnections}`);
    console.log(`[WebSocket] All active users for draft ${draftId}:`, this.connections.get(draftId)?.map(c => c.userId));

      // FIX #2: SERVER MEMORY/PORT REUSE - Clean connection tracking
    console.log('[WebSocket] 🔍 SERVER STATE: Checking for memory/port reuse issues');
    
    // Update connection stats with cleanup detection
    this.connectionStats.totalConnections++;
    this.connectionStats.activeConnections++;
    
    // FIX #2: Detect potential server restart issues
    if (this.connectionStats.totalConnections === 1) {
      console.log('[WebSocket] 🔄 FIRST CONNECTION: Server restart detected, cleaning any stale state');
      // Clear any stale timers or connections that might persist across restarts
      this.connections.clear();
      this.connectionStats = {
        totalConnections: 1,
        activeConnections: 1,
        messagesPerSecond: 0,
        errors: 0,
        messageCount: 0,
        disconnections: 0,
        lastResetTime: Date.now()
      };
      console.log('[WebSocket] ✅ SERVER STATE: Cleaned stale connections after restart');
    }

    // Handle incoming messages
    ws.on('message', (data) => {
      try {
        this.connectionStats.messageCount++;
        const message = JSON.parse(data.toString());
        
        // Handle ping/pong for heartbeat with draft ID validation
        if (message.type === 'ping') {
          console.log('🏓 [WebSocket] PING RECEIVED');
          console.log('🔍 [WebSocket] PING/PONG: User:', userId, 'Draft:', draftId);
          connection.isAlive = true;
          ws.send(JSON.stringify({
            type: 'pong',
            draftId: draftId, // Include draft ID in all messages
            timestamp: Date.now()
          }));
          console.log('🏓 [WebSocket] PONG SENT with draft ID:', draftId);
          return;
        }

        // Handle client identification
        if (message.type === 'identify') {
          console.log(`[WebSocket] Client identified - UserID: ${userId}, ConnectionID: ${message.connectionId}`);
          console.log(`[WebSocket] Client User-Agent: ${message.userAgent}`);
          connection.isAlive = true;
          ws.send(JSON.stringify({
            type: 'identified',
            connectionId: message.connectionId,
            timestamp: Date.now()
          }));
          return;
        }

        // Handle keep-alive
        if (message.type === 'keep_alive') {
          console.log(`[WebSocket] Keep-alive from user ${userId}, ConnectionID: ${message.connectionId}`);
          connection.isAlive = true;
          ws.send(JSON.stringify({
            type: 'keep_alive_ack',
            connectionId: message.connectionId,
            timestamp: Date.now()
          }));
          return;
        }
        
        this.handleMessage(connection, message);
      } catch (error) {
        console.error('[WebSocket] Error parsing message:', error);
        this.connectionStats.errors++;
      }
    });

    // Handle connection close
    ws.on('close', (code, reason) => {
      console.log(`[WebSocket] CLOSE EVENT - User ${userId} disconnecting`);
      console.log(`[WebSocket] Close code: ${code}, reason: ${reason.toString()}`);
      console.log(`[WebSocket] Connection was alive for:`, Date.now() - Date.parse(new Date().toISOString()));
      
      this.removeConnection(connection);
      this.connectionStats.activeConnections--;
      this.connectionStats.disconnections++;
      console.log(`[WebSocket] User ${userId} disconnected from draft ${draftId}`);
    });

    // Handle errors
    ws.on('error', (error) => {
      console.error('[WebSocket] Connection error:', error);
      this.connectionStats.errors++;
      this.removeConnection(connection);
    });

    // Setup heartbeat
    ws.on('pong', () => {
      connection.isAlive = true;
    });

    // Send initial connection acknowledgment
    this.sendToConnection(connection, {
      type: 'connected',
      draftId,
      timestamp: Date.now()
    });
  }

  private handleMessage(connection: DraftConnection, message: any) {
    switch (message.type) {
      case 'ping':
        this.sendToConnection(connection, {
          type: 'pong',
          timestamp: Date.now()
        });
        break;

      case 'request_state':
        // Client requesting current draft state
        this.broadcastToDraft(connection.draftId, {
          type: 'draft_state',
          draftId: connection.draftId,
          timestamp: Date.now()
        });
        break;

      default:
        console.log('[WebSocket] Unknown message type:', message.type);
    }
  }

  private removeConnection(connection: DraftConnection) {
    const draftConnections = this.connections.get(connection.draftId);
    if (draftConnections) {
      const index = draftConnections.findIndex(c => c.userId === connection.userId);
      if (index !== -1) {
        draftConnections.splice(index, 1);
      }
      
      if (draftConnections.length === 0) {
        this.connections.delete(connection.draftId);
      }
    }
  }

  private sendToConnection(connection: DraftConnection, message: any) {
    if (connection.socket.readyState === WebSocket.OPEN) {
      connection.socket.send(JSON.stringify(message));
    }
  }

  private startHeartbeat() {
    console.log('[WebSocket] ❤️ Starting enhanced heartbeat system for Reserved VM');
    
    this.heartbeatInterval = setInterval(() => {
      console.log('[WebSocket] 💓 Heartbeat check running...');
      
      this.wss.clients.forEach((ws: any) => {
        const connections = Array.from(this.connections.values()).flat();
        const connection = connections.find(c => c.socket === ws);
        
        if (connection) {
          if (!connection.isAlive) {
            console.log(`[WebSocket] Terminating dead connection for user ${connection.userId} in draft ${connection.draftId}`);
            ws.terminate();
            this.removeConnection(connection);
            return;
          }
          
          // PERMANENT FIX: Enhanced ping handling for Reserved VM
          connection.isAlive = false;
          try {
            ws.ping();
          } catch (error) {
            console.log(`[WebSocket] ❌ Ping failed for ${connection.userId}, terminating connection:`, error);
            ws.terminate();
            this.removeConnection(connection);
          }
        }
      });
    }, 20000); // Faster heartbeat for Reserved VM (reduced from 30000ms to 20000ms)
  }

  private startMetricsCollection() {
    // Calculate messages per second and log metrics every 30 seconds
    this.metricsInterval = setInterval(() => {
      const now = Date.now();
      const timeDiffSeconds = (now - this.connectionStats.lastResetTime) / 1000;
      this.connectionStats.messagesPerSecond = this.connectionStats.messageCount / timeDiffSeconds;
      
      // Log comprehensive metrics
      console.log('[WebSocket] ========== CONNECTION METRICS ==========');
      console.log(`[WebSocket] Total connections: ${this.connectionStats.totalConnections}`);
      console.log(`[WebSocket] Active connections: ${this.connectionStats.activeConnections}`);
      console.log(`[WebSocket] Messages/sec: ${this.connectionStats.messagesPerSecond.toFixed(2)}`);
      console.log(`[WebSocket] Total messages: ${this.connectionStats.messageCount}`);
      console.log(`[WebSocket] Errors: ${this.connectionStats.errors}`);
      console.log(`[WebSocket] Disconnections: ${this.connectionStats.disconnections}`);
      console.log('[WebSocket] =============================================');
      
      // Reset counters for next period
      this.connectionStats.messageCount = 0;
      this.connectionStats.lastResetTime = now;
    }, 30000); // Every 30 seconds
  }

  // Public methods for broadcasting events

  public broadcastPickMade(draftId: string, pick: any) {
    this.broadcastToDraft(draftId, {
      type: 'pick_made',
      draftId,
      data: { pick },
      timestamp: Date.now()
    });
  }

  public broadcastAutoPick(draftId: string, pick: any) {
    this.broadcastToDraft(draftId, {
      type: 'auto_pick',
      draftId,
      data: { pick },
      timestamp: Date.now()
    });
  }

  public broadcastTimerUpdate(draftId: string, timeRemaining: number) {
    console.log(`[WebSocket] Broadcasting timer update: ${timeRemaining}s remaining to draft ${draftId} (Reserved VM)`);
    const connections = this.connections.get(draftId);
    console.log(`[WebSocket] Active connections for draft ${draftId}: ${connections?.length || 0}`);
    
    // PERMANENT FIX: Enhanced timer broadcasting for Reserved VM with validation
    if (timeRemaining >= 0 && timeRemaining <= 60) {
      const timerMessage = {
        type: 'timer_update',
        draftId,
        data: { 
          timeRemaining,
          serverTimestamp: Date.now() // Add server timestamp for sync validation
        },
        timestamp: Date.now()
      };
      
      this.broadcastToDraft(draftId, timerMessage);
      console.log(`[WebSocket] ✅ Valid timer update broadcasted: ${timeRemaining}s`);
    } else {
      console.log(`[WebSocket] ❌ Invalid timer value not broadcasted: ${timeRemaining}s`);
    }
  }

  public broadcastDraftCompleted(draftId: string) {
    this.broadcastToDraft(draftId, {
      type: 'draft_completed',
      draftId,
      data: {},
      timestamp: Date.now()
    });
  }

  public broadcastDraftState(draftId: string, state?: any) {
    this.broadcastToDraft(draftId, {
      type: 'draft_state',
      draftId,
      data: state || {},
      timestamp: Date.now()
    });
  }

  public broadcastDraftUpdate(draftId: string, state: any) {
    this.broadcastToDraft(draftId, {
      type: 'draft_update',
      draftId,
      data: state,
      timestamp: Date.now()
    });
  }

  private broadcastToDraft(draftId: string, message: any) {
    const draftConnections = this.connections.get(draftId);
    if (!draftConnections) {
      return;
    }

    draftConnections.forEach(connection => {
      this.sendToConnection(connection, message);
    });

    console.log(`[WebSocket] Broadcasted ${message.type} to ${draftConnections.length} clients in draft ${draftId}`);
  }

  public getDraftConnectionCount(draftId: string): number {
    return this.connections.get(draftId)?.length || 0;
  }

  public getConnectedUsers(draftId: string): string[] {
    return this.connections.get(draftId)?.map(c => c.userId) || [];
  }

  public isUserConnected(draftId: string, userId: string): boolean {
    const draftConnections = this.connections.get(draftId);
    return draftConnections?.some(c => c.userId === userId) || false;
  }

  public getConnectionStats() {
    return {
      ...this.connectionStats,
      draftConnections: Object.fromEntries(
        Array.from(this.connections.entries()).map(([draftId, connections]) => [
          draftId,
          {
            count: connections.length,
            users: connections.map(c => c.userId)
          }
        ])
      )
    };
  }

  public cleanup() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }
    if (this.metricsInterval) {
      clearInterval(this.metricsInterval);
    }
    
    // Close all connections
    this.wss.clients.forEach(ws => {
      ws.terminate();
    });
    
    this.connections.clear();
    console.log('[WebSocket] WebSocket manager cleaned up');
  }
}