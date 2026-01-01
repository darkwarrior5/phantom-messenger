/**
 * Phantom Messenger Server - WebSocket Server
 * 
 * Zero-knowledge WebSocket server
 * - Stores encrypted message blobs for sync (server cannot decrypt)
 * - No metadata logging
 * - Privacy-preserving rate limiting
 */

import { WebSocketServer, WebSocket } from 'ws';
import { createServer, IncomingMessage } from 'http';
import type { ServerConfig } from './types.js';
import type { SupabaseConfig } from './config.js';
import { ConnectionManager } from './connectionManager.js';
import { MessageHandler } from './messageHandler.js';
import { MessageStore } from './messageStore.js';
import { RateLimiter } from './rateLimiter.js';
import { DatabaseService } from './database.js';

export interface PhantomServerConfig extends ServerConfig {
  supabase: SupabaseConfig;
}

export class PhantomServer {
  private wss: WebSocketServer | null = null;
  private httpServer: ReturnType<typeof createServer> | null = null;
  private connectionManager: ConnectionManager;
  private messageHandler: MessageHandler;
  private messageStore: MessageStore;
  private database: DatabaseService | null = null;
  private rateLimiter: RateLimiter;
  private pingIntervals: Map<string, NodeJS.Timeout> = new Map();

  constructor(private config: PhantomServerConfig) {
    this.rateLimiter = new RateLimiter();
    this.connectionManager = new ConnectionManager();
    this.messageStore = new MessageStore();
    
    // Initialize Supabase if configured
    if (config.supabase.url && config.supabase.anonKey) {
      this.database = new DatabaseService(
        config.supabase.url,
        config.supabase.serviceRoleKey || config.supabase.anonKey
      );
      console.log('[Storage] Using Supabase (hybrid mode)');
    } else {
      console.log('[Storage] Using in-memory store (development mode)');
    }
    
    this.messageHandler = new MessageHandler(
      this.connectionManager,
      this.rateLimiter,
      this.messageStore,
      config.requireInvitation,
      this.database
    );
  }

  /**
   * Start the server
   */
  start(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        // Create HTTP server for WebSocket upgrade
        this.httpServer = createServer((req, res) => {
          // Health check endpoint
          if (req.url === '/health') {
            const messageStats = this.messageStore.getStats();
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ 
              status: 'ok',
              connections: this.connectionManager.getConnectionCount(),
              authenticated: this.connectionManager.getAuthenticatedCount(),
              storedMessages: messageStats.totalMessages,
              activeUsers: messageStats.totalUsers,
              storage: this.database ? 'supabase' : 'memory'
            }));
            return;
          }

          // Reject all other HTTP requests
          res.writeHead(426, { 'Content-Type': 'text/plain' });
          res.end('WebSocket connection required');
        });

        // Create WebSocket server
        this.wss = new WebSocketServer({ 
          server: this.httpServer,
          path: '/ws'
        });

        this.wss.on('connection', (socket, request) => {
          this.handleConnection(socket, request);
        });

        this.wss.on('error', (error) => {
          console.error('[Server Error]', error.message);
        });

        // Start listening
        this.httpServer.listen(this.config.port, this.config.host, () => {
          console.log(`[Phantom Server] Started on ${this.config.host}:${this.config.port}`);
          console.log(`[Security] Rate limiting: ${this.config.enableRateLimiting ? 'enabled' : 'disabled'}`);
          console.log(`[Security] Invitation required: ${this.config.requireInvitation ? 'yes' : 'no'}`);
          resolve();
        });

        this.httpServer.on('error', reject);
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Handle new WebSocket connection
   */
  private handleConnection(socket: WebSocket, request: IncomingMessage): void {
    // Get client IP (hashed for privacy)
    const ip = this.getClientIP(request);
    const ipHash = this.rateLimiter.hashIP(ip);

    // Check connection rate limit
    if (this.config.enableRateLimiting && 
        this.rateLimiter.checkConnectionLimit(ipHash, this.config.maxConnectionsPerIP)) {
      socket.close(1013, 'Rate limit exceeded');
      return;
    }

    // Register connection
    const connection = this.connectionManager.addConnection(socket, ipHash);

    // Set up ping/pong for connection health
    const pingInterval = setInterval(() => {
      if (socket.readyState === WebSocket.OPEN) {
        socket.ping();
      }
    }, this.config.pingInterval);

    this.pingIntervals.set(connection.clientId, pingInterval);

    // Handle pong timeout
    let pongReceived = true;
    socket.on('ping', () => socket.pong());
    socket.on('pong', () => { pongReceived = true; });

    const pongCheck = setInterval(() => {
      if (!pongReceived) {
        socket.terminate();
        return;
      }
      pongReceived = false;
    }, this.config.pingTimeout);

    // Handle messages
    socket.on('message', async (data) => {
      try {
        const message = data.toString();
        await this.messageHandler.handleMessage(connection, message);
      } catch (error) {
        // Don't log message content for privacy
        console.error('[Message Error] Failed to process message');
      }
    });

    // Handle close
    socket.on('close', () => {
      this.cleanup(connection.clientId);
      clearInterval(pongCheck);
    });

    // Handle errors
    socket.on('error', (error) => {
      // Don't log details for privacy
      console.error('[Socket Error] Connection error');
      this.cleanup(connection.clientId);
    });
  }

  /**
   * Get client IP address
   */
  private getClientIP(request: IncomingMessage): string {
    // Check for proxy headers
    const forwarded = request.headers['x-forwarded-for'];
    if (forwarded) {
      const ips = Array.isArray(forwarded) ? forwarded[0] : forwarded;
      return ips?.split(',')[0]?.trim() ?? 'unknown';
    }
    
    return request.socket.remoteAddress ?? 'unknown';
  }

  /**
   * Cleanup connection resources
   */
  private cleanup(clientId: string): void {
    const interval = this.pingIntervals.get(clientId);
    if (interval) {
      clearInterval(interval);
      this.pingIntervals.delete(clientId);
    }
    
    this.connectionManager.removeConnection(clientId);
  }

  /**
   * Stop the server
   */
  async stop(): Promise<void> {
    // Clear all ping intervals
    for (const interval of this.pingIntervals.values()) {
      clearInterval(interval);
    }
    this.pingIntervals.clear();

    // Stop components
    this.connectionManager.stop();
    this.rateLimiter.stop();

    // Close WebSocket server
    if (this.wss) {
      this.wss.close();
      this.wss = null;
    }

    // Close HTTP server
    if (this.httpServer) {
      await new Promise<void>((resolve) => {
        this.httpServer!.close(() => resolve());
      });
      this.httpServer = null;
    }

    console.log('[Phantom Server] Stopped');
  }

  /**
   * Get server stats (minimal, privacy-preserving)
   */
  getStats(): { connections: number; authenticated: number } {
    return {
      connections: this.connectionManager.getConnectionCount(),
      authenticated: this.connectionManager.getAuthenticatedCount()
    };
  }
}
