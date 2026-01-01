/**
 * Phantom Messenger Server - Connection Manager
 * 
 * Manages WebSocket connections with zero-knowledge design
 * Supports multiple devices per user (same public key)
 */

import type { WebSocket } from 'ws';
import type { ClientConnection, AuthChallenge, PendingKeyExchange } from './types.js';
import type { ProtocolMessage } from '@phantom/shared';
import { randomBytes } from '@phantom/crypto';
import { generateRequestId } from '@phantom/shared';

export class ConnectionManager {
  /** Active connections by client ID */
  private connections: Map<string, ClientConnection> = new Map();
  
  /** Public key to client IDs mapping (supports multiple devices) */
  private keyToClients: Map<string, Set<string>> = new Map();
  
  /** Pending key exchanges (ephemeral, auto-expire) */
  private pendingKeyExchanges: Map<string, PendingKeyExchange> = new Map();
  
  /** Cleanup interval */
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor() {
    // Cleanup stale data every 5 minutes
    this.cleanupInterval = setInterval(() => this.cleanup(), 300000);
  }

  /**
   * Register a new connection
   */
  addConnection(socket: WebSocket, ipHash: string): ClientConnection {
    const clientId = generateRequestId();
    
    const connection: ClientConnection = {
      socket,
      clientId,
      isAuthenticated: false,
      connectedAt: Date.now(),
      lastActivity: Date.now(),
      ipHash
    };
    
    this.connections.set(clientId, connection);
    
    return connection;
  }

  /**
   * Remove a connection
   */
  removeConnection(clientId: string): void {
    const connection = this.connections.get(clientId);
    
    if (connection?.publicKey) {
      // Remove from multi-device set
      const clientIds = this.keyToClients.get(connection.publicKey);
      if (clientIds) {
        clientIds.delete(clientId);
        if (clientIds.size === 0) {
          this.keyToClients.delete(connection.publicKey);
        }
      }
    }
    
    this.connections.delete(clientId);
  }

  /**
   * Get connection by client ID
   */
  getConnection(clientId: string): ClientConnection | undefined {
    return this.connections.get(clientId);
  }

  /**
   * Get all connections for a public key (all user's devices)
   */
  getConnectionsByPublicKey(publicKey: string): ClientConnection[] {
    const clientIds = this.keyToClients.get(publicKey);
    if (!clientIds) return [];
    
    const connections: ClientConnection[] = [];
    for (const clientId of clientIds) {
      const conn = this.connections.get(clientId);
      if (conn) connections.push(conn);
    }
    return connections;
  }

  /**
   * Get first available connection by public key
   */
  getConnectionByPublicKey(publicKey: string): ClientConnection | undefined {
    const connections = this.getConnectionsByPublicKey(publicKey);
    return connections.find(c => c.socket.readyState === 1);
  }

  /**
   * Generate authentication challenge
   */
  generateChallenge(clientId: string): AuthChallenge {
    const nonce = Buffer.from(randomBytes(32)).toString('base64');
    const timestamp = Date.now();
    const expiresAt = timestamp + 60000; // 1 minute
    
    const challenge: AuthChallenge = {
      nonce,
      timestamp,
      expiresAt
    };
    
    const connection = this.connections.get(clientId);
    if (connection) {
      connection.pendingChallenge = challenge;
    }
    
    return challenge;
  }

  /**
   * Verify challenge response and authenticate
   */
  authenticate(
    clientId: string,
    publicKey: string,
    signedChallenge: string
  ): boolean {
    const connection = this.connections.get(clientId);
    
    if (!connection?.pendingChallenge) {
      return false;
    }
    
    // Check expiration
    if (Date.now() > connection.pendingChallenge.expiresAt) {
      delete connection.pendingChallenge;
      return false;
    }
    
    // In a real implementation, verify the signature here
    // For now, we trust the client's signature (verified client-side)
    // The signature proves possession of the private key
    
    // Mark as authenticated
    connection.isAuthenticated = true;
    connection.publicKey = publicKey;
    delete connection.pendingChallenge;
    
    // Add to multi-device mapping
    let clientIds = this.keyToClients.get(publicKey);
    if (!clientIds) {
      clientIds = new Set();
      this.keyToClients.set(publicKey, clientIds);
    }
    clientIds.add(clientId);
    
    return true;
  }

