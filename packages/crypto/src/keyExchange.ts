/**
 * Phantom Messenger - Key Exchange Implementation
 * 
 * X25519 ECDH key exchange with Perfect Forward Secrecy
 */

import nacl from 'tweetnacl';
import type { 
  Bytes, 
  KeyPair, 
  SigningKeyPair, 
  CryptoResult,
  KeyExchangeBundle,
  PreKey,
  SessionKeys,
  AESKey 
} from './types.js';
import { randomBytes, concatBytes, secureWipe, constantTimeEqual } from './utils.js';

/** Curve25519 key size */
const KEY_SIZE = 32;

/** Signature size */
const SIGNATURE_SIZE = 64;

/**
 * Generate X25519 key pair for key exchange
 */
export function generateKeyPair(): KeyPair {
  const keyPair = nacl.box.keyPair();
  return {
    publicKey: keyPair.publicKey,
    secretKey: keyPair.secretKey
  };
}

/**
 * Generate X25519 key pair from seed (deterministic)
 */
export function generateKeyPairFromSeed(seed: Bytes): KeyPair {
  // X25519 derives public key from secret key
  const keyPair = nacl.box.keyPair.fromSecretKey(seed.slice(0, 32));
  return {
    publicKey: keyPair.publicKey,
    secretKey: keyPair.secretKey
  };
}

/**
 * Generate Ed25519 signing key pair
 */
export function generateSigningKeyPair(): SigningKeyPair {
  const keyPair = nacl.sign.keyPair();
  return {
    publicKey: keyPair.publicKey,
    secretKey: keyPair.secretKey
  };
}

/**
 * Generate Ed25519 signing key pair from seed (deterministic)
 */
export function generateSigningKeyPairFromSeed(seed: Bytes): SigningKeyPair {
  const keyPair = nacl.sign.keyPair.fromSeed(seed.slice(0, 32));
  return {
    publicKey: keyPair.publicKey,
    secretKey: keyPair.secretKey
  };
}

/**
 * Perform X25519 Diffie-Hellman key exchange
 */
export function performKeyExchange(
  ourSecretKey: Bytes,
  theirPublicKey: Bytes
): CryptoResult<Bytes> {
  try {
    if (ourSecretKey.length !== KEY_SIZE) {
      return {
        success: false,
        error: `Invalid secret key size: expected ${KEY_SIZE}, got ${ourSecretKey.length}`
      };
    }
    
    if (theirPublicKey.length !== KEY_SIZE) {
      return {
        success: false,
        error: `Invalid public key size: expected ${KEY_SIZE}, got ${theirPublicKey.length}`
      };
    }
    
    const sharedSecret = nacl.box.before(theirPublicKey, ourSecretKey);
    
    // Verify shared secret is not all zeros (invalid public key)
    let isZero = true;
    for (const byte of sharedSecret) {
      if (byte !== 0) {
        isZero = false;
        break;
      }
    }
    
    if (isZero) {
      return {
        success: false,
        error: 'Key exchange resulted in invalid shared secret'
      };
    }
    
    return {
      success: true,
      data: sharedSecret
    };
  } catch (error) {
    return {
      success: false,
      error: `Key exchange failed: ${error instanceof Error ? error.message : 'Unknown error'}`
    };
  }
}

/**
 * Sign data with Ed25519
 */
export function sign(data: Bytes, secretKey: Bytes): CryptoResult<Bytes> {
  try {
    const signature = nacl.sign.detached(data, secretKey);
    return {
      success: true,
      data: signature
    };
  } catch (error) {
    return {
      success: false,
      error: `Signing failed: ${error instanceof Error ? error.message : 'Unknown error'}`
    };
  }
}

/**
 * Verify Ed25519 signature
 */
export function verify(
  data: Bytes,
  signature: Bytes,
  publicKey: Bytes
): boolean {
  try {
    return nacl.sign.detached.verify(data, signature, publicKey);
  } catch {
    return false;
  }
}

/**
 * Generate pre-key with signature
 */
