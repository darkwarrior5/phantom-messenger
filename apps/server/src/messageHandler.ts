/**
 * Phantom Messenger Server - Message Handler
 * 
 * Processes WebSocket messages with zero-knowledge architecture
 * Server NEVER sees decrypted message content
 */

import type { ClientConnection } from './types.js';
import type { ConnectionManager } from './connectionManager.js';
import type { RateLimiter } from './rateLimiter.js';
import type { MessageStore } from './messageStore.js';
import type { DatabaseService } from './database.js';
import type { 
  ProtocolMessage, 
  ProtocolMessageType,
  KeyBundleDTO
} from '@phantom/shared';
import { generateRequestId } from '@phantom/shared';

export class MessageHandler {
  constructor(
    private connectionManager: ConnectionManager,
    private rateLimiter: RateLimiter,
    private messageStore: MessageStore,
    private requireInvitation: boolean,
    private database: DatabaseService | null = null
  ) {}

  /**
   * Handle incoming message
   */
  async handleMessage(
    connection: ClientConnection,
    rawMessage: string
  ): Promise<void> {
    try {
      const message = JSON.parse(rawMessage) as ProtocolMessage;
      
      // Validate message structure
      if (!this.isValidMessage(message)) {
        this.sendError(connection, 'INVALID_REQUEST', 'Invalid message format');
        return;
      }

      // Update activity
      this.connectionManager.updateActivity(connection.clientId);

      // Route to appropriate handler
      switch (message.type) {
        case 'authenticate':
          await this.handleAuthenticate(connection, message);
          break;
        
        case 'message':
          await this.handleEncryptedMessage(connection, message);
          break;
        
        case 'key-exchange':
          await this.handleKeyExchange(connection, message);
          break;
        
        case 'key-exchange-response':
          await this.handleKeyExchangeResponse(connection, message);
          break;
        
        case 'presence':
          await this.handlePresence(connection, message);
          break;
        
        case 'typing':
          await this.handleTyping(connection, message);
          break;
        
        case 'invitation':
          await this.handleInvitation(connection, message);
          break;
        
        case 'invitation-accept':
          await this.handleInvitationAccept(connection, message);
          break;
        
        case 'burn-request':
          await this.handleBurnRequest(connection, message);
          break;
        
        case 'sync-request':
          await this.handleSyncRequest(connection, message);
          break;
        
        case 'media-upload':
          await this.handleMediaUpload(connection, message);
          break;
        
        case 'media-download':
          await this.handleMediaDownload(connection, message);
          break;
        
        case 'ping':
          this.handlePing(connection, message);
          break;
        
        default:
          this.sendError(connection, 'INVALID_REQUEST', 'Unknown message type');
      }
    } catch (error) {
      this.sendError(
        connection, 
        'INVALID_REQUEST', 
        'Failed to parse message'
      );
    }
  }

  /**
   * Handle authentication request
   */
  private async handleAuthenticate(
    connection: ClientConnection,
    message: ProtocolMessage
  ): Promise<void> {
    // Check rate limit
    if (this.rateLimiter.checkAuthLimit(connection.ipHash)) {
      this.sendError(connection, 'RATE_LIMITED', 'Too many auth attempts');
      return;
    }

    const payload = message.payload as {
      publicKey?: string;
      signedChallenge?: string;
      keyBundle?: KeyBundleDTO;
    };

    if (!connection.pendingChallenge) {
      // First step: Send challenge
      const challenge = this.connectionManager.generateChallenge(connection.clientId);
      
      this.send(connection, {
        type: 'authenticate',
        requestId: message.requestId,
        payload: {
          challenge: challenge.nonce,
          timestamp: challenge.timestamp
        },
        timestamp: Date.now()
      });
      return;
    }

    // Second step: Verify response
    if (!payload.publicKey || !payload.signedChallenge) {
      this.sendError(connection, 'INVALID_REQUEST', 'Missing auth data');
      return;
    }

    const success = this.connectionManager.authenticate(
      connection.clientId,
      payload.publicKey,
      payload.signedChallenge
    );

    if (!success) {
      this.sendError(connection, 'UNAUTHORIZED', 'Authentication failed');
      return;
    }

    // Reset rate limit on success
    this.rateLimiter.resetForIP(connection.ipHash, 'auth');

    this.send(connection, {
      type: 'authenticate',
      requestId: message.requestId,
      payload: { success: true },
      timestamp: Date.now()
    });
  }