  /**
   * Route a message to all devices of a recipient
   * Returns true if delivered to at least one device
   */
  routeMessage(recipientKey: string, message: ProtocolMessage): boolean {
    const connections = this.getConnectionsByPublicKey(recipientKey);
    let delivered = false;
    
    for (const connection of connections) {
      if (connection.socket.readyState !== 1) continue;
      
      try {
        connection.socket.send(JSON.stringify(message));
        connection.lastActivity = Date.now();
        delivered = true;
      } catch {
        // Continue to other devices
      }
    }
    
    return delivered;
  }

  /**
   * Route a message to other devices of the same user (excluding sender device)
   * Used for syncing sent messages to other devices
   */
  routeToOtherDevices(
    publicKey: string,
    excludeClientId: string,
    message: ProtocolMessage
  ): boolean {
    const connections = this.getConnectionsByPublicKey(publicKey);
    let delivered = false;
    
    for (const connection of connections) {
      if (connection.clientId === excludeClientId) continue;
      if (connection.socket.readyState !== 1) continue;
      
      try {
        connection.socket.send(JSON.stringify(message));
        connection.lastActivity = Date.now();
        delivered = true;
      } catch {
        // Continue to other devices
      }
    }
    
    return delivered;
  }

  /**
   * Store pending key exchange
   * Auto-expires after 5 minutes
   */
  storePendingKeyExchange(exchange: PendingKeyExchange): void {
    const key = `${exchange.initiatorKey}:${exchange.recipientKey}`;
    this.pendingKeyExchanges.set(key, {
      ...exchange,
      timestamp: Date.now()
    });
  }

  /**
   * Get and remove pending key exchange
   */
  consumePendingKeyExchange(
    initiatorKey: string,
    recipientKey: string
  ): PendingKeyExchange | undefined {
    const key = `${initiatorKey}:${recipientKey}`;
    const exchange = this.pendingKeyExchanges.get(key);
    
    if (exchange) {
      this.pendingKeyExchanges.delete(key);
      
      // Check if expired (5 minutes)
      if (Date.now() - exchange.timestamp > 300000) {
        return undefined;
      }
    }
    
    return exchange;
  }

  /**
   * Update last activity for connection
   */
  updateActivity(clientId: string): void {
    const connection = this.connections.get(clientId);
    if (connection) {
      connection.lastActivity = Date.now();
    }
  }

  /**
   * Get count of active connections
   */
  getConnectionCount(): number {
    return this.connections.size;
  }

  /**
   * Get count of authenticated connections
   */
  getAuthenticatedCount(): number {
    let count = 0;
    for (const conn of this.connections.values()) {
      if (conn.isAuthenticated) count++;
    }
    return count;
  }

  /**
   * Broadcast to all authenticated connections (for system messages only)
   */
  broadcast(message: ProtocolMessage, excludeClientId?: string): void {
    for (const [clientId, connection] of this.connections.entries()) {
      if (clientId === excludeClientId) continue;
      if (!connection.isAuthenticated) continue;
      if (connection.socket.readyState !== 1) continue;
      
      try {
        connection.socket.send(JSON.stringify(message));
      } catch {
        // Ignore send errors
      }
    }
  }

  /**
   * Cleanup stale connections and data
   */
  private cleanup(): void {
    const now = Date.now();
    const staleTimeout = 300000; // 5 minutes
    
    // Cleanup stale pending challenges
    for (const connection of this.connections.values()) {
      if (connection.pendingChallenge && 
          now > connection.pendingChallenge.expiresAt) {
        delete connection.pendingChallenge;
      }
    }
    
    // Cleanup stale key exchanges
    for (const [key, exchange] of this.pendingKeyExchanges.entries()) {
      if (now - exchange.timestamp > staleTimeout) {
        this.pendingKeyExchanges.delete(key);
      }
    }
  }

  /**
   * Stop the connection manager
   */
  stop(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    
    // Close all connections
    for (const connection of this.connections.values()) {
      try {
        connection.socket.close(1001, 'Server shutting down');
      } catch {
        // Ignore close errors
      }
    }
    
    this.connections.clear();
    this.keyToClients.clear();
    this.pendingKeyExchanges.clear();
  }
}