export function generatePreKey(id: number, signingKey: SigningKeyPair): PreKey {
  const keyPair = generateKeyPair();
  const signResult = sign(keyPair.publicKey, signingKey.secretKey);
  
  if (!signResult.success || !signResult.data) {
    throw new Error('Failed to sign pre-key');
  }
  
  return {
    id,
    keyPair,
    signature: signResult.data
  };
}

/**
 * Generate pre-key from seed (deterministic)
 */
export function generatePreKeyFromSeed(id: number, signingKey: SigningKeyPair, seed: Bytes): PreKey {
  const keyPair = generateKeyPairFromSeed(seed);
  const signResult = sign(keyPair.publicKey, signingKey.secretKey);
  
  if (!signResult.success || !signResult.data) {
    throw new Error('Failed to sign pre-key');
  }
  
  return {
    id,
    keyPair,
    signature: signResult.data
  };
}

/**
 * Generate multiple one-time pre-keys
 */
export function generateOneTimePreKeys(
  startId: number,
  count: number,
  signingKey: SigningKeyPair
): PreKey[] {
  const preKeys: PreKey[] = [];
  for (let i = 0; i < count; i++) {
    preKeys.push(generatePreKey(startId + i, signingKey));
  }
  return preKeys;
}

/**
 * Create key exchange bundle for sharing
 */
export function createKeyExchangeBundle(
  identityKey: Bytes,
  signedPreKey: PreKey
): KeyExchangeBundle {
  return {
    identityKey,
    signedPreKey: signedPreKey.keyPair.publicKey,
    signedPreKeySignature: signedPreKey.signature
  };
}

/**
 * Perform X3DH key agreement (Extended Triple Diffie-Hellman)
 * Used for establishing initial session with Perfect Forward Secrecy
 */
export async function performX3DH(
  ourIdentityKey: KeyPair,
  ourEphemeralKey: KeyPair,
  theirBundle: KeyExchangeBundle,
  theirIdentityVerifyKey: Bytes
): Promise<CryptoResult<Bytes>> {
  try {
    // Verify the signed pre-key
    const isValid = verify(
      theirBundle.signedPreKey,
      theirBundle.signedPreKeySignature,
      theirIdentityVerifyKey
    );
    
    if (!isValid) {
      return {
        success: false,
        error: 'Invalid signed pre-key signature'
      };
    }
    
    // DH1: Our identity key <-> Their signed pre-key
    const dh1 = performKeyExchange(ourIdentityKey.secretKey, theirBundle.signedPreKey);
    if (!dh1.success || !dh1.data) {
      return { success: false, error: 'DH1 failed' };
    }
    
    // DH2: Our ephemeral key <-> Their identity key
    const dh2 = performKeyExchange(ourEphemeralKey.secretKey, theirBundle.identityKey);
    if (!dh2.success || !dh2.data) {
      secureWipe(dh1.data);
      return { success: false, error: 'DH2 failed' };
    }
    
    // DH3: Our ephemeral key <-> Their signed pre-key
    const dh3 = performKeyExchange(ourEphemeralKey.secretKey, theirBundle.signedPreKey);
    if (!dh3.success || !dh3.data) {
      secureWipe(dh1.data);
      secureWipe(dh2.data);
      return { success: false, error: 'DH3 failed' };
    }
    
    // DH4: Our ephemeral key <-> Their one-time pre-key (if available)
    let dh4Data: Bytes | undefined;
    if (theirBundle.oneTimePreKey) {
      const dh4 = performKeyExchange(ourEphemeralKey.secretKey, theirBundle.oneTimePreKey);
      if (dh4.success && dh4.data) {
        dh4Data = dh4.data;
      }
    }
    
    // Combine all DH outputs
    const combined = dh4Data 
      ? concatBytes(dh1.data, dh2.data, dh3.data, dh4Data)
      : concatBytes(dh1.data, dh2.data, dh3.data);
    
    // Derive master secret using HKDF
    const masterSecret = await hkdf(
      combined,
      new Uint8Array(32), // salt
      new TextEncoder().encode('PhantomX3DH'),
      32
    );
    
    // Clean up intermediate values
    secureWipe(dh1.data);
    secureWipe(dh2.data);
    secureWipe(dh3.data);
    if (dh4Data) secureWipe(dh4Data);
    secureWipe(combined);
    
    return {
      success: true,
      data: masterSecret
    };
  } catch (error) {
    return {
      success: false,
      error: `X3DH failed: ${error instanceof Error ? error.message : 'Unknown error'}`
    };
  }
}

