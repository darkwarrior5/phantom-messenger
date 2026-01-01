/**
 * Phantom Messenger - Media Encryption
 * 
 * Encrypts files with AES-256-GCM before upload
 * Each file gets a unique key, which is then encrypted
 * with the recipient's public key
 */

import { randomBytes, bytesToBase64, base64ToBytes } from './utils.js';
import { aesEncrypt, aesDecrypt, importAESKey } from './aes.js';
import { performKeyExchange, generateKeyPair } from './keyExchange.js';

export interface EncryptedMedia {
  /** Encrypted file data */
  encryptedData: Uint8Array;
  /** AES key encrypted for recipient (base64) */
  encryptedKey: string;
  /** Ephemeral public key used for key exchange (base64) */
  ephemeralPublicKey: string;
  /** Nonce used for AES encryption (base64) */
  nonce: string;
  /** Auth tag from AES-GCM (base64) */
  tag: string;
}

export interface MediaEncryptionResult {
  success: boolean;
  data?: EncryptedMedia;
  error?: string;
}

export interface MediaDecryptionResult {
  success: boolean;
  data?: Uint8Array;
  error?: string;
}

/**
 * Encrypt a file for a specific recipient
 * 
 * Flow:
 * 1. Generate random AES-256 key for this file
 * 2. Encrypt file with AES-GCM
 * 3. Generate ephemeral X25519 keypair
 * 4. Derive shared secret with recipient's public key
 * 5. Encrypt the AES key with shared secret
 */
export async function encryptMedia(
  fileData: Uint8Array,
  recipientPublicKey: Uint8Array
): Promise<MediaEncryptionResult> {
  try {
    // 1. Generate random AES key for this file
    const fileKeyBytes = randomBytes(32);
    const fileKeyResult = importAESKey(fileKeyBytes);
    if (!fileKeyResult.success || !fileKeyResult.data) {
      return { success: false, error: 'Failed to create file key' };
    }
    
    // 2. Encrypt file with AES-GCM
    const encryptResult = await aesEncrypt(fileData, fileKeyResult.data);
    if (!encryptResult.success || !encryptResult.data) {
      return { success: false, error: 'Failed to encrypt file' };
    }
    
    // 3. Generate ephemeral keypair for key exchange
    const ephemeralKeyPair = generateKeyPair();
    
    // 4. Derive shared secret
    const sharedSecret = performKeyExchange(
      ephemeralKeyPair.secretKey,
      recipientPublicKey
    );
    if (!sharedSecret.success || !sharedSecret.data) {
      return { success: false, error: 'Failed to derive shared secret' };
    }
    
    // 5. Encrypt the file key with shared secret
    const sharedKeyResult = importAESKey(sharedSecret.data);
    if (!sharedKeyResult.success || !sharedKeyResult.data) {
      return { success: false, error: 'Failed to import shared key' };
    }
    
    const keyEncryptResult = await aesEncrypt(fileKeyBytes, sharedKeyResult.data);
    if (!keyEncryptResult.success || !keyEncryptResult.data) {
      return { success: false, error: 'Failed to encrypt file key' };
    }
    
    // Combine key ciphertext + nonce + tag for storage
    const encryptedKeyBundle = new Uint8Array(
      keyEncryptResult.data.nonce.length + 
      keyEncryptResult.data.ciphertext.length + 
      keyEncryptResult.data.tag.length
    );
    encryptedKeyBundle.set(keyEncryptResult.data.nonce, 0);
    encryptedKeyBundle.set(keyEncryptResult.data.ciphertext, keyEncryptResult.data.nonce.length);
    encryptedKeyBundle.set(keyEncryptResult.data.tag, keyEncryptResult.data.nonce.length + keyEncryptResult.data.ciphertext.length);
    
    return {
      success: true,
      data: {
        encryptedData: encryptResult.data.ciphertext,
        encryptedKey: bytesToBase64(encryptedKeyBundle),
        ephemeralPublicKey: bytesToBase64(ephemeralKeyPair.publicKey),
        nonce: bytesToBase64(encryptResult.data.nonce),
        tag: bytesToBase64(encryptResult.data.tag)
      }
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Encryption failed'
    };
  }
}

/**
 * Decrypt a file using recipient's private key
 * 
 * Flow:
 * 1. Derive shared secret from ephemeral public key + our private key
 * 2. Decrypt the AES key
 * 3. Decrypt the file with AES key
 */
