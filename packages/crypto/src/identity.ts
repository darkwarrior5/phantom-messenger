/**
 * Phantom Messenger - Disposable Identity System
 * 
 * Generate, manage, and permanently destroy anonymous identities
 */

import type { 
  Bytes, 
  DisposableIdentity, 
  KeyPair,
  SigningKeyPair,
  PreKey,
  CryptoResult,
  Base64String
} from './types.js';
import { 
  generateKeyPair, 
  generateSigningKeyPair, 
  generatePreKey,
  generatePreKeyFromSeed,
  generateOneTimePreKeys,
  generateKeyPairFromSeed,
  generateSigningKeyPairFromSeed,
  hkdf
} from './keyExchange.js';
import { 
  randomBytes, 
  secureWipe, 
  bytesToBase64, 
  base64ToBytes,
  bytesToHex,
  concatBytes,
  stringToBytes
} from './utils.js';

/** Number of pre-keys to generate */
const DEFAULT_PRE_KEY_COUNT = 10;

/** Number of one-time pre-keys to generate */
const DEFAULT_ONE_TIME_PRE_KEY_COUNT = 100;

/** Identity ID size in bytes (256 bits) */
const IDENTITY_ID_SIZE = 32;

/**
 * Generate a new disposable identity
 * 
 * Creates a completely anonymous identity with:
 * - Random 256-bit identifier
 * - X25519 identity key pair for encryption
 * - Ed25519 signing key pair for authentication
 * - Pre-keys for asynchronous key exchange
 */
export function generateDisposableIdentity(): DisposableIdentity {
  const id = randomBytes(IDENTITY_ID_SIZE);
  const identityKeyPair = generateKeyPair();
  const signingKeyPair = generateSigningKeyPair();
  
  // Generate signed pre-keys
  const preKeys: PreKey[] = [];
  for (let i = 0; i < DEFAULT_PRE_KEY_COUNT; i++) {
    preKeys.push(generatePreKey(i, signingKeyPair));
  }
  
  // Generate one-time pre-keys
  const oneTimePreKeys = generateOneTimePreKeys(
    DEFAULT_PRE_KEY_COUNT,
    DEFAULT_ONE_TIME_PRE_KEY_COUNT,
    signingKeyPair
  );
  
  return {
    id,
    identityKeyPair,
    signingKeyPair,
    preKeys,
    oneTimePreKeys,
    createdAt: Date.now(),
    isActive: true
  };
}

/**
 * Generate a deterministic identity from username and password
 * 
 * Same credentials = Same identity on any device
 * Uses HKDF to derive all keys from a master seed
 */
export async function generateIdentityFromCredentials(
  username: string,
  password: string
): Promise<DisposableIdentity> {
  const encoder = new TextEncoder();
  
  // Create master seed from credentials using PBKDF2
  const salt = encoder.encode(`phantom-identity-${username}`);
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(password),
    { name: 'PBKDF2' },
    false,
    ['deriveBits']
  );
  
  const masterSeed = new Uint8Array(await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt,
      iterations: 100000,
      hash: 'SHA-256'
    },
    keyMaterial,
    256
  ));
  
  // Derive different keys using HKDF with different info strings
  const idSeed = await hkdf(masterSeed, salt, encoder.encode('phantom-id'), 32);
  const identitySeed = await hkdf(masterSeed, salt, encoder.encode('phantom-identity-key'), 32);
  const signingSeed = await hkdf(masterSeed, salt, encoder.encode('phantom-signing-key'), 32);
  const preKeySeed = await hkdf(masterSeed, salt, encoder.encode('phantom-prekeys'), 32);
  
  // Generate deterministic keys
  const id = idSeed;
  const identityKeyPair = generateKeyPairFromSeed(identitySeed);
  const signingKeyPair = generateSigningKeyPairFromSeed(signingSeed);
  
  // Generate deterministic pre-keys
  const preKeys: PreKey[] = [];
  for (let i = 0; i < DEFAULT_PRE_KEY_COUNT; i++) {
    const pkSeed = await hkdf(preKeySeed, salt, encoder.encode(`prekey-${i}`), 32);
    preKeys.push(generatePreKeyFromSeed(i, signingKeyPair, pkSeed));
  }
  
  // Generate deterministic one-time pre-keys
  const oneTimePreKeys: PreKey[] = [];
  for (let i = 0; i < DEFAULT_ONE_TIME_PRE_KEY_COUNT; i++) {
    const otkSeed = await hkdf(preKeySeed, salt, encoder.encode(`otk-${i}`), 32);
    oneTimePreKeys.push(generatePreKeyFromSeed(DEFAULT_PRE_KEY_COUNT + i, signingKeyPair, otkSeed));
  }
  
  return {
    id,
    identityKeyPair,
    signingKeyPair,
    preKeys,
    oneTimePreKeys,
    createdAt: Date.now(),
    isActive: true
  };
}