/**
 * HKDF - HMAC-based Key Derivation Function
 */
export async function hkdf(
  inputKeyMaterial: Bytes,
  salt: Bytes,
  info: Bytes,
  outputLength: number
): Promise<Bytes> {
  if (typeof crypto !== 'undefined' && crypto.subtle) {
    const key = await crypto.subtle.importKey(
      'raw',
      inputKeyMaterial,
      { name: 'HKDF' },
      false,
      ['deriveBits']
    );
    
    const derivedBits = await crypto.subtle.deriveBits(
      {
        name: 'HKDF',
        hash: 'SHA-256',
        salt,
        info
      },
      key,
      outputLength * 8
    );
    
    return new Uint8Array(derivedBits);
  }
  
  // Node.js fallback
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const nodeCrypto = require('crypto');
  return new Promise((resolve, reject) => {
    try {
      const derived = nodeCrypto.hkdfSync('sha256', inputKeyMaterial, salt, info, outputLength);
      resolve(new Uint8Array(derived));
    } catch (err) {
      reject(err);
    }
  });
}

/**
 * Derive session keys from shared secret
 */
export async function deriveSessionKeys(
  sharedSecret: Bytes,
  ourPublicKey: Bytes,
  theirPublicKey: Bytes
): Promise<SessionKeys> {
  // Create deterministic info based on public keys
  // Ensures both parties derive the same keys
  const comparison = compareBytes(ourPublicKey, theirPublicKey);
  const info = comparison < 0 
    ? concatBytes(ourPublicKey, theirPublicKey)
    : concatBytes(theirPublicKey, ourPublicKey);
  
  // Derive 96 bytes: 32 for send key, 32 for receive key, 32 for chain key
  const keyMaterial = await hkdf(
    sharedSecret,
    new Uint8Array(32),
    concatBytes(new TextEncoder().encode('PhantomSessionKeys'), info),
    96
  );
  
  // Split based on key ordering
  const [key1, key2, chainKey] = [
    keyMaterial.slice(0, 32),
    keyMaterial.slice(32, 64),
    keyMaterial.slice(64, 96)
  ];
  
  return {
    sendKey: {
      key: comparison < 0 ? key1 : key2,
      algorithm: 'AES-256-GCM'
    },
    receiveKey: {
      key: comparison < 0 ? key2 : key1,
      algorithm: 'AES-256-GCM'
    },
    chainKey,
    messageNumber: 0
  };
}

/**
 * Ratchet session keys for Perfect Forward Secrecy
 */
export async function ratchetSessionKeys(
  currentKeys: SessionKeys
): Promise<SessionKeys> {
  // Derive new chain key
  const newChainKey = await hkdf(
    currentKeys.chainKey,
    new Uint8Array(32),
    new TextEncoder().encode('PhantomChainRatchet'),
    32
  );
  
  // Derive new message keys from chain key
  const messageKeyMaterial = await hkdf(
    newChainKey,
    new Uint8Array(32),
    new TextEncoder().encode('PhantomMessageKey'),
    64
  );
  
  return {
    sendKey: {
      key: messageKeyMaterial.slice(0, 32),
      algorithm: 'AES-256-GCM'
    },
    receiveKey: {
      key: messageKeyMaterial.slice(32, 64),
      algorithm: 'AES-256-GCM'
    },
    chainKey: newChainKey,
    messageNumber: currentKeys.messageNumber + 1
  };
}

/**
 * Compare two byte arrays lexicographically
 */
function compareBytes(a: Bytes, b: Bytes): number {
  const minLength = Math.min(a.length, b.length);
  for (let i = 0; i < minLength; i++) {
    if (a[i]! < b[i]!) return -1;
    if (a[i]! > b[i]!) return 1;
  }
  return a.length - b.length;
}
