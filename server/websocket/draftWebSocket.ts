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

  constructor(server: Server) {
    // Create WebSocket server on /draft-ws path to avoid Vite HMR conflicts
    this.wss = new WebSocketServer({ 
      server, 
      path: '/draft-ws',
      // Add explicit WebSocket handling options for production
      verifyClient: (info) => {
        console.log('[WebSocket] 🔍 VERIFYING CLIENT CONNECTION');
        console.log('[WebSocket] Origin:', info.origin);
        console.log('[WebSocket] Request URL:', info.req.url);
        console.log('[WebSocket] Method:', info.req.method);
        console.log('[WebSocket] Headers:', JSON.stringify(info.req.headers, null, 2));
        console.log('[WebSocket] Remote address:', info.req.socket?.remoteAddress);
        console.log('[WebSocket] ✅ CLIENT VERIFICATION: APPROVED');
        return true; // Allow all connections for now
      }
    });

    this.wss.on('connection', this.handleConnection.bind(this));
    this.startHeartbeat();
    
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
    console.log('[WebSocket] Request headers:', JSON.stringify(request.headers, null, 2));
    console.log('[WebSocket] Remote address:', request.socket?.remoteAddress);
    console.log('[WebSocket] Connection ready state:', ws.readyState);
    
    const { query } = parse(request.url, true);
    const userId = query.userId as string;
    const draftId = query.draftId as string;
    
    console.log('[WebSocket] Extracted parameters:');
    console.log(`[WebSocket] - userId: ${userId}`);
    console.log(`[WebSocket] - draftId: ${draftId}`);
    console.log('[WebSocket] ================================================');

    if (!userId || !draftId) {
      console.log('[WebSocket] ❌ CONNECTION REJECTED: Missing userId or draftId');
      ws.close(1000, 'Missing required parameters');
      return;
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

    // Add to connections map
    if (!this.connections.has(draftId)) {
      this.connections.set(draftId, []);
      console.log(`[WebSocket] Created new connection array for draft ${draftId}`);
    }
    
    console.log(`[WebSocket] Before adding connection - draft ${draftId} has ${this.connections.get(draftId)?.length || 0} connections`);
    this.connections.get(draftId)!.push(connection);
    
    const totalConnections = this.connections.get(draftId)!.length;
    console.log(`[WebSocket] After adding connection - User ${userId} connected to draft ${draftId}. Total connections: ${totalConnections}`);
    console.log(`[WebSocket] All connections for draft ${draftId}:`, this.connections.get(draftId)?.map(c => c.userId));

    // Handle incoming messages
    ws.on('message', (data) => {
      try {
        const message = JSON.parse(data.toString());
        this.handleMessage(connection, message);
      } catch (error) {
        console.error('[WebSocket] Error parsing message:', error);
      }
    });

    // Handle connection close
    ws.on('close', () => {
      this.removeConnection(connection);
      console.log(`[WebSocket] User ${userId} disconnected from draft ${draftId}`);
    });

    // Handle errors
    ws.on('error', (error) => {
      console.error('[WebSocket] Connection error:', error);
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
    this.heartbeatInterval = setInterval(() => {
      this.wss.clients.forEach((ws: any) => {
        const connections = Array.from(this.connections.values()).flat();
        const connection = connections.find(c => c.socket === ws);
        
        if (connection) {
          if (!connection.isAlive) {
            console.log(`[WebSocket] Terminating dead connection for user ${connection.userId}`);
            ws.terminate();
            this.removeConnection(connection);
            return;
          }
          
          connection.isAlive = false;
          ws.ping();
        }
      });
    }, 30000); // 30 seconds
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
    console.log(`[WebSocket] Broadcasting timer update: ${timeRemaining}s remaining to draft ${draftId}`);
    const connections = this.connections.get(draftId);
    console.log(`[WebSocket] Active connections for draft ${draftId}: ${connections?.length || 0}`);
    
    this.broadcastToDraft(draftId, {
      type: 'timer_update',
      draftId,
      data: { timeRemaining },
      timestamp: Date.now()
    });
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

  public cleanup() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }
    this.wss.close();
  }
}