import { WebSocketServer, WebSocket } from 'ws';
import { Server } from 'http';
import { AuthenticatedWebSocket, WebSocketEvent, WebSocketMessage } from '../interfaces/websocket.interface';
import WebSocketAuthService from './websocket-auth.service';
import logger from './logger.service';
import URL from 'url';

/**
 * Main WebSocket service for real-time communication
 */
class WebSocketService {
  private wss: WebSocketServer | null = null;
  private clients: Set<AuthenticatedWebSocket> = new Set();

  // Client groups for targeted broadcasting
  private adminClients: Set<AuthenticatedWebSocket> = new Set();
  private teamClients: Map<string, Set<AuthenticatedWebSocket>> = new Map();
  private userClients: Map<string, AuthenticatedWebSocket> = new Map();

  initialize(server: Server): void {
    this.wss = new WebSocketServer({ 
      server,
      path: '/ws'
    });

    this.setupEventHandlers();
    this.startHeartbeat();
    
    logger.info('WebSocket server initialized');
  }

  private setupEventHandlers(): void {
    if (!this.wss) return;

    this.wss.on('connection', (ws: WebSocket, request) => {
      const authenticatedWs = ws as AuthenticatedWebSocket;
      authenticatedWs.isAlive = true;

      this.handleConnection(authenticatedWs, request);
    });

    this.wss.on('error', (error) => {
      logger.error('WebSocket server error:', error);
    });
  }

  private async handleConnection(ws: AuthenticatedWebSocket, request: any): Promise<void> {
    try {
      // Extract token from query string
      const { query } = URL.parse(request.url || '', true);
      const token = query.token as string;

      if (!token) {
        this.sendError(ws, 'Authentication token required');
        ws.close(1008, 'Authentication required');
        return;
      }

      // Authenticate the connection
      const authResult = await WebSocketAuthService.authenticateConnection(token);
      if (!authResult) {
        this.sendError(ws, 'Authentication failed');
        ws.close(1008, 'Authentication failed');
        return;
      }

      // Set connection properties
      ws.user = authResult.user;
      ws.isAdmin = authResult.isAdmin;
      ws.teamId = authResult.teamId;
      ws.userId = authResult.user.uuid;

      // Add to client sets
      this.clients.add(ws);

      if (ws.isAdmin) {
        this.adminClients.add(ws);
        logger.info(`Admin WebSocket connected: ${ws.userId}`);
      } else if (ws.teamId) {
        this.addToTeamGroup(ws.teamId, ws);
        logger.info(`Team WebSocket connected: ${ws.userId} (team: ${ws.teamId})`);
      }

      this.addToUserGroup(ws.userId, ws);

      // Set up message handler
      ws.on('message', (data) => {
        this.handleMessage(ws, data as Buffer);
      });

      // Set up close handler
      ws.on('close', (code, reason) => {
        this.handleDisconnection(ws, code, reason);
      });

      // Set up error handler
      ws.on('error', (error) => {
        logger.error(`WebSocket error for user ${ws.userId}:`, error);
        this.handleDisconnection(ws, 1006, Buffer.from('Connection error'));
      });

      // Set up pong handler for heartbeat
      ws.on('pong', () => {
        ws.isAlive = true;
      });

      // Send welcome message
      this.sendMessage(ws, {
        type: 'connected',
        data: { 
          message: 'WebSocket connection established',
          user: {
            id: ws.userId,
            isAdmin: ws.isAdmin,
            teamId: ws.teamId
          }
        },
        timestamp: Date.now()
      });

    } catch (error) {
      logger.error('WebSocket connection handling error:', error);
      this.sendError(ws, 'Internal server error');
      ws.close(1011, 'Internal server error');
    }
  }

  private handleMessage(ws: AuthenticatedWebSocket, data: Buffer): void {
    try {
      const message: WebSocketMessage = JSON.parse(data.toString('utf-8'));
      
      // Handle different message types
      switch (message.type) {
        case 'ping':
          this.sendMessage(ws, { type: 'pong', data: {}, timestamp: Date.now() });
          break;
        
        case 'subscribe':
          this.handleSubscribe(ws, message.data);
          break;
        
        case 'unsubscribe':
          this.handleUnsubscribe(ws, message.data);
          break;
        
        default:
          logger.warn(`Unknown WebSocket message type: ${message.type}`);
          this.sendError(ws, `Unknown message type: ${message.type}`);
      }
    } catch (error) {
      logger.error('WebSocket message handling error:', error);
      this.sendError(ws, 'Invalid message format');
    }
  }

  private handleDisconnection(ws: AuthenticatedWebSocket, code: number, reason: Buffer): void {
    logger.info(`WebSocket disconnected: ${ws.userId} (code: ${code}, reason: ${reason.toString()})`);

    // Remove from all groups
    this.clients.delete(ws);
    
    if (ws.isAdmin) {
      this.adminClients.delete(ws);
    }
    
    if (ws.teamId) {
      this.removeFromTeamGroup(ws.teamId, ws);
    }
    
    this.removeFromUserGroup(ws.userId);
  }

