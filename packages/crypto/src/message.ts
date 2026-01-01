/**
 * Phantom Messenger - Message Encryption System
 * 
 * End-to-end encrypted message handling with integrity verification
 */

import type {
  Bytes,
  EncryptedMessage,
  SerializedEncryptedMessage,
  SessionKeys,
  MessageIntegrity,
  CryptoResult,
  DisposableIdentity
} from './types.js';
import { 
  aesEncryptWithSecurityLayer, 
  aesDecryptWithSecurityLayer,
  generateSecuritySalt 
} from './aes.js';
import { 
  generateKeyPair, 
  performKeyExchange, 
  deriveSessionKeys,
  ratchetSessionKeys,
  sign,
  verify
} from './keyExchange.js';
import {
  bytesToBase64,
  base64ToBytes,
  stringToBytes,
  bytesToString,
  concatBytes,
  randomBytes,
  secureWipe,
  constantTimeEqual
} from './utils.js';

/** Current message format version */
const MESSAGE_VERSION = 1;

/**
 * Encrypt a message for a recipient
 */
export async function encryptMessage(
  plaintext: string,
  sessionKeys: SessionKeys,
  senderIdentity: DisposableIdentity,
  recipientPublicKey: Bytes
): Promise<CryptoResult<EncryptedMessage>> {
  try {
    if (!senderIdentity.isActive) {
      return {
        success: false,
        error: 'Cannot encrypt with destroyed identity'
      };
    }
    
    // Generate ephemeral key pair for Perfect Forward Secrecy
    const ephemeralKeyPair = generateKeyPair();
    
    // Perform key exchange with ephemeral key
    const sharedSecret = performKeyExchange(
      ephemeralKeyPair.secretKey,
      recipientPublicKey
    );
    
    if (!sharedSecret.success || !sharedSecret.data) {
      return {
        success: false,
        error: sharedSecret.error ?? 'Key exchange failed'
      };
    }
    
    // Derive message-specific keys
    const messageKeys = await deriveSessionKeys(
      sharedSecret.data,
      ephemeralKeyPair.publicKey,
      recipientPublicKey
    );
    
    // Create message payload with metadata
    const messagePayload = createMessagePayload(plaintext, sessionKeys.messageNumber);
    
    // Generate security salt for 16-bit layer
    const securitySalt = generateSecuritySalt();
    
    // Create associated data for authentication
    const associatedData = createAssociatedData(
      ephemeralKeyPair.publicKey,
      recipientPublicKey,
      sessionKeys.messageNumber
    );
    
    // Encrypt with AES-256-GCM + 16-bit security layer
    const encrypted = await aesEncryptWithSecurityLayer(
      messagePayload,
      messageKeys.sendKey,
      securitySalt,
      associatedData
    );
    
    if (!encrypted.success || !encrypted.data) {
      return {
        success: false,
        error: encrypted.error ?? 'Encryption failed'
      };
    }
    
    // Clean up sensitive data
    secureWipe(sharedSecret.data);
    secureWipe(ephemeralKeyPair.secretKey);
    secureWipe(messageKeys.sendKey.key);
    secureWipe(messageKeys.receiveKey.key);
    secureWipe(messageKeys.chainKey);
    
    // Create HMAC for integrity
    const mac = await computeMAC(
      concatBytes(encrypted.data.ciphertext, encrypted.data.nonce),
      sessionKeys.chainKey
    );
    
    return {
      success: true,
      data: {
        ciphertext: encrypted.data.ciphertext,
        nonce: encrypted.data.nonce,
        tag: encrypted.data.tag,
        mac,
        ephemeralPublicKey: ephemeralKeyPair.publicKey,
        securitySalt,
        version: MESSAGE_VERSION
      }
    };
  } catch (error) {
    return {
      success: false,
      error: `Message encryption failed: ${error instanceof Error ? error.message : 'Unknown error'}`
    };
  }
}

/**
 * Decrypt a message from a sender
 */