  /**
   * Handle encrypted message routing
   * Server stores encrypted blobs for sync but NEVER decrypts them
   */
  private async handleEncryptedMessage(
    connection: ClientConnection,
    message: ProtocolMessage
  ): Promise<void> {
    if (!connection.isAuthenticated) {
      this.sendError(connection, 'UNAUTHORIZED', 'Not authenticated');
      return;
    }

    // Check rate limit
    if (this.rateLimiter.checkMessageLimit(connection.ipHash)) {
      this.sendError(connection, 'RATE_LIMITED', 'Too many messages');
      return;
    }

    const payload = message.payload as {
      recipientKey: string;
      encryptedContent: unknown;
      mediaId?: string;
    };

    if (!payload.recipientKey || !payload.encryptedContent) {
      this.sendError(connection, 'INVALID_REQUEST', 'Missing message data');
      return;
    }

    // Store the encrypted message for sync (server cannot decrypt)
    let messageId: string;
    
    if (this.database) {
      // Use Supabase for persistent storage
      const id = await this.database.storeMessage(
        connection.publicKey!,
        payload.recipientKey,
        JSON.stringify(payload.encryptedContent),
        payload.mediaId ? 'media' : 'text',
        payload.mediaId
      );
      messageId = id || this.messageStore.storeMessage(
        connection.publicKey!,
        payload.recipientKey,
        payload.encryptedContent
      );
    } else {
      // Use in-memory store
      messageId = this.messageStore.storeMessage(
        connection.publicKey!,
        payload.recipientKey,
        payload.encryptedContent
      );
    }

    // Route the encrypted message to recipient (if online)
    const delivered = this.connectionManager.routeMessage(payload.recipientKey, {
      type: 'message',
      requestId: generateRequestId(),
      payload: {
        messageId,
        senderKey: connection.publicKey,
        encryptedContent: payload.encryptedContent,
        mediaId: payload.mediaId,
        timestamp: Date.now()
      },
      timestamp: Date.now()
    });

    // Also route to sender's other devices for sync
    this.connectionManager.routeToOtherDevices(
      connection.publicKey!,
      connection.clientId,
      {
        type: 'message',
        requestId: generateRequestId(),
        payload: {
          messageId,
          senderKey: connection.publicKey,
          recipientKey: payload.recipientKey,
          encryptedContent: payload.encryptedContent,
          mediaId: payload.mediaId,
          isSentByMe: true,
          timestamp: Date.now()
        },
        timestamp: Date.now()
      }
    );

    // Mark as delivered if it was sent
    if (delivered) {
      this.messageStore.markDelivered(messageId, connection.clientId);
    }

    // Send delivery acknowledgment
    this.send(connection, {
      type: 'message-ack',
      requestId: message.requestId,
      payload: { 
        messageId,
        delivered,
        timestamp: Date.now()
      },
      timestamp: Date.now()
    });
  }

  /**
   * Handle key exchange initiation
   */
  private async handleKeyExchange(
    connection: ClientConnection,
    message: ProtocolMessage
  ): Promise<void> {
    if (!connection.isAuthenticated) {
      this.sendError(connection, 'UNAUTHORIZED', 'Not authenticated');
      return;
    }

    const payload = message.payload as {
      recipientKey: string;
      keyBundle: KeyBundleDTO;
    };

    if (!payload.recipientKey || !payload.keyBundle) {
      this.sendError(connection, 'INVALID_REQUEST', 'Missing key exchange data');
      return;
    }

    // Store pending key exchange
    this.connectionManager.storePendingKeyExchange({
      initiatorKey: connection.publicKey!,
      recipientKey: payload.recipientKey,
      bundle: payload.keyBundle,
      timestamp: Date.now()
    });

    // Forward to recipient
    const delivered = this.connectionManager.routeMessage(payload.recipientKey, {
      type: 'key-exchange',
      requestId: generateRequestId(),
      payload: {
        initiatorKey: connection.publicKey,
        keyBundle: payload.keyBundle
      },
      timestamp: Date.now()
    });

    this.send(connection, {
      type: 'key-exchange',
      requestId: message.requestId,
      payload: { delivered },
      timestamp: Date.now()
    });
  }

