/**
 * Phantom Messenger - Cryptographic Library
 * 
 * Core security module providing:
 * - AES-256-GCM encryption with 16-bit security layer
 * - X25519 key exchange with Perfect Forward Secrecy
 * - Disposable identity generation and destruction
 * - Secure invitation system
 * - Message integrity verification
 */

// Types
export type {
  Bytes,
  Base64String,
  HexString,
  AESKey,
  KeyPair,
  SigningKeyPair,
  EncryptedMessage,
  SerializedEncryptedMessage,
  SessionKeys,
  DisposableIdentity,
  PreKey,
  SecureInvitation,
  KeyExchangeBundle,
  MessageIntegrity,
  CryptoResult,
  SecurityLayerConfig,
  KDFParams
} from './types.js';

// AES Encryption
export {
  generateAESKey,
  importAESKey,
  aesEncrypt,
  aesDecrypt,
  aesEncryptWithSecurityLayer,
  aesDecryptWithSecurityLayer,
  generateSecuritySalt
} from './aes.js';

// Key Exchange
export {
  generateKeyPair,
  generateKeyPairFromSeed,
  generateSigningKeyPair,
  generateSigningKeyPairFromSeed,
  performKeyExchange,
  sign,
  verify,
  generatePreKey,
  generatePreKeyFromSeed,
  generateOneTimePreKeys,
  createKeyExchangeBundle,
  performX3DH,
  hkdf,
  deriveSessionKeys,
  ratchetSessionKeys
} from './keyExchange.js';

// Identity Management
export {
  generateDisposableIdentity,
  generateIdentityFromCredentials,
  destroyIdentity,
  getPublicIdentityBundle,
  consumeOneTimePreKey,
  replenishOneTimePreKeys,
  rotateSignedPreKey,
  exportIdentity,
  importIdentity,
  getDisplayIdentifier,
  verifyIdentityIntegrity
} from './identity.js';
export type { PublicIdentityBundle } from './identity.js';

// Message Encryption
export {
  encryptMessage,
  decryptMessage,
  serializeEncryptedMessage,
  deserializeEncryptedMessage,
  createMessageIntegrity,
  verifyMessageIntegrity,
  createBurnMessage
} from './message.js';
export type { DecryptedMessage } from './message.js';

// Invitation System
export {
  generateInvitation,
  validateInvitation,
  revokeInvitation,
  isInvitationValid,
  serializeInvitation,
  deserializeInvitation
} from './invitation.js';
export type {
  InvitationOptions,
  InvitationData,
  GeneratedInvitation
} from './invitation.js';

// Media Encryption
export {
  encryptMedia,
  decryptMedia,
  encryptMediaForMultiple
} from './media.js';
export type {
  EncryptedMedia,
  MediaEncryptionResult,
  MediaDecryptionResult
} from './media.js';

// Utilities
export {
  bytesToBase64,
  base64ToBytes,
  bytesToHex,
  hexToBytes,
  stringToBytes,
  bytesToString,
  randomBytes,
  constantTimeEqual,
  secureWipe,
  concatBytes,
  splitBytes,
  generateTimestampNonce,
  isNonZero,
  createDeterministicId,
  formatBytesForDisplay
} from './utils.js';