export async function decryptMessage(
  encrypted: EncryptedMessage,
  sessionKeys: SessionKeys,
  recipientIdentity: DisposableIdentity,
  senderPublicKey: Bytes
): Promise<CryptoResult<DecryptedMessage>> {
  try {
    if (!recipientIdentity.isActive) {
      return {
        success: false,
        error: 'Cannot decrypt with destroyed identity'
      };
    }
    
    if (encrypted.version !== MESSAGE_VERSION) {
      return {
        success: false,
        error: `Unsupported message version: ${encrypted.version}`
      };
    }
    
    // Verify MAC
    const expectedMac = await computeMAC(
      concatBytes(encrypted.ciphertext, encrypted.nonce),
      sessionKeys.chainKey
    );
    
    if (!constantTimeEqual(encrypted.mac, expectedMac)) {
      return {
        success: false,
        error: 'Message integrity verification failed'
      };
    }
    
    // Perform key exchange with ephemeral key
    const sharedSecret = performKeyExchange(
      recipientIdentity.identityKeyPair.secretKey,
      encrypted.ephemeralPublicKey
    );
    
    if (!sharedSecret.success || !sharedSecret.data) {
      return {
        success: false,
        error: sharedSecret.error ?? 'Key exchange failed'
      };
    }
    
    // Derive message-specific keys
    const messageKeys = await deriveSessionKeys(
      sharedSecret.data,
      encrypted.ephemeralPublicKey,
      recipientIdentity.identityKeyPair.publicKey
    );
    
    // Create associated data for verification
    const associatedData = createAssociatedData(
      encrypted.ephemeralPublicKey,
      recipientIdentity.identityKeyPair.publicKey,
      sessionKeys.messageNumber
    );
    
    // Decrypt with AES-256-GCM + 16-bit security layer
    // Note: Use sendKey since we derive with same params as sender (ephemeral, recipient)
    const decrypted = await aesDecryptWithSecurityLayer(
      encrypted.ciphertext,
      encrypted.nonce,
      encrypted.tag,
      messageKeys.sendKey,
      encrypted.securitySalt,
      associatedData
    );
    
    // Clean up sensitive data
    secureWipe(sharedSecret.data);
    secureWipe(messageKeys.sendKey.key);
    secureWipe(messageKeys.receiveKey.key);
    secureWipe(messageKeys.chainKey);
    
    if (!decrypted.success || !decrypted.data) {
      return {
        success: false,
        error: decrypted.error ?? 'Decryption failed'
      };
    }
    
    // Parse message payload
    const parsed = parseMessagePayload(decrypted.data);
    
    return {
      success: true,
      data: parsed
    };
  } catch (error) {
    return {
      success: false,
      error: `Message decryption failed: ${error instanceof Error ? error.message : 'Unknown error'}`
    };
  }
}

/**
 * Serialize encrypted message for transport
 */
export function serializeEncryptedMessage(message: EncryptedMessage): SerializedEncryptedMessage {
  return {
    ciphertext: bytesToBase64(message.ciphertext),
    nonce: bytesToBase64(message.nonce),
    tag: bytesToBase64(message.tag),
    mac: bytesToBase64(message.mac),
    ephemeralPublicKey: bytesToBase64(message.ephemeralPublicKey),
    securitySalt: bytesToBase64(message.securitySalt),
    version: message.version
  };
}

/**
 * Deserialize encrypted message from transport
 */
export function deserializeEncryptedMessage(serialized: SerializedEncryptedMessage): EncryptedMessage {
  return {
    ciphertext: base64ToBytes(serialized.ciphertext),
    nonce: base64ToBytes(serialized.nonce),
    tag: base64ToBytes(serialized.tag),
    mac: base64ToBytes(serialized.mac),
    ephemeralPublicKey: base64ToBytes(serialized.ephemeralPublicKey),
    securitySalt: base64ToBytes(serialized.securitySalt),
    version: serialized.version
  };
}

/**
 * Create message integrity data
 */
export async function createMessageIntegrity(
  message: Bytes,
  signingKey: Bytes,
  sequenceNumber: number
): Promise<MessageIntegrity> {
  const timestamp = Date.now();
  const dataToSign = concatBytes(
    message,
    new Uint8Array(new BigUint64Array([BigInt(timestamp)]).buffer),
    new Uint8Array(new Uint32Array([sequenceNumber]).buffer)
  );
  
  const hash = await computeHash(dataToSign);
  const signResult = sign(hash, signingKey);
  
  if (!signResult.success || !signResult.data) {
    throw new Error('Failed to sign message');
  }
  
  return {
    hash,
    signature: signResult.data,
    timestamp,
    sequenceNumber
  };
}

