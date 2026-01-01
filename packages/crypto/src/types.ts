/**
 * Phantom Messenger - Core Cryptographic Types
 * 
 * Type definitions for all cryptographic operations
 */

/** Raw bytes representation */
export type Bytes = Uint8Array;

/** Base64 encoded string */
export type Base64String = string;

/** Hex encoded string */
export type HexString = string;

/** 256-bit key for AES encryption */
export interface AESKey {
  readonly key: Bytes;
  readonly algorithm: 'AES-256-GCM';
}

/** Key pair for asymmetric operations */
export interface KeyPair {
  readonly publicKey: Bytes;
  readonly secretKey: Bytes;
}

/** Signing key pair */
export interface SigningKeyPair {
  readonly publicKey: Bytes;
  readonly secretKey: Bytes;
}

/** Encrypted message structure */
export interface EncryptedMessage {
  /** Encrypted ciphertext */
  readonly ciphertext: Bytes;
  /** Initialization vector/nonce */
  readonly nonce: Bytes;
  /** GCM authentication tag */
  readonly tag: Bytes;
  /** Message authentication code (HMAC) */
  readonly mac: Bytes;
  /** Ephemeral public key for PFS */
  readonly ephemeralPublicKey: Bytes;
  /** 16-bit security layer salt */
  readonly securitySalt: Bytes;
  /** Algorithm version */
  readonly version: number;
}

/** Serialized encrypted message for transport */
export interface SerializedEncryptedMessage {
  readonly ciphertext: Base64String;
  readonly nonce: Base64String;
  readonly tag: Base64String;
  readonly mac: Base64String;
  readonly ephemeralPublicKey: Base64String;
  readonly securitySalt: Base64String;
  readonly version: number;
}

/** Session keys for a conversation */
export interface SessionKeys {
  /** Key for encrypting outgoing messages */
  readonly sendKey: AESKey;
  /** Key for decrypting incoming messages */
  readonly receiveKey: AESKey;
  /** Chain key for PFS ratcheting */
  readonly chainKey: Bytes;
  /** Message counter */
  readonly messageNumber: number;
}

/** Disposable user identity */
export interface DisposableIdentity {
  /** Unique identifier (256-bit random) */
  readonly id: Bytes;
  /** Identity key pair */
  readonly identityKeyPair: KeyPair;
  /** Signing key pair */
  readonly signingKeyPair: SigningKeyPair;
  /** Pre-keys for async key exchange */
  readonly preKeys: PreKey[];
  /** One-time pre-keys */
  readonly oneTimePreKeys: PreKey[];
  /** Creation timestamp */
  readonly createdAt: number;
  /** Whether this identity is active */
  isActive: boolean;
}

/** Pre-key for key exchange */
export interface PreKey {
  readonly id: number;
  readonly keyPair: KeyPair;
  readonly signature: Bytes;
}

/** Secure invitation */
export interface SecureInvitation {
  /** Invitation ID */
  readonly id: Bytes;
  /** Encrypted invitation data */
  readonly encryptedData: EncryptedMessage;
  /** Creator's public key */
  readonly creatorPublicKey: Bytes;
  /** Signature */
  readonly signature: Bytes;
  /** Expiration timestamp */
  readonly expiresAt: number;
  /** Whether single use */
  readonly singleUse: boolean;
  /** Whether revoked */
  isRevoked: boolean;
}

/** Key exchange bundle for establishing session */
export interface KeyExchangeBundle {
  readonly identityKey: Bytes;
  readonly signedPreKey: Bytes;
  readonly signedPreKeySignature: Bytes;
  readonly oneTimePreKey?: Bytes;
}

/** Message integrity data */
export interface MessageIntegrity {
  readonly hash: Bytes;
  readonly signature: Bytes;
  readonly timestamp: number;
  readonly sequenceNumber: number;
}

/** Crypto operation result */
export interface CryptoResult<T> {
  readonly success: boolean;
  readonly data?: T;
  readonly error?: string;
}

/** Security layer configuration */
export interface SecurityLayerConfig {
  /** Enable 16-bit additional security */
  readonly enable16BitLayer: boolean;
  /** Number of PBKDF2 iterations */
  readonly pbkdf2Iterations: number;
  /** Salt length in bytes */
  readonly saltLength: number;
}

/** Key derivation parameters */
export interface KDFParams {
  readonly salt: Bytes;
  readonly info: Bytes;
  readonly outputLength: number;
}