  /**
   * Handle key exchange response
   */
  private async handleKeyExchangeResponse(
    connection: ClientConnection,
    message: ProtocolMessage
  ): Promise<void> {
    if (!connection.isAuthenticated) {
      this.sendError(connection, 'UNAUTHORIZED', 'Not authenticated');
      return;
    }

    const payload = message.payload as {
      initiatorKey: string;
      keyBundle: KeyBundleDTO;
    };

    if (!payload.initiatorKey || !payload.keyBundle) {
      this.sendError(connection, 'INVALID_REQUEST', 'Missing key exchange data');
      return;
    }

    // Forward response to initiator
    const delivered = this.connectionManager.routeMessage(payload.initiatorKey, {
      type: 'key-exchange-response',
      requestId: generateRequestId(),
      payload: {
        responderKey: connection.publicKey,
        keyBundle: payload.keyBundle
      },
      timestamp: Date.now()
    });

    this.send(connection, {
      type: 'key-exchange-response',
      requestId: message.requestId,
      payload: { delivered },
      timestamp: Date.now()
    });
  }

  /**
   * Handle presence update
   */
  private async handlePresence(
    connection: ClientConnection,
    message: ProtocolMessage
  ): Promise<void> {
    if (!connection.isAuthenticated) return;

    const payload = message.payload as {
      recipientKey?: string;
      status: 'online' | 'offline';
    };

    if (payload.recipientKey) {
      // Send presence to specific user
      this.connectionManager.routeMessage(payload.recipientKey, {
        type: 'presence',
        requestId: generateRequestId(),
        payload: {
          userKey: connection.publicKey,
          status: payload.status
        },
        timestamp: Date.now()
      });
    }
  }

  /**
   * Handle typing indicator
   */
  private async handleTyping(
    connection: ClientConnection,
    message: ProtocolMessage
  ): Promise<void> {
    if (!connection.isAuthenticated) return;

    const payload = message.payload as {
      recipientKey: string;
      isTyping: boolean;
    };

    if (!payload.recipientKey) return;

    this.connectionManager.routeMessage(payload.recipientKey, {
      type: 'typing',
      requestId: generateRequestId(),
      payload: {
        userKey: connection.publicKey,
        isTyping: payload.isTyping
      },
      timestamp: Date.now()
    });
  }

  /**
   * Handle invitation (just routing, server doesn't validate)
   */
  private async handleInvitation(
    connection: ClientConnection,
    message: ProtocolMessage
  ): Promise<void> {
    if (!connection.isAuthenticated) {
      this.sendError(connection, 'UNAUTHORIZED', 'Not authenticated');
      return;
    }

    // Server just acknowledges - invitation validation is client-side
    this.send(connection, {
      type: 'invitation',
      requestId: message.requestId,
      payload: { acknowledged: true },
      timestamp: Date.now()
    });
  }

  /**
   * Handle invitation acceptance
   */
  private async handleInvitationAccept(
    connection: ClientConnection,
    message: ProtocolMessage
  ): Promise<void> {
    if (!connection.isAuthenticated) {
      this.sendError(connection, 'UNAUTHORIZED', 'Not authenticated');
      return;
    }

    const payload = message.payload as {
      inviterKey: string;
      accepterKey: string;
    };

    // Notify inviter
    this.connectionManager.routeMessage(payload.inviterKey, {
      type: 'invitation-accept',
      requestId: generateRequestId(),
      payload: {
        accepterKey: connection.publicKey
      },
      timestamp: Date.now()
    });

    this.send(connection, {
      type: 'invitation-accept',
      requestId: message.requestId,
      payload: { success: true },
      timestamp: Date.now()
    });
  }

  /**
   * Handle burn request (message deletion notification)
   */
  private async handleBurnRequest(
    connection: ClientConnection,
    message: ProtocolMessage
  ): Promise<void> {
    if (!connection.isAuthenticated) return;

    const payload = message.payload as {
      recipientKey: string;
      messageId: string;
    };

    // Forward burn request to recipient
    this.connectionManager.routeMessage(payload.recipientKey, {
      type: 'burn-request',
      requestId: generateRequestId(),
      payload: {
        senderKey: connection.publicKey,
        messageId: payload.messageId
      },
      timestamp: Date.now()
    });
  }

