/**
 * Phantom Messenger - Secure Invitation System
 * 
 * Generate, validate, and revoke secure invitations
 */

import type {
  Bytes,
  SecureInvitation,
  CryptoResult,
  DisposableIdentity,
  Base64String
} from './types.js';
import { 
  aesEncrypt, 
  aesDecrypt, 
  generateAESKey 
} from './aes.js';
import { 
  sign, 
  verify, 
  hkdf 
} from './keyExchange.js';
import {
  randomBytes,
  bytesToBase64,
  base64ToBytes,
  stringToBytes,
  bytesToString,
  concatBytes,
  secureWipe
} from './utils.js';

/** Default invitation expiration (24 hours) */
const DEFAULT_EXPIRATION_MS = 24 * 60 * 60 * 1000;

/** Invitation code length */
const INVITATION_CODE_LENGTH = 16;

/**
 * Generate a secure invitation
 */
export async function generateInvitation(
  creator: DisposableIdentity,
  options: InvitationOptions = {}
): Promise<CryptoResult<GeneratedInvitation>> {
  try {
    if (!creator.isActive) {
      return {
        success: false,
        error: 'Cannot generate invitation with destroyed identity'
      };
    }
    
    const {
      expiresIn = DEFAULT_EXPIRATION_MS,
      singleUse = true,
      maxUses = 1,
      metadata = {}
    } = options;
    
    // Generate unique invitation ID
    const invitationId = randomBytes(32);
    
    // Generate invitation secret (used for derivation)
    const invitationSecret = randomBytes(32);
    
    // Calculate expiration
    const expiresAt = Date.now() + expiresIn;
    
    // Create invitation data
    const invitationData: InvitationData = {
      creatorId: bytesToBase64(creator.id),
      creatorPublicKey: bytesToBase64(creator.identityKeyPair.publicKey),
      creatorSigningKey: bytesToBase64(creator.signingKeyPair.publicKey),
      expiresAt,
      singleUse,
      maxUses,
      usesRemaining: maxUses,
      metadata,
      createdAt: Date.now()
    };
    
    // Derive encryption key from invitation secret
    const encryptionKey = await hkdf(
      invitationSecret,
      invitationId,
      stringToBytes('PhantomInvitation'),
      32
    );
    
    // Encrypt invitation data
    const plaintext = stringToBytes(JSON.stringify(invitationData));
    const encrypted = await aesEncrypt(
      plaintext,
      { key: encryptionKey, algorithm: 'AES-256-GCM' }
    );
    
    if (!encrypted.success || !encrypted.data) {
      return {
        success: false,
        error: 'Failed to encrypt invitation data'
      };
    }
    
    // Create signature over invitation
    const signatureData = concatBytes(
      invitationId,
      encrypted.data.ciphertext,
      new Uint8Array(new BigUint64Array([BigInt(expiresAt)]).buffer)
    );
    
    const signResult = sign(signatureData, creator.signingKeyPair.secretKey);
    
    if (!signResult.success || !signResult.data) {
      return {
        success: false,
        error: 'Failed to sign invitation'
      };
    }
    
    // Create the secure invitation
    const invitation: SecureInvitation = {
      id: invitationId,
      encryptedData: {
        ciphertext: encrypted.data.ciphertext,
        nonce: encrypted.data.nonce,
        tag: encrypted.data.tag,
        mac: encrypted.data.tag,
        ephemeralPublicKey: new Uint8Array(0), // Not needed for invitations
        securitySalt: new Uint8Array(0),
        version: 1
      },
      creatorPublicKey: creator.identityKeyPair.publicKey,
      signature: signResult.data,
      expiresAt,
      singleUse,
      isRevoked: false
    };
    
    // Generate human-readable invitation code
    const invitationCode = generateInvitationCode(invitationId, invitationSecret);
    
    // Clean up
    secureWipe(encryptionKey);
    
    return {
      success: true,
      data: {
        invitation,
        invitationCode,
        invitationSecret: bytesToBase64(invitationSecret)
      }
    };
  } catch (error) {
    return {
      success: false,
      error: `Invitation generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`
    };
  }
}

/**
 * Validate and decode an invitation
 */
export async function validateInvitation(
  invitationCode: string,
  creatorSigningKey: Bytes
): Promise<CryptoResult<InvitationData>> {
  try {
    // Parse invitation code
    const parsed = parseInvitationCode(invitationCode);
    if (!parsed) {
      return {
        success: false,
        error: 'Invalid invitation code format'
      };
    }
    
    const { invitationId, secret, encryptedData, signature, expiresAt } = parsed;
    
    // Check expiration
    if (Date.now() > expiresAt) {
      return {
        success: false,
        error: 'Invitation has expired'
      };
    }
    
    // Verify signature
    const signatureData = concatBytes(
      invitationId,
      encryptedData.ciphertext,
      new Uint8Array(new BigUint64Array([BigInt(expiresAt)]).buffer)
    );
    
    const isValidSignature = verify(signatureData, signature, creatorSigningKey);
    
    if (!isValidSignature) {
      return {
        success: false,
        error: 'Invalid invitation signature'
      };
    }
    
    // Derive decryption key
    const decryptionKey = await hkdf(
      secret,
      invitationId,
      stringToBytes('PhantomInvitation'),
      32
    );
    
    // Decrypt invitation data
    const decrypted = await aesDecrypt(
      encryptedData.ciphertext,
      encryptedData.nonce,
      encryptedData.tag,
      { key: decryptionKey, algorithm: 'AES-256-GCM' }
    );
    
    // Clean up
    secureWipe(decryptionKey);
    
    if (!decrypted.success || !decrypted.data) {
      return {
        success: false,
        error: 'Failed to decrypt invitation'
      };
    }
    
    const invitationData: InvitationData = JSON.parse(bytesToString(decrypted.data));
    
    // Validate invitation data
    if (invitationData.usesRemaining <= 0) {
      return {
        success: false,
        error: 'Invitation has been used'
      };
    }
    
    return {
      success: true,
      data: invitationData
    };
  } catch (error) {
    return {
      success: false,
      error: `Invitation validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`
    };
  }
}

