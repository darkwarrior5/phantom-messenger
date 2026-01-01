/**
 * Phantom Messenger Server - Message Store
 * 
 * Stores encrypted messages for sync across devices.
 * IMPORTANT: Server NEVER sees message content - only encrypted blobs.
 * 
 * Messages are stored by recipient public key and can be fetched
 * when a user logs in on a new device.
 */

export interface StoredMessage {
  /** Unique message ID */
  id: string;
  /** Sender's public key */
  senderKey: string;
  /** Recipient's public key */
  recipientKey: string;
  /** Encrypted message content (server cannot decrypt) */
  encryptedContent: unknown;
  /** When the message was received by server */
  timestamp: number;
  /** Whether message has been delivered to recipient */
  delivered: boolean;
  /** Track which device instances have received this */
  deliveredTo: Set<string>;
}

export interface ConversationKey {
  /** User A's public key */
  userAKey: string;
  /** User B's public key */
  userBKey: string;
}

export class MessageStore {
  /** Messages indexed by recipient public key */
  private messagesByRecipient: Map<string, StoredMessage[]> = new Map();
  
  /** Messages indexed by sender public key (for sender's sync) */
  private messagesBySender: Map<string, StoredMessage[]> = new Map();
  
  /** Message ID counter */
  private messageIdCounter = 0;
  
  /** Maximum messages to store per user */
  private readonly maxMessagesPerUser = 10000;
  
  /** Message retention period (30 days) */
  private readonly retentionPeriod = 30 * 24 * 60 * 60 * 1000;
  
  /** Cleanup interval */
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor() {
    // Cleanup expired messages every hour
    this.cleanupInterval = setInterval(() => this.cleanup(), 3600000);
  }

  /**
   * Store an encrypted message
   * Returns the message ID
   */
  storeMessage(
    senderKey: string,
    recipientKey: string,
    encryptedContent: unknown
  ): string {
    const id = this.generateMessageId();
    
    const message: StoredMessage = {
      id,
      senderKey,
      recipientKey,
      encryptedContent,
      timestamp: Date.now(),
      delivered: false,
      deliveredTo: new Set()
    };

    // Store for recipient to fetch
    this.addToIndex(this.messagesByRecipient, recipientKey, message);
    
    // Store for sender's sync (they need to see their sent messages too)
    this.addToIndex(this.messagesBySender, senderKey, message);

    return id;
  }

  /**
   * Get messages for a user (both sent and received)
   * Used when syncing a new device
   */
  getMessagesForUser(
    publicKey: string,
    sinceTimestamp?: number,
    limit = 1000
  ): StoredMessage[] {
    const received = this.messagesByRecipient.get(publicKey) || [];
    const sent = this.messagesBySender.get(publicKey) || [];
    
    // Combine and deduplicate by ID
    const messageMap = new Map<string, StoredMessage>();
    
    for (const msg of [...received, ...sent]) {
      if (!sinceTimestamp || msg.timestamp > sinceTimestamp) {
        messageMap.set(msg.id, msg);
      }
    }
    
    // Sort by timestamp and limit
    return Array.from(messageMap.values())
      .sort((a, b) => a.timestamp - b.timestamp)
      .slice(-limit);
  }

  /**
   * Get undelivered messages for a recipient
   */
  getUndeliveredMessages(recipientKey: string): StoredMessage[] {
    const messages = this.messagesByRecipient.get(recipientKey) || [];
    return messages.filter(m => !m.delivered);
  }

  /**
   * Mark a message as delivered to a specific device
   */
  markDelivered(messageId: string, deviceId: string): boolean {
    // Search in both indexes
    for (const index of [this.messagesByRecipient, this.messagesBySender]) {
      for (const messages of index.values()) {
        const message = messages.find(m => m.id === messageId);
        if (message) {
          message.deliveredTo.add(deviceId);
          message.delivered = true;
          return true;
        }
      }
    }
    return false;
  }

  /**
   * Get messages for a specific conversation
   */
  getConversationMessages(
    userAKey: string,
    userBKey: string,
    sinceTimestamp?: number,
    limit = 500
  ): StoredMessage[] {
    const userAReceived = this.messagesByRecipient.get(userAKey) || [];
    const userBReceived = this.messagesByRecipient.get(userBKey) || [];
    
    // Get messages between these two users
    const conversationMessages: StoredMessage[] = [];
    
    for (const msg of userAReceived) {
      if (msg.senderKey === userBKey) {
        if (!sinceTimestamp || msg.timestamp > sinceTimestamp) {
          conversationMessages.push(msg);
        }
      }
    }
    
    for (const msg of userBReceived) {
      if (msg.senderKey === userAKey) {
        if (!sinceTimestamp || msg.timestamp > sinceTimestamp) {
          conversationMessages.push(msg);
        }
      }
    }
    
    return conversationMessages
      .sort((a, b) => a.timestamp - b.timestamp)
      .slice(-limit);
  }