/**
 * Permanently destroy an identity
 * 
 * Securely wipes all cryptographic material from memory.
 * After destruction, the identity cannot be recovered.
 */
export function destroyIdentity(identity: DisposableIdentity): void {
  // Wipe the identity ID
  secureWipe(identity.id);
  
  // Wipe identity key pair
  secureWipe(identity.identityKeyPair.publicKey);
  secureWipe(identity.identityKeyPair.secretKey);
  
  // Wipe signing key pair
  secureWipe(identity.signingKeyPair.publicKey);
  secureWipe(identity.signingKeyPair.secretKey);
  
  // Wipe all pre-keys
  for (const preKey of identity.preKeys) {
    secureWipe(preKey.keyPair.publicKey);
    secureWipe(preKey.keyPair.secretKey);
    secureWipe(preKey.signature);
  }
  
  // Wipe all one-time pre-keys
  for (const preKey of identity.oneTimePreKeys) {
    secureWipe(preKey.keyPair.publicKey);
    secureWipe(preKey.keyPair.secretKey);
    secureWipe(preKey.signature);
  }
  
  // Clear arrays
  identity.preKeys.length = 0;
  identity.oneTimePreKeys.length = 0;
  
  // Mark as inactive
  identity.isActive = false;
}

/**
 * Get the public identity bundle for sharing
 * Only includes public information needed for others to contact this identity
 */
export function getPublicIdentityBundle(identity: DisposableIdentity): PublicIdentityBundle {
  if (!identity.isActive) {
    throw new Error('Cannot get public bundle from destroyed identity');
  }
  
  return {
    id: bytesToBase64(identity.id),
    identityKey: bytesToBase64(identity.identityKeyPair.publicKey),
    signingKey: bytesToBase64(identity.signingKeyPair.publicKey),
    signedPreKey: {
      id: identity.preKeys[0]!.id,
      publicKey: bytesToBase64(identity.preKeys[0]!.keyPair.publicKey),
      signature: bytesToBase64(identity.preKeys[0]!.signature)
    },
    oneTimePreKeys: identity.oneTimePreKeys.slice(0, 10).map(pk => ({
      id: pk.id,
      publicKey: bytesToBase64(pk.keyPair.publicKey)
    }))
  };
}

/**
 * Public identity bundle for sharing
 */
export interface PublicIdentityBundle {
  id: Base64String;
  identityKey: Base64String;
  signingKey: Base64String;
  signedPreKey: {
    id: number;
    publicKey: Base64String;
    signature: Base64String;
  };
  oneTimePreKeys: Array<{
    id: number;
    publicKey: Base64String;
  }>;
}

/**
 * Consume a one-time pre-key
 * Returns the pre-key and removes it from the identity
 */
export function consumeOneTimePreKey(identity: DisposableIdentity): PreKey | null {
  if (!identity.isActive) {
    return null;
  }
  
  const preKey = identity.oneTimePreKeys.shift();
  return preKey ?? null;
}

/**
 * Replenish one-time pre-keys
 */
export function replenishOneTimePreKeys(
  identity: DisposableIdentity,
  count: number = DEFAULT_ONE_TIME_PRE_KEY_COUNT
): PreKey[] {
  if (!identity.isActive) {
    throw new Error('Cannot replenish pre-keys for destroyed identity');
  }
  
  const startId = identity.oneTimePreKeys.length > 0
    ? Math.max(...identity.oneTimePreKeys.map(pk => pk.id)) + 1
    : DEFAULT_PRE_KEY_COUNT + DEFAULT_ONE_TIME_PRE_KEY_COUNT;
  
  const newPreKeys = generateOneTimePreKeys(startId, count, identity.signingKeyPair);
  identity.oneTimePreKeys.push(...newPreKeys);
  
  return newPreKeys;
}

/**
 * Rotate the signed pre-key
 */
export function rotateSignedPreKey(identity: DisposableIdentity): PreKey {
  if (!identity.isActive) {
    throw new Error('Cannot rotate pre-key for destroyed identity');
  }
  
  // Generate new pre-key
  const newId = Math.max(...identity.preKeys.map(pk => pk.id)) + 1;
  const newPreKey = generatePreKey(newId, identity.signingKeyPair);
  
  // Add to front of pre-keys array
  identity.preKeys.unshift(newPreKey);
  
  // Keep only recent pre-keys (allow old ones to be used briefly)
  if (identity.preKeys.length > DEFAULT_PRE_KEY_COUNT * 2) {
    const removed = identity.preKeys.pop()!;
    secureWipe(removed.keyPair.publicKey);
    secureWipe(removed.keyPair.secretKey);
    secureWipe(removed.signature);
  }
  
  return newPreKey;
}