  /**
   * Broadcast events to relevant clients
   */
  broadcastEvent(event: WebSocketEvent): void {
    const message: WebSocketMessage = {
      type: 'event',
      data: event,
      timestamp: Date.now()
    };

    const messageString = JSON.stringify(message);

    switch (event.target) {
      case 'all':
        this.broadcastToAll(messageString);
        break;
      
      case 'admins':
        this.broadcastToAdmins(messageString);
        break;
      
      case 'team':
        if (event.targetId) {
          this.broadcastToTeam(event.targetId, messageString);
        }
        break;
      
      case 'user':
        if (event.targetId) {
          this.broadcastToUser(event.targetId, messageString);
        }
        break;
      
      default:
        logger.warn(`Unknown broadcast target: ${event.target}`);
    }
  }

  /**
   * Broadcast to all connected clients
   */
  private broadcastToAll(message: string): void {
    this.clients.forEach(client => {
      if (this.isConnectionAlive(client)) {
        client.send(message);
      }
    });
  }

  /**
   * Broadcast to all admin clients
   */
  private broadcastToAdmins(message: string): void {
    this.adminClients.forEach(client => {
      if (this.isConnectionAlive(client)) {
        client.send(message);
      }
    });
  }

  /**
   * Broadcast to a specific team
   */
  private broadcastToTeam(teamId: string, message: string): void {
    const teamClients = this.teamClients.get(teamId);
    if (teamClients) {
      teamClients.forEach(client => {
        if (this.isConnectionAlive(client)) {
          client.send(message);
        }
      });
    }
  }

  /**
   * Broadcast to a specific user
   */
  private broadcastToUser(userId: string, message: string): void {
    const client = this.userClients.get(userId);
    if (client && this.isConnectionAlive(client)) {
      client.send(message);
    }
  }

  /**
   * Client group management
   */
  private addToTeamGroup(teamId: string, ws: AuthenticatedWebSocket): void {
    if (!this.teamClients.has(teamId)) {
      this.teamClients.set(teamId, new Set());
    }
    this.teamClients.get(teamId)!.add(ws);
  }

  private removeFromTeamGroup(teamId: string, ws: AuthenticatedWebSocket): void {
    const teamClients = this.teamClients.get(teamId);
    if (teamClients) {
      teamClients.delete(ws);
      if (teamClients.size === 0) {
        this.teamClients.delete(teamId);
      }
    }
  }

  private addToUserGroup(userId: string, ws: AuthenticatedWebSocket): void {
    this.userClients.set(userId, ws);
  }

  private removeFromUserGroup(userId: string): void {
    this.userClients.delete(userId);
  }

  /**
   * Heartbeat mechanism to detect dead connections
   */
  private startHeartbeat(): void {
    const interval = setInterval(() => {
      this.clients.forEach(ws => {
        if (!ws.isAlive) {
          ws.terminate();
          return;
        }

        ws.isAlive = false;
        ws.ping();
      });
    }, 30000); // 30 seconds

    // Clean up interval on server close
    if (this.wss) {
      this.wss.on('close', () => {
        clearInterval(interval);
      });
    }
  }

  /**
   * Utility methods
   */
  private isConnectionAlive(ws: AuthenticatedWebSocket): boolean {
    return ws.readyState === WebSocket.OPEN;
  }

  private sendMessage(ws: AuthenticatedWebSocket, message: WebSocketMessage): void {
    if (this.isConnectionAlive(ws)) {
      ws.send(JSON.stringify(message));
    }
  }

  private sendError(ws: AuthenticatedWebSocket, error: string): void {
    this.sendMessage(ws, {
      type: 'error',
      data: { error },
      timestamp: Date.now()
    });
  }

  private handleSubscribe(ws: AuthenticatedWebSocket, data: any): void {
    // Handle channel subscriptions if needed
    this.sendMessage(ws, {
      type: 'subscribed',
      data: { channels: data.channels },
      timestamp: Date.now()
    });
  }

  private handleUnsubscribe(ws: AuthenticatedWebSocket, data: any): void {
    // Handle channel unsubscriptions if needed
    this.sendMessage(ws, {
      type: 'unsubscribed',
      data: { channels: data.channels },
      timestamp: Date.now()
    });
  }

  /**
   * Get connection statistics
   */
  getStats(): any {
    return {
      totalClients: this.clients.size,
      adminClients: this.adminClients.size,
      teamClients: Array.from(this.teamClients.entries()).reduce((acc, [teamId, clients]) => {
        acc[teamId] = clients.size;
        return acc;
      }, {} as Record<string, number>),
      userClients: this.userClients.size
    };
  }
}

export default new WebSocketService();