  /**
   * Delete all messages for a user (burn everything)
   */
  deleteAllForUser(publicKey: string): number {
    let deleted = 0;
    
    // Delete from recipient index
    const received = this.messagesByRecipient.get(publicKey);
    if (received) {
      deleted += received.length;
      this.messagesByRecipient.delete(publicKey);
    }
    
    // Delete from sender index
    const sent = this.messagesBySender.get(publicKey);
    if (sent) {
      deleted += sent.length;
      this.messagesBySender.delete(publicKey);
    }
    
    // Also remove from other users' indexes where this user is the other party
    for (const [key, messages] of this.messagesByRecipient) {
      const filtered = messages.filter(m => m.senderKey !== publicKey);
      if (filtered.length !== messages.length) {
        deleted += messages.length - filtered.length;
        this.messagesByRecipient.set(key, filtered);
      }
    }
    
    for (const [key, messages] of this.messagesBySender) {
      const filtered = messages.filter(m => m.recipientKey !== publicKey);
      if (filtered.length !== messages.length) {
        deleted += messages.length - filtered.length;
        this.messagesBySender.set(key, filtered);
      }
    }
    
    return deleted;
  }

  /**
   * Delete a specific conversation
   */
  deleteConversation(userAKey: string, userBKey: string): number {
    let deleted = 0;
    
    // Remove from userA's received
    const userAReceived = this.messagesByRecipient.get(userAKey);
    if (userAReceived) {
      const filtered = userAReceived.filter(m => m.senderKey !== userBKey);
      deleted += userAReceived.length - filtered.length;
      this.messagesByRecipient.set(userAKey, filtered);
    }
    
    // Remove from userB's received
    const userBReceived = this.messagesByRecipient.get(userBKey);
    if (userBReceived) {
      const filtered = userBReceived.filter(m => m.senderKey !== userAKey);
      deleted += userBReceived.length - filtered.length;
      this.messagesByRecipient.set(userBKey, filtered);
    }
    
    // Remove from sender indexes too
    const userASent = this.messagesBySender.get(userAKey);
    if (userASent) {
      const filtered = userASent.filter(m => m.recipientKey !== userBKey);
      this.messagesBySender.set(userAKey, filtered);
    }
    
    const userBSent = this.messagesBySender.get(userBKey);
    if (userBSent) {
      const filtered = userBSent.filter(m => m.recipientKey !== userAKey);
      this.messagesBySender.set(userBKey, filtered);
    }
    
    return deleted;
  }

  /**
   * Get statistics (for health check)
   */
  getStats(): { totalMessages: number; totalUsers: number } {
    const allUsers = new Set<string>();
    let totalMessages = 0;
    
    for (const [key, messages] of this.messagesByRecipient) {
      allUsers.add(key);
      totalMessages += messages.length;
    }
    
    return {
      totalMessages,
      totalUsers: allUsers.size
    };
  }

  /**
   * Cleanup expired messages
   */
  private cleanup(): void {
    const now = Date.now();
    const expiredBefore = now - this.retentionPeriod;
    
    for (const [key, messages] of this.messagesByRecipient) {
      const filtered = messages.filter(m => m.timestamp > expiredBefore);
      if (filtered.length === 0) {
        this.messagesByRecipient.delete(key);
      } else {
        this.messagesByRecipient.set(key, filtered);
      }
    }
    
    for (const [key, messages] of this.messagesBySender) {
      const filtered = messages.filter(m => m.timestamp > expiredBefore);
      if (filtered.length === 0) {
        this.messagesBySender.delete(key);
      } else {
        this.messagesBySender.set(key, filtered);
      }
    }
  }

  /**
   * Add message to index, enforcing max limit
   */
  private addToIndex(
    index: Map<string, StoredMessage[]>,
    key: string,
    message: StoredMessage
  ): void {
    let messages = index.get(key);
    
    if (!messages) {
      messages = [];
      index.set(key, messages);
    }
    
    messages.push(message);
    
    // Enforce max limit (remove oldest)
    if (messages.length > this.maxMessagesPerUser) {
      messages.shift();
    }
  }

  /**
   * Generate unique message ID
   */
  private generateMessageId(): string {
    this.messageIdCounter++;
    return `msg_${Date.now()}_${this.messageIdCounter}`;
  }

  /**
   * Destroy store and cleanup
   */
  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    this.messagesByRecipient.clear();
    this.messagesBySender.clear();
  }
}
