/**
 * Phantom Messenger - AES-256-GCM Encryption
 * 
 * Core symmetric encryption implementation
 */

import type { Bytes, AESKey, CryptoResult } from './types.js';
import { randomBytes, concatBytes, splitBytes, secureWipe } from './utils.js';

/** AES-256 key size in bytes */
const AES_KEY_SIZE = 32;

/** GCM nonce size in bytes */
const GCM_NONCE_SIZE = 12;

/** GCM authentication tag size in bytes */
const GCM_TAG_SIZE = 16;

/**
 * Generate a new AES-256 key
 */
export function generateAESKey(): AESKey {
  return {
    key: randomBytes(AES_KEY_SIZE),
    algorithm: 'AES-256-GCM'
  };
}

/**
 * Import raw bytes as AES key
 */
export function importAESKey(keyBytes: Bytes): CryptoResult<AESKey> {
  if (keyBytes.length !== AES_KEY_SIZE) {
    return {
      success: false,
      error: `Invalid key size: expected ${AES_KEY_SIZE} bytes, got ${keyBytes.length}`
    };
  }

  return {
    success: true,
    data: {
      key: new Uint8Array(keyBytes),
      algorithm: 'AES-256-GCM'
    }
  };
}

/**
 * Encrypt data using AES-256-GCM
 * 
 * @param plaintext - Data to encrypt
 * @param key - AES-256 key
 * @param associatedData - Optional additional authenticated data
 * @returns Encrypted data with nonce and tag
 */
export async function aesEncrypt(
  plaintext: Bytes,
  key: AESKey,
  associatedData?: Bytes
): Promise<CryptoResult<{ ciphertext: Bytes; nonce: Bytes; tag: Bytes }>> {
  try {
    const nonce = randomBytes(GCM_NONCE_SIZE);

    if (typeof crypto !== 'undefined' && crypto.subtle) {
      // Web Crypto API
      const cryptoKey = await crypto.subtle.importKey(
        'raw',
        key.key,
        { name: 'AES-GCM' },
        false,
        ['encrypt']
      );

      const encrypted = await crypto.subtle.encrypt(
        {
          name: 'AES-GCM',
          iv: nonce,
          ...(associatedData && { additionalData: associatedData }),
          tagLength: GCM_TAG_SIZE * 8
        },
        cryptoKey,
        plaintext
      );

      const encryptedBytes = new Uint8Array(encrypted);
      // GCM appends the auth tag to the ciphertext
      const ciphertext = encryptedBytes.slice(0, -GCM_TAG_SIZE);
      const tag = encryptedBytes.slice(-GCM_TAG_SIZE);

      return {
        success: true,
        data: { ciphertext, nonce, tag }
      };
    }

    // Node.js fallback
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const nodeCrypto = require('crypto');
    const cipher = nodeCrypto.createCipheriv('aes-256-gcm', key.key, nonce);

    if (associatedData) {
      cipher.setAAD(associatedData);
    }

    const encrypted = Buffer.concat([
      cipher.update(plaintext),
      cipher.final()
    ]);

    const tag = cipher.getAuthTag();

    return {
      success: true,
      data: {
        ciphertext: new Uint8Array(encrypted),
        nonce,
        tag: new Uint8Array(tag)
      }
    };
  } catch (error) {
    return {
      success: false,
      error: `Encryption failed: ${error instanceof Error ? error.message : 'Unknown error'}`
    };
  }
}

/**
 * Decrypt data using AES-256-GCM
 * 
 * @param ciphertext - Encrypted data
 * @param nonce - Nonce used during encryption
 * @param tag - Authentication tag
 * @param key - AES-256 key
 * @param associatedData - Optional additional authenticated data
 * @returns Decrypted plaintext
 */
