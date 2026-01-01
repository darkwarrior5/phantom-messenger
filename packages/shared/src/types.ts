/**
 * Phantom Messenger - Shared Types
 * 
 * Common type definitions used across all applications
 */

// ============ User & Identity Types ============

export interface User {
  /** Unique anonymous identifier */
  id: string;
  /** Display identifier (truncated hash) */
  displayId: string;
  /** Public identity key */
  publicKey: string;
  /** Public signing key */
  signingKey: string;
  /** When user was created */
  createdAt: number;
  /** User preferences */
  preferences: UserPreferences;
  /** Whether user is currently online */
  isOnline?: boolean;
  /** Last seen timestamp */
  lastSeen?: number;
}

export interface UserPreferences {
  /** Auto-delete messages after reading */
  autoDeleteMessages: boolean;
  /** Auto-delete timeout in seconds */
  autoDeleteTimeout: number;
  /** Show read receipts */
  showReadReceipts: boolean;
  /** Show typing indicators */
  showTypingIndicator: boolean;
  /** Enable notifications */
  enableNotifications: boolean;
  /** Theme preference */
  theme: 'dark' | 'light' | 'system';
}

export const DEFAULT_USER_PREFERENCES: UserPreferences = {
  autoDeleteMessages: false,
  autoDeleteTimeout: 30,
  showReadReceipts: false,
  showTypingIndicator: false,
  enableNotifications: true,
  theme: 'dark'
};

// ============ Message Types ============

export interface Message {
  /** Unique message ID */
  id: string;
  /** Conversation ID */
  conversationId: string;
  /** Sender's anonymous ID */
  senderId: string;
  /** Message content (decrypted) */
  content: string;
  /** Message timestamp */
  timestamp: number;
  /** Message type */
  type: MessageType;
  /** Message status */
  status: MessageStatus;
  /** Whether message should burn after reading */
  burnAfterRead: boolean;
  /** Burn timeout in seconds */
  burnTimeout?: number;
  /** When message was read */
  readAt?: number;
  /** Message metadata */
  metadata?: MessageMetadata;
}

export type MessageType = 
  | 'text'
  | 'system'
  | 'invitation'
  | 'key-exchange'
  | 'burn-notice';

export type MessageStatus =
  | 'sending'
  | 'sent'
  | 'delivered'
  | 'read'
  | 'failed'
  | 'burned';

export interface MessageMetadata {
  /** Reply to message ID */
  replyTo?: string;
  /** Whether message was edited */
  edited?: boolean;
  /** Edit timestamp */
  editedAt?: number;
  /** Media attachment */
  media?: MediaInfo;
}

/** Media attachment information */
export interface MediaInfo {
  /** Server media ID */
  mediaId: string;
  /** Original file name */
  name: string;
  /** File size in bytes */
  size: number;
  /** MIME type */
  mimeType: string;
  /** Media type category */
  type: 'image' | 'video' | 'audio' | 'file';
  /** Encrypted key for recipient (base64) */
  encryptedKey: string;
  /** IV used for encryption (base64) */
  iv: string;
}

// ============ Conversation Types ============

export interface Conversation {
  /** Unique conversation ID */
  id: string;
  /** Participant IDs */
  participants: string[];
  /** Conversation type */
  type: ConversationType;
  /** When conversation was created */
  createdAt: number;
  /** Last message timestamp */
  lastMessageAt?: number;
  /** Unread message count */
  unreadCount: number;
  /** Conversation state */
  state: ConversationState;
  /** Key exchange state */
  keyExchangeComplete: boolean;
}

export type ConversationType = 'direct' | 'group';

export type ConversationState =
  | 'active'
  | 'pending'
  | 'archived'
  | 'destroyed';

// ============ Invitation Types ============

