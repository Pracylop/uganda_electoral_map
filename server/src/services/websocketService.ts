import WebSocket, { Server as WebSocketServer } from 'ws';
import { IncomingMessage } from 'http';
import { verifyToken, JwtPayload } from '../utils/auth';

export interface AuthenticatedWebSocket extends WebSocket {
  userId?: number;
  username?: string;
  role?: string;
  isAlive?: boolean;
}

export interface WebSocketMessage {
  type: string;
  payload?: any;
}

class WebSocketService {
  private wss: WebSocketServer | null = null;
  private clients: Map<number, AuthenticatedWebSocket> = new Map();
  private heartbeatInterval: NodeJS.Timeout | null = null;

  initialize(port: number = 3001): void {
    this.wss = new WebSocketServer({ port });

    console.log(`📡 WebSocket server running on port ${port}`);

    this.wss.on('connection', (ws: AuthenticatedWebSocket, req: IncomingMessage) => {
      console.log('New WebSocket connection attempt');
      ws.isAlive = true;

      // Handle pong responses for heartbeat
      ws.on('pong', () => {
        ws.isAlive = true;
      });

      // Handle incoming messages
      ws.on('message', (data: Buffer) => {
        try {
          const message: WebSocketMessage = JSON.parse(data.toString());
          this.handleMessage(ws, message);
        } catch (error) {
          console.error('WebSocket message parse error:', error);
          this.sendError(ws, 'Invalid message format');
        }
      });

      // Handle connection close
      ws.on('close', () => {
        if (ws.userId) {
          this.clients.delete(ws.userId);
          console.log(`WebSocket disconnected: User ${ws.userId} (${ws.username})`);
        }
      });

      // Handle errors
      ws.on('error', (error) => {
        console.error('WebSocket error:', error);
      });

      // Request authentication
      this.send(ws, {
        type: 'AUTH_REQUIRED',
        payload: { message: 'Please authenticate with a valid JWT token' }
      });
    });

    // Start heartbeat to detect dead connections
    this.startHeartbeat();
  }

  private handleMessage(ws: AuthenticatedWebSocket, message: WebSocketMessage): void {
    switch (message.type) {
      case 'AUTH':
        this.handleAuthentication(ws, message.payload?.token);
        break;

      case 'PING':
        this.send(ws, { type: 'PONG' });
        break;

      default:
        if (!ws.userId) {
          this.sendError(ws, 'Not authenticated');
          return;
        }
        console.log(`Message from user ${ws.userId}:`, message.type);
    }
  }

  private handleAuthentication(ws: AuthenticatedWebSocket, token: string): void {
    if (!token) {
      this.sendError(ws, 'Token required');
      ws.close();
      return;
    }

    const payload = verifyToken(token);

    if (!payload) {
      this.sendError(ws, 'Invalid or expired token');
      ws.close();
      return;
    }

    // Store authenticated connection
    ws.userId = payload.userId;
    ws.username = payload.username;
    ws.role = payload.role;

    this.clients.set(payload.userId, ws);

    // Send authentication success
    this.send(ws, {
      type: 'AUTH_OK',
      payload: {
        userId: payload.userId,
        username: payload.username,
        role: payload.role
      }
    });

    console.log(`WebSocket authenticated: User ${payload.userId} (${payload.username}) - Role: ${payload.role}`);
  }

  // Broadcast to all connected clients
  broadcast(message: WebSocketMessage, excludeUserId?: number): void {
    this.clients.forEach((client, userId) => {
      if (client.readyState === WebSocket.OPEN && userId !== excludeUserId) {
        this.send(client, message);
      }
    });
  }

  // Broadcast to specific roles
  broadcastToRoles(message: WebSocketMessage, roles: string[]): void {
    this.clients.forEach((client) => {
      if (
        client.readyState === WebSocket.OPEN &&
        client.role &&
        roles.includes(client.role)
      ) {
        this.send(client, message);
      }
    });
  }

  // Send message to specific user
  sendToUser(userId: number, message: WebSocketMessage): void {
    const client = this.clients.get(userId);
    if (client && client.readyState === WebSocket.OPEN) {
      this.send(client, message);
    }
  }

  // Send message to a single client
  private send(ws: WebSocket, message: WebSocketMessage): void {
    try {
      ws.send(JSON.stringify(message));
    } catch (error) {
      console.error('WebSocket send error:', error);
    }
  }

  // Send error message
  private sendError(ws: WebSocket, error: string): void {
    this.send(ws, {
      type: 'ERROR',
      payload: { error }
    });
  }

  // Heartbeat to detect dead connections
  private startHeartbeat(): void {
    this.heartbeatInterval = setInterval(() => {
      this.clients.forEach((ws, userId) => {
        if (ws.isAlive === false) {
          console.log(`Terminating dead connection for user ${userId}`);
          this.clients.delete(userId);
          return ws.terminate();
        }

        ws.isAlive = false;
        ws.ping();
      });
    }, 30000); // 30 seconds
  }

  // Cleanup
  close(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }

    if (this.wss) {
      this.wss.close();
    }

    this.clients.clear();
  }

  // Get connected clients info
  getConnectedClients(): Array<{ userId: number; username: string; role: string }> {
    const clients: Array<{ userId: number; username: string; role: string }> = [];

    this.clients.forEach((ws) => {
      if (ws.userId && ws.username && ws.role) {
        clients.push({
          userId: ws.userId,
          username: ws.username,
          role: ws.role
        });
      }
    });

    return clients;
  }
}

// Export singleton instance
export const websocketService = new WebSocketService();