export async function aesDecrypt(
  ciphertext: Bytes,
  nonce: Bytes,
  tag: Bytes,
  key: AESKey,
  associatedData?: Bytes
): Promise<CryptoResult<Bytes>> {
  try {
    if (nonce.length !== GCM_NONCE_SIZE) {
      return {
        success: false,
        error: `Invalid nonce size: expected ${GCM_NONCE_SIZE} bytes, got ${nonce.length}`
      };
    }

    if (tag.length !== GCM_TAG_SIZE) {
      return {
        success: false,
        error: `Invalid tag size: expected ${GCM_TAG_SIZE} bytes, got ${tag.length}`
      };
    }

    if (typeof crypto !== 'undefined' && crypto.subtle) {
      // Web Crypto API
      const cryptoKey = await crypto.subtle.importKey(
        'raw',
        key.key,
        { name: 'AES-GCM' },
        false,
        ['decrypt']
      );

      // GCM expects ciphertext + tag concatenated
      const combined = concatBytes(ciphertext, tag);

      const decrypted = await crypto.subtle.decrypt(
        {
          name: 'AES-GCM',
          iv: nonce,
          ...(associatedData && { additionalData: associatedData }),
          tagLength: GCM_TAG_SIZE * 8
        },
        cryptoKey,
        combined
      );

      return {
        success: true,
        data: new Uint8Array(decrypted)
      };
    }

    // Node.js fallback
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const nodeCrypto = require('crypto');
    const decipher = nodeCrypto.createDecipheriv('aes-256-gcm', key.key, nonce);
    decipher.setAuthTag(tag);

    if (associatedData) {
      decipher.setAAD(associatedData);
    }

    const decrypted = Buffer.concat([
      decipher.update(ciphertext),
      decipher.final()
    ]);

    return {
      success: true,
      data: new Uint8Array(decrypted)
    };
  } catch (error) {
    return {
      success: false,
      error: `Decryption failed: ${error instanceof Error ? error.message : 'Unknown error'}`
    };
  }
}

/**
 * Encrypt with additional 16-bit security layer
 * Applies additional key derivation for extra protection
 */
export async function aesEncryptWithSecurityLayer(
  plaintext: Bytes,
  key: AESKey,
  securitySalt: Bytes,
  associatedData?: Bytes
): Promise<CryptoResult<{ ciphertext: Bytes; nonce: Bytes; tag: Bytes; securitySalt: Bytes }>> {
  try {
    // Derive enhanced key with 16-bit security layer
    const enhancedKey = await deriveKeyWithSecurityLayer(key.key, securitySalt);

    const result = await aesEncrypt(
      plaintext,
      { key: enhancedKey, algorithm: 'AES-256-GCM' },
      associatedData
    );

    // Securely wipe the derived key
    secureWipe(enhancedKey);

    if (!result.success || !result.data) {
      return result as CryptoResult<{ ciphertext: Bytes; nonce: Bytes; tag: Bytes; securitySalt: Bytes }>;
    }

    return {
      success: true,
      data: {
        ...result.data,
        securitySalt
      }
    };
  } catch (error) {
    return {
      success: false,
      error: `Encryption with security layer failed: ${error instanceof Error ? error.message : 'Unknown error'}`
    };
  }
}

/**
 * Decrypt with additional 16-bit security layer
 */
export async function aesDecryptWithSecurityLayer(
  ciphertext: Bytes,
  nonce: Bytes,
  tag: Bytes,
  key: AESKey,
  securitySalt: Bytes,
  associatedData?: Bytes
): Promise<CryptoResult<Bytes>> {
  try {
    // Derive enhanced key with 16-bit security layer
    const enhancedKey = await deriveKeyWithSecurityLayer(key.key, securitySalt);

    const result = await aesDecrypt(
      ciphertext,
      nonce,
      tag,
      { key: enhancedKey, algorithm: 'AES-256-GCM' },
      associatedData
    );

    // Securely wipe the derived key
    secureWipe(enhancedKey);

    return result;
  } catch (error) {
    return {
      success: false,
      error: `Decryption with security layer failed: ${error instanceof Error ? error.message : 'Unknown error'}`
    };
  }
}

/**
 * Derive key with 16-bit additional security layer
 * Uses PBKDF2 with high iteration count for additional protection
 */
async function deriveKeyWithSecurityLayer(key: Bytes, salt: Bytes): Promise<Bytes> {
  // Enhanced security layer: 600000 iterations minimum (OWASP recommended)
  const iterations = 600000 + (salt[0]! << 8) + salt[1]!;

  if (typeof crypto !== 'undefined' && crypto.subtle) {
    const baseKey = await crypto.subtle.importKey(
      'raw',
      key,
      { name: 'PBKDF2' },
      false,
      ['deriveBits']
    );

    const derivedBits = await crypto.subtle.deriveBits(
      {
        name: 'PBKDF2',
        salt,
        iterations,
        hash: 'SHA-256'
      },
      baseKey,
      256
    );

    return new Uint8Array(derivedBits);
  }

  // Node.js fallback
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const nodeCrypto = require('crypto');
  return new Promise((resolve, reject) => {
    nodeCrypto.pbkdf2(key, salt, iterations, 32, 'sha256', (err: Error | null, derivedKey: Buffer) => {
      if (err) reject(err);
      else resolve(new Uint8Array(derivedKey));
    });
  });
}

/**
 * Generate security salt for 16-bit layer
 */
export function generateSecuritySalt(): Bytes {
  return randomBytes(16);
}
