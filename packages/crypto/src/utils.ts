/**
 * Phantom Messenger - Utility Functions
 * 
 * Encoding, decoding, and helper utilities
 */

import type { Bytes, Base64String, HexString } from './types.js';

/**
 * Convert Uint8Array to Base64 string
 */
export function bytesToBase64(bytes: Bytes): Base64String {
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(bytes).toString('base64');
  }
  // Browser environment
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]!);
  }
  return btoa(binary);
}

/**
 * Convert Base64 string to Uint8Array
 */
export function base64ToBytes(base64: Base64String): Bytes {
  if (typeof Buffer !== 'undefined') {
    return new Uint8Array(Buffer.from(base64, 'base64'));
  }
  // Browser environment
  const binary = atob(base64);
  const len = binary.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

/**
 * Convert Uint8Array to hex string
 */
export function bytesToHex(bytes: Bytes): HexString {
  return Array.from(bytes)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Convert hex string to Uint8Array
 */
export function hexToBytes(hex: HexString): Bytes {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hex.substr(i * 2, 2), 16);
  }
  return bytes;
}

/**
 * Convert string to Uint8Array (UTF-8)
 */
export function stringToBytes(str: string): Bytes {
  return new TextEncoder().encode(str);
}

/**
 * Convert Uint8Array to string (UTF-8)
 */
export function bytesToString(bytes: Bytes): string {
  return new TextDecoder().decode(bytes);
}

/**
 * Generate cryptographically secure random bytes
 */
export function randomBytes(length: number): Bytes {
  const bytes = new Uint8Array(length);
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(bytes);
  } else if (typeof require !== 'undefined') {
    // Node.js environment
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const nodeCrypto = require('crypto');
    const nodeBytes = nodeCrypto.randomBytes(length);
    bytes.set(nodeBytes);
  } else {
    throw new Error('No secure random number generator available');
  }
  return bytes;
}

/**
 * Constant-time comparison of two byte arrays
 * Prevents timing attacks
 */
export function constantTimeEqual(a: Bytes, b: Bytes): boolean {
  if (a.length !== b.length) {
    return false;
  }
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a[i]! ^ b[i]!;
  }
  return result === 0;
}

/**
 * Securely clear sensitive data from memory
 */
export function secureWipe(bytes: Bytes): void {
  // Overwrite with random data first
  const random = randomBytes(bytes.length);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = random[i]!;
  }
  // Then zero out
  bytes.fill(0);
}

/**
 * Concatenate multiple byte arrays
 */
export function concatBytes(...arrays: Bytes[]): Bytes {
  const totalLength = arrays.reduce((sum, arr) => sum + arr.length, 0);
  const result = new Uint8Array(totalLength);
  let offset = 0;
  for (const arr of arrays) {
    result.set(arr, offset);
    offset += arr.length;
  }
  return result;
}

/**
 * Split byte array at specified positions
 */
export function splitBytes(bytes: Bytes, ...positions: number[]): Bytes[] {
  const result: Bytes[] = [];
  let start = 0;
  for (const pos of positions) {
    result.push(bytes.slice(start, pos));
    start = pos;
  }
  result.push(bytes.slice(start));
  return result;
}

/**
 * Generate a unique timestamp-based nonce
 */
export function generateTimestampNonce(): Bytes {
  const timestamp = Date.now();
  const random = randomBytes(16);
  const nonce = new Uint8Array(24);
  
  // First 8 bytes: timestamp
  const view = new DataView(nonce.buffer);
  view.setBigUint64(0, BigInt(timestamp), false);
  
  // Remaining bytes: random
  nonce.set(random, 8);
  
  return nonce;
}

/**
 * Validate that bytes are non-zero
 */
export function isNonZero(bytes: Bytes): boolean {
  for (const byte of bytes) {
    if (byte !== 0) return true;
  }
  return false;
}

/**
 * Create a deterministic but unpredictable ID from components
 */
export async function createDeterministicId(...components: Bytes[]): Promise<Bytes> {
  const combined = concatBytes(...components);
  
  if (typeof crypto !== 'undefined' && crypto.subtle) {
    const hash = await crypto.subtle.digest('SHA-256', combined);
    return new Uint8Array(hash);
  }
  
  // Node.js fallback
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const nodeCrypto = require('crypto');
  return new Uint8Array(nodeCrypto.createHash('sha256').update(combined).digest());
}

/**
 * Format bytes for display (truncated)
 */
export function formatBytesForDisplay(bytes: Bytes, maxLength: number = 8): string {
  const hex = bytesToHex(bytes);
  if (hex.length <= maxLength * 2) {
    return hex;
  }
  return `${hex.slice(0, maxLength)}...${hex.slice(-maxLength)}`;
}