  /**
   * Handle sync request - fetch message history for a user
   */
  private async handleSyncRequest(
    connection: ClientConnection,
    message: ProtocolMessage
  ): Promise<void> {
    if (!connection.isAuthenticated) {
      this.sendError(connection, 'UNAUTHORIZED', 'Not authenticated');
      return;
    }

    const payload = message.payload as {
      sinceTimestamp?: number;
      limit?: number;
      conversationWith?: string;
    };

    let syncMessages: Array<{
      id: string;
      senderKey: string;
      recipientKey: string;
      encryptedContent: unknown;
      timestamp: number;
      delivered: boolean;
    }>;
    
    if (this.database) {
      // Use Supabase for sync
      const sinceTime = payload.sinceTimestamp 
        ? new Date(payload.sinceTimestamp).toISOString()
        : undefined;
      
      let dbMessages;
      if (payload.conversationWith) {
        dbMessages = await this.database.getConversationMessages(
          connection.publicKey!,
          payload.conversationWith,
          sinceTime,
          payload.limit
        );
      } else {
        dbMessages = await this.database.getMessagesForUser(
          connection.publicKey!,
          sinceTime,
          payload.limit
        );
      }
      
      // Convert DB format to protocol format
      syncMessages = dbMessages.map(m => ({
        id: m.id,
        senderKey: m.sender_key,
        recipientKey: m.recipient_key,
        encryptedContent: JSON.parse(m.encrypted_content),
        timestamp: new Date(m.created_at).getTime(),
        delivered: true
      }));
    } else {
      // Use in-memory store
      let messages;
      if (payload.conversationWith) {
        messages = this.messageStore.getConversationMessages(
          connection.publicKey!,
          payload.conversationWith,
          payload.sinceTimestamp,
          payload.limit
        );
      } else {
        messages = this.messageStore.getMessagesForUser(
          connection.publicKey!,
          payload.sinceTimestamp,
          payload.limit
        );
      }

      // Convert to sync response format (without Set for JSON serialization)
      syncMessages = messages.map(m => ({
        id: m.id,
        senderKey: m.senderKey,
        recipientKey: m.recipientKey,
        encryptedContent: m.encryptedContent,
        timestamp: m.timestamp,
        delivered: m.delivered
      }));
    }

    this.send(connection, {
      type: 'sync-response',
      requestId: message.requestId,
      payload: {
        messages: syncMessages,
        hasMore: syncMessages.length === (payload.limit || 1000)
      },
      timestamp: Date.now()
    });
  }

  /**
   * Handle ping
   */
  private handlePing(
    connection: ClientConnection,
    message: ProtocolMessage
  ): void {
    this.send(connection, {
      type: 'pong',
      requestId: message.requestId,
      payload: {},
      timestamp: Date.now()
    });
  }

  /**
   * Handle media upload request
   * Stores encrypted media in Supabase Storage (ephemeral - deleted after both download)
   */
  private async handleMediaUpload(
    connection: ClientConnection,
    message: ProtocolMessage
  ): Promise<void> {
    if (!connection.isAuthenticated) {
      this.sendError(connection, 'UNAUTHORIZED', 'Not authenticated');
      return;
    }

    if (!this.database) {
      this.sendError(connection, 'NOT_SUPPORTED', 'Media storage not configured');
      return;
    }

    const payload = message.payload as {
      recipientKey: string;
      encryptedData: string;  // Base64 encoded encrypted file
      encryptedKey: string;   // Encrypted file key for recipient
      mimeType?: string;
      fileSize: number;
    };

    if (!payload.recipientKey || !payload.encryptedData || !payload.encryptedKey) {
      this.sendError(connection, 'INVALID_REQUEST', 'Missing media data');
      return;
    }

    // Check file size limit (50MB)
    const maxSize = 50 * 1024 * 1024;
    if (payload.fileSize > maxSize) {
      this.sendError(connection, 'FILE_TOO_LARGE', 'Maximum file size is 50MB');
      return;
    }

    try {
      // Convert base64 to Uint8Array
      // Convert base64 to Uint8Array
      const bytes = new Uint8Array(Buffer.from(payload.encryptedData, 'base64'));

      // Upload to Supabase Storage
      const uploadResult = await this.database.uploadMedia(
        bytes,
        connection.publicKey!,
        payload.recipientKey,
        payload.mimeType || 'application/octet-stream'
      );

      if (!uploadResult) {
        this.sendError(connection, 'UPLOAD_FAILED', 'Failed to upload media');
        return;
      }

      // Store media metadata
      const mediaId = await this.database.storeMedia(
        uploadResult.path,
        payload.encryptedKey,
        payload.fileSize,
        payload.mimeType || null,
        connection.publicKey!,
        payload.recipientKey
      );

      if (!mediaId) {
        this.sendError(connection, 'UPLOAD_FAILED', 'Failed to store media metadata');
        return;
      }

      // Send success response
      this.send(connection, {
        type: 'media-upload-ack',
        requestId: message.requestId,
        payload: {
          mediaId,
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString() // 7 days
        },
        timestamp: Date.now()
      });
    } catch (error) {
      console.error('[Media Upload] Error:', error);
      this.sendError(connection, 'UPLOAD_FAILED', 'Media upload failed');
    }
  }

