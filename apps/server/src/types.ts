/**
 * Phantom Messenger Server - Types
 */

import type { WebSocket } from 'ws';
import type { 
  ProtocolMessage, 
  KeyBundleDTO,
  User
} from '@phantom/shared';

export interface ClientConnection {
  /** WebSocket connection */
  socket: WebSocket;
  /** Anonymous client ID */
  clientId: string;
  /** Public key for routing */
  publicKey?: string;
  /** Whether authenticated */
  isAuthenticated: boolean;
  /** When connected */
  connectedAt: number;
  /** Last activity */
  lastActivity: number;
  /** IP address (hashed, for rate limiting only) */
  ipHash: string;
  /** Pending challenge for auth */
  pendingChallenge?: AuthChallenge;
}

export interface AuthChallenge {
  nonce: string;
  timestamp: number;
  expiresAt: number;
}

export interface ServerConfig {
  port: number;
  host: string;
  enableRateLimiting: boolean;
  maxConnectionsPerIP: number;
  requireInvitation: boolean;
  pingInterval: number;
  pingTimeout: number;
  corsOrigin: string;
}

export interface RateLimitEntry {
  count: number;
  resetAt: number;
}

export interface MessageRoute {
  recipientKey: string;
  message: ProtocolMessage;
}

export interface PendingKeyExchange {
  initiatorKey: string;
  recipientKey: string;
  bundle: KeyBundleDTO;
  timestamp: number;
}
