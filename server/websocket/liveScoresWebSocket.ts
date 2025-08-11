import WebSocket from 'ws';
import { IncomingMessage } from 'http';

interface LiveScoresConnection {
  socket: WebSocket;
  leagueId?: string;
  week?: number;
  userId?: string;
}

export class LiveScoresWebSocketManager {
  private connections: Map<string, LiveScoresConnection[]> = new Map();
  private server: WebSocket.Server;

  constructor(server: WebSocket.Server) {
    this.server = server;
    this.setupConnectionHandling();
  }

  private setupConnectionHandling() {
    this.server.on('connection', (ws: WebSocket, request: IncomingMessage) => {
      if (request.url?.includes('/ws/live-scores')) {
        this.handleLiveScoresConnection(ws, request);
      }
    });
  }

  private handleLiveScoresConnection(ws: WebSocket, request: IncomingMessage) {
    console.log('[LiveScores WebSocket] New connection from:', request.socket.remoteAddress);
    
    const connectionId = this.generateConnectionId();
    const connection: LiveScoresConnection = {
      socket: ws,
    };

    ws.on('message', (data) => {
      try {
        const message = JSON.parse(data.toString());
        console.log('[LiveScores WebSocket] Received message:', message);
        
        switch (message.type) {
          case 'subscribe':
            connection.leagueId = message.leagueId;
            connection.week = message.week;
            connection.userId = message.userId;
            
            // Add to connections map
            const key = `${message.leagueId}-${message.week}`;
            if (!this.connections.has(key)) {
              this.connections.set(key, []);
            }
            this.connections.get(key)!.push(connection);
            
            console.log(`[LiveScores WebSocket] Subscribed to ${key}, total connections: ${this.connections.get(key)!.length}`);
            break;
            
          case 'ping':
            ws.send(JSON.stringify({ type: 'pong', timestamp: Date.now() }));
            break;
        }
      } catch (error) {
        console.error('[LiveScores WebSocket] Error processing message:', error);
      }
    });

    ws.on('close', () => {
      this.removeConnection(connection);
      console.log('[LiveScores WebSocket] Connection closed');
    });

    ws.on('error', (error) => {
      console.error('[LiveScores WebSocket] Connection error:', error);
      this.removeConnection(connection);
    });

    // Send connection confirmation
    ws.send(JSON.stringify({
      type: 'connected',
      timestamp: Date.now(),
      connectionId
    }));
  }

  private removeConnection(connection: LiveScoresConnection) {
    if (connection.leagueId && connection.week) {
      const key = `${connection.leagueId}-${connection.week}`;
      const connections = this.connections.get(key);
      if (connections) {
        const index = connections.findIndex(c => c.socket === connection.socket);
        if (index !== -1) {
          connections.splice(index, 1);
          if (connections.length === 0) {
            this.connections.delete(key);
          }
        }
      }
    }
  }

  /**
   * Broadcast score updates to all clients watching a specific league/week
   */
  public broadcastScoreUpdate(leagueId: string, week: number, scoreData: any) {
    const key = `${leagueId}-${week}`;
    const connections = this.connections.get(key);
    
    if (!connections || connections.length === 0) {
      console.log(`[LiveScores WebSocket] No connections for ${key}`);
      return;
    }

    const message = {
      type: 'score-update',
      leagueId,
      week,
      data: scoreData,
      timestamp: Date.now()
    };

    console.log(`[LiveScores WebSocket] Broadcasting score update to ${connections.length} clients for ${key}`);
    
    connections.forEach(connection => {
      if (connection.socket.readyState === WebSocket.OPEN) {
        try {
          connection.socket.send(JSON.stringify(message));
        } catch (error) {
          console.error('[LiveScores WebSocket] Error sending message:', error);
        }
      }
    });
  }

  /**
   * Broadcast lock updates to all clients
   */
  public broadcastLockUpdate(lockData: any) {
    const message = {
      type: 'lock-update',
      data: lockData,
      timestamp: Date.now()
    };

    console.log(`[LiveScores WebSocket] Broadcasting lock update to all connections`);
    
    // Broadcast to all connections regardless of league/week
    this.connections.forEach((connections, key) => {
      connections.forEach(connection => {
        if (connection.socket.readyState === WebSocket.OPEN) {
          try {
            connection.socket.send(JSON.stringify(message));
          } catch (error) {
            console.error('[LiveScores WebSocket] Error sending lock update:', error);
          }
        }
      });
    });
  }

  private generateConnectionId(): string {
    return Math.random().toString(36).substring(2, 15);
  }

  /**
   * Get connection statistics
   */
  public getStats() {
    const totalConnections = Array.from(this.connections.values())
      .reduce((total, connections) => total + connections.length, 0);
    
    return {
      totalConnections,
      leagueConnections: Object.fromEntries(this.connections.entries())
    };
  }
}