/**
 * Export identity for secure storage
 * WARNING: This exports sensitive key material
 */
export function exportIdentity(identity: DisposableIdentity): CryptoResult<string> {
  if (!identity.isActive) {
    return {
      success: false,
      error: 'Cannot export destroyed identity'
    };
  }
  
  try {
    const exportData: ExportedIdentity = {
      version: 1,
      id: bytesToBase64(identity.id),
      identityKeyPair: {
        publicKey: bytesToBase64(identity.identityKeyPair.publicKey),
        secretKey: bytesToBase64(identity.identityKeyPair.secretKey)
      },
      signingKeyPair: {
        publicKey: bytesToBase64(identity.signingKeyPair.publicKey),
        secretKey: bytesToBase64(identity.signingKeyPair.secretKey)
      },
      preKeys: identity.preKeys.map(pk => ({
        id: pk.id,
        publicKey: bytesToBase64(pk.keyPair.publicKey),
        secretKey: bytesToBase64(pk.keyPair.secretKey),
        signature: bytesToBase64(pk.signature)
      })),
      oneTimePreKeyStartId: identity.oneTimePreKeys[0]?.id ?? 0,
      createdAt: identity.createdAt
    };
    
    return {
      success: true,
      data: JSON.stringify(exportData)
    };
  } catch (error) {
    return {
      success: false,
      error: `Export failed: ${error instanceof Error ? error.message : 'Unknown error'}`
    };
  }
}

/**
 * Import identity from secure storage
 */
export function importIdentity(exportedData: string): CryptoResult<DisposableIdentity> {
  try {
    const data: ExportedIdentity = JSON.parse(exportedData);
    
    if (data.version !== 1) {
      return {
        success: false,
        error: `Unsupported identity version: ${data.version}`
      };
    }
    
    const identity: DisposableIdentity = {
      id: base64ToBytes(data.id),
      identityKeyPair: {
        publicKey: base64ToBytes(data.identityKeyPair.publicKey),
        secretKey: base64ToBytes(data.identityKeyPair.secretKey)
      },
      signingKeyPair: {
        publicKey: base64ToBytes(data.signingKeyPair.publicKey),
        secretKey: base64ToBytes(data.signingKeyPair.secretKey)
      },
      preKeys: data.preKeys.map(pk => ({
        id: pk.id,
        keyPair: {
          publicKey: base64ToBytes(pk.publicKey),
          secretKey: base64ToBytes(pk.secretKey)
        },
        signature: base64ToBytes(pk.signature)
      })),
      oneTimePreKeys: [], // Regenerate one-time pre-keys
      createdAt: data.createdAt,
      isActive: true
    };
    
    // Regenerate one-time pre-keys
    const newOneTimePreKeys = generateOneTimePreKeys(
      data.oneTimePreKeyStartId,
      DEFAULT_ONE_TIME_PRE_KEY_COUNT,
      identity.signingKeyPair
    );
    identity.oneTimePreKeys.push(...newOneTimePreKeys);
    
    return {
      success: true,
      data: identity
    };
  } catch (error) {
    return {
      success: false,
      error: `Import failed: ${error instanceof Error ? error.message : 'Unknown error'}`
    };
  }
}

/**
 * Exported identity format
 */
interface ExportedIdentity {
  version: number;
  id: Base64String;
  identityKeyPair: {
    publicKey: Base64String;
    secretKey: Base64String;
  };
  signingKeyPair: {
    publicKey: Base64String;
    secretKey: Base64String;
  };
  preKeys: Array<{
    id: number;
    publicKey: Base64String;
    secretKey: Base64String;
    signature: Base64String;
  }>;
  oneTimePreKeyStartId: number;
  createdAt: number;
}

/**
 * Get a short, human-readable identifier
 * For display purposes only - NOT cryptographically significant
 */
export function getDisplayIdentifier(identity: DisposableIdentity): string {
  if (!identity.isActive) {
    return '[DESTROYED]';
  }
  const hex = bytesToHex(identity.id);
  return `${hex.slice(0, 4)}-${hex.slice(4, 8)}-${hex.slice(8, 12)}`.toUpperCase();
}

/**
 * Verify identity integrity
 */
export function verifyIdentityIntegrity(identity: DisposableIdentity): boolean {
  if (!identity.isActive) {
    return false;
  }
  
  // Check key sizes
  if (identity.id.length !== IDENTITY_ID_SIZE) return false;
  if (identity.identityKeyPair.publicKey.length !== 32) return false;
  if (identity.identityKeyPair.secretKey.length !== 32) return false;
  if (identity.signingKeyPair.publicKey.length !== 32) return false;
  if (identity.signingKeyPair.secretKey.length !== 64) return false;
  
  // Check pre-keys exist
  if (identity.preKeys.length === 0) return false;
  
  return true;
}