export async function decryptMedia(
  encryptedMedia: EncryptedMedia,
  recipientSecretKey: Uint8Array
): Promise<MediaDecryptionResult> {
  try {
    // 1. Parse the ephemeral public key
    const ephemeralPublicKey = base64ToBytes(encryptedMedia.ephemeralPublicKey);
    
    // 2. Derive shared secret
    const sharedSecret = performKeyExchange(recipientSecretKey, ephemeralPublicKey);
    if (!sharedSecret.success || !sharedSecret.data) {
      return { success: false, error: 'Failed to derive shared secret' };
    }
    
    // Import shared secret as AES key
    const sharedKeyResult = importAESKey(sharedSecret.data);
    if (!sharedKeyResult.success || !sharedKeyResult.data) {
      return { success: false, error: 'Failed to import shared key' };
    }
    
    // 3. Decrypt the file key (parse nonce + ciphertext + tag)
    const encryptedKeyBundle = base64ToBytes(encryptedMedia.encryptedKey);
    const keyNonce = encryptedKeyBundle.slice(0, 12);
    const keyCiphertext = encryptedKeyBundle.slice(12, -16);
    const keyTag = encryptedKeyBundle.slice(-16);
    
    const fileKeyResult = await aesDecrypt(
      keyCiphertext,
      keyNonce,
      keyTag,
      sharedKeyResult.data
    );
    
    if (!fileKeyResult.success || !fileKeyResult.data) {
      return { success: false, error: 'Failed to decrypt file key' };
    }
    
    // Import decrypted file key
    const fileKeyImportResult = importAESKey(fileKeyResult.data);
    if (!fileKeyImportResult.success || !fileKeyImportResult.data) {
      return { success: false, error: 'Failed to import file key' };
    }
    
    // 4. Decrypt the file
    const nonce = base64ToBytes(encryptedMedia.nonce);
    const tag = base64ToBytes(encryptedMedia.tag);
    
    const fileResult = await aesDecrypt(
      encryptedMedia.encryptedData,
      nonce,
      tag,
      fileKeyImportResult.data
    );
    
    if (!fileResult.success || !fileResult.data) {
      return { success: false, error: 'Failed to decrypt file' };
    }
    
    return { success: true, data: fileResult.data };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Decryption failed'
    };
  }
}

/**
 * Encrypt media for multiple recipients (group chat)
 * Returns a map of recipient public key -> encrypted key
 */
export async function encryptMediaForMultiple(
  fileData: Uint8Array,
  recipientPublicKeys: Uint8Array[]
): Promise<{ 
  success: boolean;
  encryptedData?: Uint8Array;
  nonce?: string;
  tag?: string;
  recipientKeys?: Map<string, { encryptedKey: string; ephemeralPublicKey: string }>;
  error?: string;
}> {
  try {
    // 1. Generate random AES key for this file
    const fileKeyBytes = randomBytes(32);
    const fileKeyResult = importAESKey(fileKeyBytes);
    if (!fileKeyResult.success || !fileKeyResult.data) {
      return { success: false, error: 'Failed to create file key' };
    }
    
    // 2. Encrypt file once with AES-GCM
    const encryptResult = await aesEncrypt(fileData, fileKeyResult.data);
    if (!encryptResult.success || !encryptResult.data) {
      return { success: false, error: 'Failed to encrypt file' };
    }
    
    // 3. Encrypt the file key for each recipient
    const recipientKeys = new Map<string, { encryptedKey: string; ephemeralPublicKey: string }>();
    
    for (const recipientPubKey of recipientPublicKeys) {
      // Generate ephemeral keypair for each recipient
      const ephemeralKeyPair = generateKeyPair();
      
      // Derive shared secret
      const sharedSecret = performKeyExchange(
        ephemeralKeyPair.secretKey,
        recipientPubKey
      );
      if (!sharedSecret.success || !sharedSecret.data) continue;
      
      // Import shared secret as AES key
      const sharedKeyResult = importAESKey(sharedSecret.data);
      if (!sharedKeyResult.success || !sharedKeyResult.data) continue;
      
      // Encrypt file key
      const keyEncryptResult = await aesEncrypt(fileKeyBytes, sharedKeyResult.data);
      if (!keyEncryptResult.success || !keyEncryptResult.data) continue;
      
      // Bundle key encryption data
      const encryptedKeyBundle = new Uint8Array(
        keyEncryptResult.data.nonce.length + 
        keyEncryptResult.data.ciphertext.length + 
        keyEncryptResult.data.tag.length
      );
      encryptedKeyBundle.set(keyEncryptResult.data.nonce, 0);
      encryptedKeyBundle.set(keyEncryptResult.data.ciphertext, keyEncryptResult.data.nonce.length);
      encryptedKeyBundle.set(keyEncryptResult.data.tag, keyEncryptResult.data.nonce.length + keyEncryptResult.data.ciphertext.length);
      
      recipientKeys.set(bytesToBase64(recipientPubKey), {
        encryptedKey: bytesToBase64(encryptedKeyBundle),
        ephemeralPublicKey: bytesToBase64(ephemeralKeyPair.publicKey)
      });
    }
    
    return {
      success: true,
      encryptedData: encryptResult.data.ciphertext,
      nonce: bytesToBase64(encryptResult.data.nonce),
      tag: bytesToBase64(encryptResult.data.tag),
      recipientKeys
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Encryption failed'
    };
  }
}
