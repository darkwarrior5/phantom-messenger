/**
 * Phantom Messenger - WebSocket Client
 * 
 * Handles real-time communication with the server
 */

import type { ProtocolMessage, ProtocolMessageType } from '@phantom/shared';
import { generateRequestId } from '@phantom/shared';
import {
  sign,
  bytesToBase64,
  base64ToBytes,
  stringToBytes
} from '@phantom/crypto';
import { useConnectionStore, useIdentityStore } from '../store';

type MessageHandler = (message: ProtocolMessage) => void;

class WebSocketClient {
  private socket: WebSocket | null = null;
  private handlers: Map<ProtocolMessageType, Set<MessageHandler>> = new Map();
  private pendingRequests: Map<string, {
    resolve: (value: unknown) => void;
    reject: (reason: unknown) => void;
    timeout: NodeJS.Timeout;
  }> = new Map();
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;
  private pingInterval: NodeJS.Timeout | null = null;

  /**
   * Connect to the WebSocket server
   */
  connect(url: string = 'ws://localhost:8080/ws'): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.socket?.readyState === WebSocket.OPEN) {
        resolve();
        return;
      }

      useConnectionStore.getState().setStatus('connecting');

      this.socket = new WebSocket(url);
      useConnectionStore.getState().setSocket(this.socket);

      this.socket.onopen = () => {
        console.log('[WebSocket] Connected');
        useConnectionStore.getState().setStatus('connected');
        this.reconnectAttempts = 0;
        this.startPingInterval();
        resolve();
      };

      this.socket.onclose = (event) => {
        console.log('[WebSocket] Disconnected:', event.code);
        useConnectionStore.getState().setStatus('disconnected');
        this.stopPingInterval();
        this.handleReconnect();
      };

      this.socket.onerror = (error) => {
        console.error('[WebSocket] Error');
        reject(new Error('WebSocket connection failed'));
      };

      this.socket.onmessage = (event) => {
        this.handleMessage(event.data);
      };
    });
  }

  /**
   * Disconnect from the server
   */
  disconnect(): void {
    this.stopPingInterval();
    if (this.socket) {
      this.socket.close(1000, 'Client disconnect');
      this.socket = null;
    }
    useConnectionStore.getState().setSocket(null);
    useConnectionStore.getState().setStatus('disconnected');
  }

  /**
   * Authenticate with the server
   */
  async authenticate(): Promise<boolean> {
    const identity = useIdentityStore.getState().identity;
    if (!identity) {
      throw new Error('No identity available');
    }

    // Step 1: Request challenge
    const challengeResponse = await this.sendRequest('authenticate', {});

    if (!challengeResponse || !('challenge' in (challengeResponse as object))) {
      throw new Error('Invalid challenge response');
    }

    const { challenge } = challengeResponse as { challenge: string };

    // Step 2: Sign challenge
    const challengeBytes = stringToBytes(challenge);
    const signResult = sign(challengeBytes, identity.signingKeyPair.secretKey);

    if (!signResult.success || !signResult.data) {
      throw new Error('Failed to sign challenge');
    }

    // Step 3: Send signed challenge
    const authResponse = await this.sendRequest('authenticate', {
      publicKey: bytesToBase64(identity.identityKeyPair.publicKey),
      signedChallenge: bytesToBase64(signResult.data),
      keyBundle: {
        identityKey: bytesToBase64(identity.identityKeyPair.publicKey),
        signedPreKey: bytesToBase64(identity.preKeys[0]!.keyPair.publicKey),
        signedPreKeySignature: bytesToBase64(identity.preKeys[0]!.signature),
        oneTimePreKeys: identity.oneTimePreKeys.slice(0, 10).map(
          pk => bytesToBase64(pk.keyPair.publicKey)
        )
      }
    });

    if ((authResponse as { success?: boolean })?.success) {
      useConnectionStore.getState().setStatus('authenticated');

      // Auto-sync messages on successful authentication
      this.performAutoSync();

      return true;
    }

    return false;
  }

  /**
   * Auto-sync messages after authentication
   * Fetches messages since last sync timestamp
   */
  private async performAutoSync(): Promise<void> {
    try {
      // Get last sync timestamp from localStorage
      const lastSyncKey = 'phantom_last_sync';
      const lastSyncStr = localStorage.getItem(lastSyncKey);
      const sinceTimestamp = lastSyncStr ? parseInt(lastSyncStr, 10) : undefined;

      console.log('[Sync] Starting auto-sync...', sinceTimestamp ? `since ${new Date(sinceTimestamp).toISOString()}` : 'full sync');

      // Fetch missed messages
      const messages = await this.syncMessages(sinceTimestamp);

      console.log(`[Sync] Received ${messages.length} messages`);

      // Store current timestamp for next sync
      localStorage.setItem(lastSyncKey, Date.now().toString());

      // Emit sync event for UI to process
      if (messages.length > 0) {
        const handlers = this.handlers.get('sync-response');
        if (handlers) {
          handlers.forEach(handler => {
            handler({
              type: 'sync-response',
              requestId: 'auto-sync',
              payload: { messages, isAutoSync: true },
              timestamp: Date.now()
            });
          });
        }
      }
    } catch (error) {
      console.error('[Sync] Auto-sync failed:', error);
    }
  }

  /**
   * Send a message and wait for response
   */
  sendRequest<T = unknown>(
    type: ProtocolMessageType,
    payload: unknown,
    timeout: number = 10000
  ): Promise<T> {
    return new Promise((resolve, reject) => {
      const requestId = generateRequestId();

      const timeoutId = setTimeout(() => {
        this.pendingRequests.delete(requestId);
        reject(new Error('Request timeout'));
      }, timeout);

      this.pendingRequests.set(requestId, {
        resolve: resolve as (value: unknown) => void,
        reject,
        timeout: timeoutId
      });

      this.send({
        type,
        requestId,
        payload,
        timestamp: Date.now()
      });
    });
  }

  /**
   * Send a message without waiting for response
   */
  send(message: ProtocolMessage): void {
    if (this.socket?.readyState !== WebSocket.OPEN) {
      throw new Error('WebSocket not connected');
    }
    this.socket.send(JSON.stringify(message));
  }

  /**
   * Register a message handler
   */
  on(type: ProtocolMessageType, handler: MessageHandler): () => void {
    if (!this.handlers.has(type)) {
      this.handlers.set(type, new Set());
    }
    this.handlers.get(type)!.add(handler);

    // Return unsubscribe function
    return () => {
      this.handlers.get(type)?.delete(handler);
    };
  }

  /**
   * Handle incoming message
   */
  private handleMessage(data: string): void {
    try {
      const message = JSON.parse(data) as ProtocolMessage;

      // Check for pending request
      const pending = this.pendingRequests.get(message.requestId);
      if (pending) {
        clearTimeout(pending.timeout);
        this.pendingRequests.delete(message.requestId);

        if (message.type === 'error') {
          pending.reject(new Error((message.payload as { message?: string })?.message ?? 'Unknown error'));
        } else {
          pending.resolve(message.payload);
        }
        return;
      }

      // Dispatch to handlers
      const handlers = this.handlers.get(message.type);
      if (handlers) {
        handlers.forEach(handler => {
          try {
            handler(message);
          } catch (error) {
            console.error('[Handler Error]', error);
          }
        });
      }
    } catch (error) {
      console.error('[Message Parse Error]', error);
    }
  }

  /**
   * Handle reconnection
   */
  private handleReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.log('[WebSocket] Max reconnect attempts reached');
      return;
    }

    this.reconnectAttempts++;
    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);

    console.log(`[WebSocket] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})`);

    setTimeout(() => {
      this.connect().catch(console.error);
    }, delay);
  }

  /**
   * Start ping interval
   */
  private startPingInterval(): void {
    this.pingInterval = setInterval(() => {
      if (this.socket?.readyState === WebSocket.OPEN) {
        this.send({
          type: 'ping',
          requestId: generateRequestId(),
          payload: {},
          timestamp: Date.now()
        });
      }
    }, 30000);
  }

  /**
   * Stop ping interval
   */
  private stopPingInterval(): void {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
  }

  /**
   * Request message sync from server
   * Fetches message history for the authenticated user
   */
  async syncMessages(sinceTimestamp?: number, limit?: number): Promise<SyncedMessage[]> {
    const response = await this.sendRequest<SyncResponse>('sync-request', {
      sinceTimestamp,
      limit: limit || 1000
    });

    return response.messages || [];
  }

  /**
   * Request message sync for a specific conversation
   */
  async syncConversation(contactKey: string, sinceTimestamp?: number): Promise<SyncedMessage[]> {
    const response = await this.sendRequest<SyncResponse>('sync-request', {
      conversationWith: contactKey,
      sinceTimestamp,
      limit: 500
    });

    return response.messages || [];
  }

  /**
   * Check if connected
   */
  get isConnected(): boolean {
    return this.socket?.readyState === WebSocket.OPEN;
  }

  /**
   * Check if authenticated
   */
  get isAuthenticated(): boolean {
    return useConnectionStore.getState().status === 'authenticated';
  }
}

/**
 * Synced message from server
 */
export interface SyncedMessage {
  id: string;
  senderKey: string;
  recipientKey: string;
  encryptedContent: unknown;
  timestamp: number;
  delivered: boolean;
}

interface SyncResponse {
  messages: SyncedMessage[];
  hasMore: boolean;
}

// Export singleton instance
export const wsClient = new WebSocketClient();
