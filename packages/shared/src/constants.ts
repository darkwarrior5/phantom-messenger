/**
 * Phantom Messenger - Shared Constants
 */

// ============ Protocol Constants ============

export const PROTOCOL_VERSION = '1.0.0';

export const WEBSOCKET_PING_INTERVAL = 30000; // 30 seconds
export const WEBSOCKET_PONG_TIMEOUT = 10000; // 10 seconds
export const WEBSOCKET_RECONNECT_DELAY = 1000; // 1 second initial
export const WEBSOCKET_MAX_RECONNECT_DELAY = 30000; // 30 seconds max

// ============ Security Constants ============

export const MAX_MESSAGE_LENGTH = 65536; // 64KB
export const MIN_PASSWORD_LENGTH = 12;
export const INVITATION_CODE_LENGTH = 32;
export const SESSION_KEY_ROTATION_INTERVAL = 100; // messages
export const PRE_KEY_REFRESH_THRESHOLD = 10;

// ============ Timing Constants ============

export const DEFAULT_MESSAGE_BURN_TIME = 30000; // 30 seconds
export const MIN_BURN_TIME = 5000; // 5 seconds
export const MAX_BURN_TIME = 604800000; // 7 days

export const DEFAULT_INVITATION_EXPIRY = 86400000; // 24 hours
export const MIN_INVITATION_EXPIRY = 300000; // 5 minutes
export const MAX_INVITATION_EXPIRY = 604800000; // 7 days

// ============ Rate Limits ============

export const RATE_LIMIT_MESSAGES_PER_MINUTE = 60;
export const RATE_LIMIT_INVITATIONS_PER_HOUR = 10;
export const RATE_LIMIT_KEY_EXCHANGES_PER_MINUTE = 10;

// ============ UI Constants ============

export const TYPING_INDICATOR_TIMEOUT = 3000; // 3 seconds
export const PRESENCE_UPDATE_INTERVAL = 60000; // 1 minute
export const MESSAGE_BATCH_SIZE = 50;

// ============ Storage Keys ============

export const STORAGE_KEYS = {
  IDENTITY: 'phantom:identity',
  PREFERENCES: 'phantom:preferences',
  CONVERSATIONS: 'phantom:conversations',
  SESSION: 'phantom:session',
  PENDING_MESSAGES: 'phantom:pending'
} as const;