/**
 * Revoke an invitation
 */
export function revokeInvitation(invitation: SecureInvitation): void {
  invitation.isRevoked = true;
}

/**
 * Check if invitation is valid
 */
export function isInvitationValid(invitation: SecureInvitation): boolean {
  if (invitation.isRevoked) return false;
  if (Date.now() > invitation.expiresAt) return false;
  return true;
}

/**
 * Generate human-readable invitation code
 */
function generateInvitationCode(invitationId: Bytes, secret: Bytes): string {
  // Combine ID and secret, encode as base64
  const combined = concatBytes(invitationId, secret);
  const encoded = bytesToBase64(combined);
  
  // Format as groups of 4 characters for readability
  const groups: string[] = [];
  for (let i = 0; i < encoded.length; i += 4) {
    groups.push(encoded.slice(i, i + 4));
  }
  
  return `PHM-${groups.slice(0, 8).join('-')}`;
}

/**
 * Parse invitation code
 */
function parseInvitationCode(code: string): ParsedInvitationCode | null {
  try {
    // Remove prefix and dashes
    const cleaned = code.replace(/^PHM-/, '').replace(/-/g, '');
    
    // Decode
    const combined = base64ToBytes(cleaned);
    
    if (combined.length < 64) {
      return null;
    }
    
    const invitationId = combined.slice(0, 32);
    const secret = combined.slice(32, 64);
    
    // Additional data if present
    let encryptedData = {
      ciphertext: new Uint8Array(0),
      nonce: new Uint8Array(0),
      tag: new Uint8Array(0)
    };
    let signature = new Uint8Array(0);
    let expiresAt = 0;
    
    if (combined.length > 64) {
      // Parse remaining data
      // This would be included in a full invitation package
    }
    
    return {
      invitationId,
      secret,
      encryptedData,
      signature,
      expiresAt
    };
  } catch {
    return null;
  }
}

/**
 * Invitation options
 */
export interface InvitationOptions {
  /** Expiration time in milliseconds */
  expiresIn?: number;
  /** Whether invitation can only be used once */
  singleUse?: boolean;
  /** Maximum number of uses */
  maxUses?: number;
  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Invitation data (decrypted)
 */
export interface InvitationData {
  creatorId: Base64String;
  creatorPublicKey: Base64String;
  creatorSigningKey: Base64String;
  expiresAt: number;
  singleUse: boolean;
  maxUses: number;
  usesRemaining: number;
  metadata: Record<string, unknown>;
  createdAt: number;
}

/**
 * Generated invitation result
 */
export interface GeneratedInvitation {
  invitation: SecureInvitation;
  invitationCode: string;
  invitationSecret: Base64String;
}

/**
 * Parsed invitation code
 */
interface ParsedInvitationCode {
  invitationId: Bytes;
  secret: Bytes;
  encryptedData: {
    ciphertext: Bytes;
    nonce: Bytes;
    tag: Bytes;
  };
  signature: Bytes;
  expiresAt: number;
}

/**
 * Serialize invitation for sharing
 */
export function serializeInvitation(invitation: SecureInvitation): string {
  return JSON.stringify({
    id: bytesToBase64(invitation.id),
    encryptedData: {
      ciphertext: bytesToBase64(invitation.encryptedData.ciphertext),
      nonce: bytesToBase64(invitation.encryptedData.nonce),
      mac: bytesToBase64(invitation.encryptedData.mac)
    },
    creatorPublicKey: bytesToBase64(invitation.creatorPublicKey),
    signature: bytesToBase64(invitation.signature),
    expiresAt: invitation.expiresAt,
    singleUse: invitation.singleUse
  });
}

/**
 * Deserialize invitation
 */
export function deserializeInvitation(serialized: string): SecureInvitation {
  const data = JSON.parse(serialized);
  return {
    id: base64ToBytes(data.id),
    encryptedData: {
      ciphertext: base64ToBytes(data.encryptedData.ciphertext),
      nonce: base64ToBytes(data.encryptedData.nonce),
      tag: base64ToBytes(data.encryptedData.mac),
      mac: base64ToBytes(data.encryptedData.mac),
      ephemeralPublicKey: new Uint8Array(0),
      securitySalt: new Uint8Array(0),
      version: 1
    },
    creatorPublicKey: base64ToBytes(data.creatorPublicKey),
    signature: base64ToBytes(data.signature),
    expiresAt: data.expiresAt,
    singleUse: data.singleUse,
    isRevoked: false
  };
}
