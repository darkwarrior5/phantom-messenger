/**
 * Phantom Messenger - Secure Storage Service
 * 
 * Uses react-native-keychain for secure credential storage
 */

import * as Keychain from 'react-native-keychain';
import type { DisposableIdentity } from '@phantom/crypto';

const STORAGE_SERVICE = 'com.phantom.messenger';

export const secureStorage = {
  /**
   * Store identity securely in keychain
   */
  async saveIdentity(identity: DisposableIdentity): Promise<boolean> {
    try {
      // Convert Uint8Arrays to base64 for storage
      const serialized = {
        id: Buffer.from(identity.id).toString('base64'),
        identityKeyPair: {
          publicKey: Buffer.from(identity.identityKeyPair.publicKey).toString('base64'),
          secretKey: Buffer.from(identity.identityKeyPair.secretKey).toString('base64'),
        },
        signingKeyPair: {
          publicKey: Buffer.from(identity.signingKeyPair.publicKey).toString('base64'),
          secretKey: Buffer.from(identity.signingKeyPair.secretKey).toString('base64'),
        },
        preKeys: [],
        oneTimePreKeys: [],
        createdAt: identity.createdAt,
        isActive: identity.isActive,
      };

      await Keychain.setGenericPassword(
        'identity',
        JSON.stringify(serialized),
        {
          service: STORAGE_SERVICE,
          accessControl: Keychain.ACCESS_CONTROL.BIOMETRY_ANY_OR_DEVICE_PASSCODE,
          accessible: Keychain.ACCESSIBLE.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
        }
      );

      return true;
    } catch (error) {
      console.error('Failed to save identity:', error);
      return false;
    }
  },

  /**
   * Load identity from keychain
   */
  async loadIdentity(): Promise<DisposableIdentity | null> {
    try {
      const credentials = await Keychain.getGenericPassword({
        service: STORAGE_SERVICE,
      });

      if (!credentials) {
        return null;
      }

      const serialized = JSON.parse(credentials.password);

      return {
        id: new Uint8Array(Buffer.from(serialized.id, 'base64')),
        identityKeyPair: {
          publicKey: new Uint8Array(Buffer.from(serialized.identityKeyPair.publicKey, 'base64')),
          secretKey: new Uint8Array(Buffer.from(serialized.identityKeyPair.secretKey, 'base64')),
        },
        signingKeyPair: {
          publicKey: new Uint8Array(Buffer.from(serialized.signingKeyPair.publicKey, 'base64')),
          secretKey: new Uint8Array(Buffer.from(serialized.signingKeyPair.secretKey, 'base64')),
        },
        preKeys: serialized.preKeys || [],
        oneTimePreKeys: serialized.oneTimePreKeys || [],
        createdAt: serialized.createdAt,
        isActive: serialized.isActive ?? true,
      };
    } catch (error) {
      console.error('Failed to load identity:', error);
      return null;
    }
  },

  /**
   * Delete identity from keychain
   */
  async deleteIdentity(): Promise<boolean> {
    try {
      await Keychain.resetGenericPassword({ service: STORAGE_SERVICE });
      return true;
    } catch (error) {
      console.error('Failed to delete identity:', error);
      return false;
    }
  },

  /**
   * Clear all stored data
   */
  async clearAll(): Promise<boolean> {
    try {
      await Keychain.resetGenericPassword({ service: STORAGE_SERVICE });
      return true;
    } catch (error) {
      console.error('Failed to clear all data:', error);
      return false;
    }
  },

  /**
   * Check if biometric authentication is available
   */
  async isBiometricAvailable(): Promise<boolean> {
    try {
      const biometryType = await Keychain.getSupportedBiometryType();
      return biometryType !== null;
    } catch (error) {
      return false;
    }
  },
};