/**
 * Verify message integrity
 */
export async function verifyMessageIntegrity(
  message: Bytes,
  integrity: MessageIntegrity,
  verifyKey: Bytes
): Promise<boolean> {
  const dataToVerify = concatBytes(
    message,
    new Uint8Array(new BigUint64Array([BigInt(integrity.timestamp)]).buffer),
    new Uint8Array(new Uint32Array([integrity.sequenceNumber]).buffer)
  );
  
  const hash = await computeHash(dataToVerify);
  
  if (!constantTimeEqual(hash, integrity.hash)) {
    return false;
  }
  
  return verify(hash, integrity.signature, verifyKey);
}

/**
 * Decrypted message result
 */
export interface DecryptedMessage {
  content: string;
  timestamp: number;
  messageNumber: number;
}

// ============ Helper Functions ============

function createMessagePayload(content: string, messageNumber: number): Bytes {
  const timestamp = Date.now();
  const contentBytes = stringToBytes(content);
  
  const header = new Uint8Array(16);
  const view = new DataView(header.buffer);
  view.setBigUint64(0, BigInt(timestamp), false);
  view.setUint32(8, messageNumber, false);
  view.setUint32(12, contentBytes.length, false);
  
  return concatBytes(header, contentBytes);
}

function parseMessagePayload(payload: Bytes): DecryptedMessage {
  const view = new DataView(payload.buffer, payload.byteOffset, payload.byteLength);
  const timestamp = Number(view.getBigUint64(0, false));
  const messageNumber = view.getUint32(8, false);
  const contentLength = view.getUint32(12, false);
  
  const contentBytes = payload.slice(16, 16 + contentLength);
  const content = bytesToString(contentBytes);
  
  return {
    content,
    timestamp,
    messageNumber
  };
}

function createAssociatedData(
  senderKey: Bytes,
  recipientKey: Bytes,
  messageNumber: number
): Bytes {
  const header = new Uint8Array(4);
  new DataView(header.buffer).setUint32(0, messageNumber, false);
  return concatBytes(senderKey, recipientKey, header);
}

async function computeMAC(data: Bytes, key: Bytes): Promise<Bytes> {
  if (typeof crypto !== 'undefined' && crypto.subtle) {
    const cryptoKey = await crypto.subtle.importKey(
      'raw',
      key,
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );
    const mac = await crypto.subtle.sign('HMAC', cryptoKey, data);
    return new Uint8Array(mac);
  }
  
  // Node.js fallback
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const nodeCrypto = require('crypto');
  const hmac = nodeCrypto.createHmac('sha256', key);
  hmac.update(data);
  return new Uint8Array(hmac.digest());
}

async function computeHash(data: Bytes): Promise<Bytes> {
  if (typeof crypto !== 'undefined' && crypto.subtle) {
    const hash = await crypto.subtle.digest('SHA-256', data);
    return new Uint8Array(hash);
  }
  
  // Node.js fallback
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const nodeCrypto = require('crypto');
  return new Uint8Array(nodeCrypto.createHash('sha256').update(data).digest());
}

async function computeTag(ciphertext: Bytes, key: Bytes): Promise<Bytes> {
  // In AES-GCM, the tag is computed during encryption
  // For verification, we compute an HMAC-based tag
  return computeMAC(ciphertext, key);
}

/**
 * Create an ephemeral "burn after reading" message
 */
export async function createBurnMessage(
  content: string,
  sessionKeys: SessionKeys,
  senderIdentity: DisposableIdentity,
  recipientPublicKey: Bytes
): Promise<CryptoResult<EncryptedMessage & { burnToken: Bytes }>> {
  const burnToken = randomBytes(32);
  const burnableContent = JSON.stringify({
    content,
    burnToken: bytesToBase64(burnToken),
    burnAfterRead: true
  });
  
  const result = await encryptMessage(
    burnableContent,
    sessionKeys,
    senderIdentity,
    recipientPublicKey
  );
  
  if (!result.success || !result.data) {
    return result as CryptoResult<EncryptedMessage & { burnToken: Bytes }>;
  }
  
  return {
    success: true,
    data: {
      ...result.data,
      burnToken
    }
  };
}
