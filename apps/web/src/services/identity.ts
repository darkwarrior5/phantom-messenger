/**
 * Phantom Messenger - Identity Service
 * 
 * Manages deterministic identities derived from credentials
 * Same username + password = same identity on any device
 */

import {
  generateDisposableIdentity,
  generateIdentityFromCredentials,
  destroyIdentity,
  exportIdentity,
  importIdentity,
  getDisplayIdentifier,
  verifyIdentityIntegrity,
  type DisposableIdentity
} from '@phantom/crypto';
import { useIdentityStore, useConversationsStore, useMessagesStore } from '../store';
import { STORAGE_KEYS } from '@phantom/shared';

class IdentityService {
  private currentUsername: string | null = null;
  private derivedKey: CryptoKey | null = null;

  /**
   * Initialize identity from credentials
   * Uses deterministic key generation: same credentials = same identity
   */
  async initialize(username?: string, password?: string): Promise<DisposableIdentity> {
    // Credentials required for deterministic identity
    if (!username || !password) {
      throw new Error('Username and password required');
    }

    this.currentUsername = username;
    
    // Generate deterministic identity from credentials
    // This will produce the same identity on any device with the same credentials
    const identity = await generateIdentityFromCredentials(username, password);
    
    // Also derive storage encryption key
    this.derivedKey = await this.deriveKeyFromCredentials(username, password);
    
    // Set in store
    useIdentityStore.getState().setIdentity(identity);
    
    // Save to storage (encrypted with derived key)
    await this.saveIdentity(identity);
    
    return identity;
  }

  /**
   * Derive encryption key from username and password
   */
  private async deriveKeyFromCredentials(username: string, password: string): Promise<CryptoKey> {
    const encoder = new TextEncoder();
    const salt = encoder.encode(`phantom-messenger-${username}`);
    
    // Import password as key material
    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      encoder.encode(password),
      { name: 'PBKDF2' },
      false,
      ['deriveBits', 'deriveKey']
    );
    
    // Derive AES key using PBKDF2
    return crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt,
        iterations: 100000,
        hash: 'SHA-256'
      },
      keyMaterial,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt', 'decrypt']
    );
  }

  /**
   * Get storage key for a username
   */
  private getStorageKey(username: string): string {
    return `${STORAGE_KEYS.IDENTITY}_${btoa(username)}`;
  }

  /**
   * Create a new disposable identity (only used for anonymous mode)
   * For credential-based identity, use initialize()
   */
  createNew(): DisposableIdentity {
    const identity = generateDisposableIdentity();
    useIdentityStore.getState().setIdentity(identity);
    
    // Save to storage (encrypted if we have a key)
    this.saveIdentity(identity);
    
    return identity;
  }

  /**
   * Get current identity
   */
  getCurrent(): DisposableIdentity | null {
    return useIdentityStore.getState().identity;
  }

  /**
   * Alias for getCurrent
   */
  getCurrentIdentity(): DisposableIdentity | null {
    return this.getCurrent();
  }

  /**
   * Load identity from storage
   */
  loadIdentity(): DisposableIdentity | null {
    const stored = localStorage.getItem(STORAGE_KEYS.IDENTITY);
    
    if (stored) {
      try {
        const decrypted = atob(stored); // simplified
        const result = importIdentity(decrypted);
        
        if (result.success && result.data && verifyIdentityIntegrity(result.data)) {
          return result.data;
        }
      } catch (error) {
        console.error('[Identity] Failed to load stored identity');
      }
    }

    return null;
  }

  /**
   * Get display ID for current identity
   */
  getDisplayId(): string {
    const identity = this.getCurrent();
    return identity ? getDisplayIdentifier(identity) : 'Unknown';
  }

  /**
   * Permanently destroy the current identity
   * Alias for destroyCurrentIdentity
   */
  destroyIdentity(): void {
    this.destroyCurrentIdentity();
  }

  /**
   * Permanently destroy the current identity
   * THIS IS IRREVERSIBLE
   */
  async destroyCurrentIdentity(): Promise<void> {
    const identity = useIdentityStore.getState().identity;
    
    if (!identity) return;

    // Destroy cryptographic material
    destroyIdentity(identity);

    // Clear all stored data
    localStorage.removeItem(STORAGE_KEYS.IDENTITY);
    localStorage.removeItem(STORAGE_KEYS.CONVERSATIONS);
    localStorage.removeItem(STORAGE_KEYS.SESSION);
    localStorage.removeItem(STORAGE_KEYS.PENDING_MESSAGES);

    // Clear stores
    useIdentityStore.getState().clearIdentity();
    useConversationsStore.getState().clearAll();
    useMessagesStore.getState().clearAll();

    console.log('[Identity] Identity permanently destroyed');
  }

  /**
   * Save identity to encrypted storage
   */
  private async saveIdentity(identity: DisposableIdentity): Promise<void> {
    const result = exportIdentity(identity);
    
    if (!result.success || !result.data) {
      throw new Error('Failed to export identity');
    }

    const encrypted = await this.encryptIdentityData(result.data);
    const storageKey = this.currentUsername 
      ? this.getStorageKey(this.currentUsername)
      : STORAGE_KEYS.IDENTITY;
    localStorage.setItem(storageKey, encrypted);
  }

  /**
   * Encrypt identity data for storage using derived key
   */
  private async encryptIdentityData(data: string): Promise<string> {
    if (this.derivedKey) {
      const encoder = new TextEncoder();
      const iv = crypto.getRandomValues(new Uint8Array(12));
      
      const encrypted = await crypto.subtle.encrypt(
        { name: 'AES-GCM', iv },
        this.derivedKey,
        encoder.encode(data)
      );
      
      // Combine IV + ciphertext
      const combined = new Uint8Array(iv.length + encrypted.byteLength);
      combined.set(iv);
      combined.set(new Uint8Array(encrypted), iv.length);
      
      return btoa(String.fromCharCode(...combined));
    }
    
    // Fallback - base64 only (not secure, for development)
    return btoa(data);
  }

  /**
   * Decrypt identity data from storage using derived key
   */
  private async decryptIdentityData(encrypted: string): Promise<string> {
    if (this.derivedKey) {
      const combined = new Uint8Array(
        atob(encrypted).split('').map(c => c.charCodeAt(0))
      );
      
      const iv = combined.slice(0, 12);
      const ciphertext = combined.slice(12);
      
      const decrypted = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv },
        this.derivedKey,
        ciphertext
      );
      
      return new TextDecoder().decode(decrypted);
    }
    
    // Fallback - base64 only
    return atob(encrypted);
  }

  /**
   * Verify identity is still valid
   */
  verify(): boolean {
    const identity = this.getCurrent();
    return identity ? verifyIdentityIntegrity(identity) : false;
  }
}

export const identityService = new IdentityService();