export interface Invitation {
  /** Invitation ID */
  id: string;
  /** Invitation code for sharing */
  code: string;
  /** Creator's anonymous ID */
  creatorId: string;
  /** When invitation expires */
  expiresAt: number;
  /** Whether single use */
  singleUse: boolean;
  /** Maximum uses */
  maxUses: number;
  /** Current use count */
  useCount: number;
  /** Whether revoked */
  isRevoked: boolean;
  /** When created */
  createdAt: number;
}

// ============ Protocol Types ============

export type ProtocolMessageType =
  | 'connect'
  | 'disconnect'
  | 'authenticate'
  | 'message'
  | 'message-ack'
  | 'key-exchange'
  | 'key-exchange-response'
  | 'presence'
  | 'typing'
  | 'invitation'
  | 'invitation-accept'
  | 'burn-request'
  | 'wipe-request'
  | 'error'
  | 'ping'
  | 'pong'
  | 'sync-request'
  | 'sync-response'
  | 'media-upload'
  | 'media-upload-ack'
  | 'media-download'
  | 'media-download-response';

export interface ProtocolMessage<T = unknown> {
  /** Message type */
  type: ProtocolMessageType;
  /** Unique request ID */
  requestId: string;
  /** Message payload */
  payload: T;
  /** Timestamp */
  timestamp: number;
}

// ============ Authentication Types ============

export interface AuthChallenge {
  /** Challenge nonce */
  nonce: string;
  /** Challenge timestamp */
  timestamp: number;
  /** Server public key */
  serverPublicKey: string;
}

export interface AuthResponse {
  /** User's public key */
  publicKey: string;
  /** Signed challenge */
  signedChallenge: string;
  /** Key exchange bundle */
  keyBundle: KeyBundleDTO;
}

export interface KeyBundleDTO {
  identityKey: string;
  signedPreKey: string;
  signedPreKeySignature: string;
  oneTimePreKeys: string[];
}

// ============ API Response Types ============

export interface APIResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: APIError;
}

export interface APIError {
  code: ErrorCode;
  message: string;
  details?: Record<string, unknown>;
}

export type ErrorCode =
  | 'INVALID_REQUEST'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'RATE_LIMITED'
  | 'INVALID_INVITATION'
  | 'EXPIRED_INVITATION'
  | 'INVALID_SIGNATURE'
  | 'KEY_EXCHANGE_FAILED'
  | 'ENCRYPTION_ERROR'
  | 'DECRYPTION_ERROR'
  | 'INTERNAL_ERROR';

// ============ Events Types ============

export type EventType =
  | 'message:received'
  | 'message:sent'
  | 'message:delivered'
  | 'message:read'
  | 'message:burned'
  | 'conversation:created'
  | 'conversation:updated'
  | 'conversation:destroyed'
  | 'user:online'
  | 'user:offline'
  | 'user:typing'
  | 'invitation:received'
  | 'invitation:accepted'
  | 'connection:established'
  | 'connection:lost'
  | 'identity:destroyed';

export interface Event<T = unknown> {
  type: EventType;
  payload: T;
  timestamp: number;
}

// ============ Security Status Types ============

export interface SecurityStatus {
  /** Whether end-to-end encryption is active */
  e2eEnabled: boolean;
  /** Whether Perfect Forward Secrecy is active */
  pfsEnabled: boolean;
  /** Current encryption algorithm */
  algorithm: string;
  /** Key exchange state */
  keyExchangeState: 'pending' | 'complete' | 'failed';
  /** Session key fingerprint */
  sessionFingerprint?: string;
  /** Last key rotation */
  lastKeyRotation?: number;
}

// ============ Wipe Types ============

export interface WipeRequest {
  /** Type of wipe */
  type: 'messages' | 'conversation' | 'identity' | 'all';
  /** Target ID (conversation or message) */
  targetId?: string;
  /** Confirmation token */
  confirmationToken: string;
}

export interface WipeResult {
  success: boolean;
  wiped: {
    messages: number;
    conversations: number;
    identityDestroyed: boolean;
  };
}