  /**
   * Handle media download request
   * Returns encrypted media and marks as downloaded for auto-delete
   */
  private async handleMediaDownload(
    connection: ClientConnection,
    message: ProtocolMessage
  ): Promise<void> {
    if (!connection.isAuthenticated) {
      this.sendError(connection, 'UNAUTHORIZED', 'Not authenticated');
      return;
    }

    if (!this.database) {
      this.sendError(connection, 'NOT_SUPPORTED', 'Media storage not configured');
      return;
    }

    const payload = message.payload as {
      mediaId: string;
    };

    if (!payload.mediaId) {
      this.sendError(connection, 'INVALID_REQUEST', 'Missing media ID');
      return;
    }

    try {
      // Get media metadata
      const media = await this.database.getMedia(payload.mediaId);
      
      if (!media) {
        this.sendError(connection, 'NOT_FOUND', 'Media not found or expired');
        return;
      }

      // Verify user is sender or recipient
      const isSender = media.sender_key === connection.publicKey;
      const isRecipient = media.recipient_key === connection.publicKey;
      
      if (!isSender && !isRecipient) {
        this.sendError(connection, 'FORBIDDEN', 'Not authorized to download this media');
        return;
      }

      // Download encrypted data from storage
      const encryptedData = await this.database.downloadMedia(media.storage_path);
      
      if (!encryptedData) {
        this.sendError(connection, 'NOT_FOUND', 'Media file not found');
        return;
      }

      // Convert to base64 for transmission
      const base64Data = Buffer.from(encryptedData).toString('base64');

      // Mark as downloaded (triggers auto-delete when both have downloaded)
      await this.database.markMediaDownloaded(payload.mediaId, isSender);

      // Send the encrypted media
      this.send(connection, {
        type: 'media-download-response',
        requestId: message.requestId,
        payload: {
          mediaId: payload.mediaId,
          encryptedData: base64Data,
          encryptedKey: media.encrypted_key,
          mimeType: media.mime_type,
          fileSize: media.file_size
        },
        timestamp: Date.now()
      });
    } catch (error) {
      console.error('[Media Download] Error:', error);
      this.sendError(connection, 'DOWNLOAD_FAILED', 'Media download failed');
    }
  }

  /**
   * Validate message structure
   */
  private isValidMessage(message: unknown): message is ProtocolMessage {
    if (!message || typeof message !== 'object') return false;
    
    const msg = message as Record<string, unknown>;
    
    return (
      typeof msg['type'] === 'string' &&
      typeof msg['requestId'] === 'string' &&
      msg['payload'] !== undefined
    );
  }

  /**
   * Send message to client
   */
  private send(connection: ClientConnection, message: ProtocolMessage): void {
    if (connection.socket.readyState === 1) {
      connection.socket.send(JSON.stringify(message));
    }
  }

  /**
   * Send error to client
   */
  private sendError(
    connection: ClientConnection,
    code: string,
    message: string
  ): void {
    this.send(connection, {
      type: 'error',
      requestId: generateRequestId(),
      payload: { code, message },
      timestamp: Date.now()
    });
  }
}
