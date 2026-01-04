/**
 * Phantom Messenger - Identity Tests
 */

import { describe, it, expect } from 'vitest';
import {
    generateDisposableIdentity,
    generateIdentityFromCredentials,
    destroyIdentity,
    getPublicIdentityBundle,
    consumeOneTimePreKey,
    replenishOneTimePreKeys,
    rotateSignedPreKey,
    exportIdentity,
    importIdentity,
    getDisplayIdentifier,
    verifyIdentityIntegrity,
    bytesToBase64
} from './index';

describe('Identity Management', () => {
    describe('Disposable Identity Generation', () => {
        it('should generate a valid identity', () => {
            const identity = generateDisposableIdentity();

            expect(identity.id.length).toBe(32);
            expect(identity.identityKeyPair.publicKey.length).toBe(32);
            expect(identity.identityKeyPair.secretKey.length).toBe(32);
            expect(identity.signingKeyPair.publicKey.length).toBe(32);
            expect(identity.signingKeyPair.secretKey.length).toBe(64);
            expect(identity.isActive).toBe(true);
        });

        it('should generate unique identities each time', () => {
            const id1 = generateDisposableIdentity();
            const id2 = generateDisposableIdentity();

            expect(id1.id).not.toEqual(id2.id);
            expect(id1.identityKeyPair.publicKey).not.toEqual(id2.identityKeyPair.publicKey);
        });

        it('should generate pre-keys', () => {
            const identity = generateDisposableIdentity();

            // Default pre-key count is 10
            expect(identity.preKeys.length).toBe(10);
            expect(identity.preKeys[0]).toBeDefined();
        });
    });

    describe('Credential-based Identity', () => {
        it('should generate deterministic identity from credentials', async () => {
            const id1 = await generateIdentityFromCredentials('testuser', 'password123');
            const id2 = await generateIdentityFromCredentials('testuser', 'password123');

            expect(bytesToBase64(id1.id)).toBe(bytesToBase64(id2.id));
            expect(bytesToBase64(id1.identityKeyPair.publicKey))
                .toBe(bytesToBase64(id2.identityKeyPair.publicKey));
        });

        it('should generate different identity for different credentials', async () => {
            const id1 = await generateIdentityFromCredentials('user1', 'password');
            const id2 = await generateIdentityFromCredentials('user2', 'password');

            expect(bytesToBase64(id1.id)).not.toBe(bytesToBase64(id2.id));
        });

        it('should generate different identity for different passwords', async () => {
            const id1 = await generateIdentityFromCredentials('user', 'password1');
            const id2 = await generateIdentityFromCredentials('user', 'password2');

            expect(bytesToBase64(id1.id)).not.toBe(bytesToBase64(id2.id));
        });
    });

    describe('Identity Destruction', () => {
        it('should deactivate identity', () => {
            const identity = generateDisposableIdentity();
            expect(identity.isActive).toBe(true);

            destroyIdentity(identity);
            expect(identity.isActive).toBe(false);
        });

        it('should wipe key material', () => {
            const identity = generateDisposableIdentity();
            const originalPubKey = new Uint8Array(identity.identityKeyPair.publicKey);

            destroyIdentity(identity);

            // Keys should be zeroed
            expect(identity.identityKeyPair.publicKey.every(b => b === 0)).toBe(true);
            expect(identity.identityKeyPair.secretKey.every(b => b === 0)).toBe(true);
        });
    });

    describe('Public Identity Bundle', () => {
        it('should extract public information only', () => {
            const identity = generateDisposableIdentity();
            const bundle = getPublicIdentityBundle(identity);

            expect(bundle.id).toBeDefined();
            expect(bundle.identityKey).toBeDefined();
            expect(bundle.signingKey).toBeDefined();
            expect(bundle.signedPreKey).toBeDefined();

            // Bundle should be serializable (base64 strings)
            expect(typeof bundle.id).toBe('string');
            expect(typeof bundle.identityKey).toBe('string');
        });
    });

    describe('Pre-Key Management', () => {
        it('should consume one-time pre-key', () => {
            const identity = generateDisposableIdentity();
            const initialCount = identity.oneTimePreKeys.length;

            const preKey = consumeOneTimePreKey(identity);
            expect(preKey).not.toBeNull();
            expect(identity.oneTimePreKeys.length).toBe(initialCount - 1);
        });

        it('should return null when no one-time pre-keys left', () => {
            const identity = generateDisposableIdentity();
            // Consume all one-time pre-keys
            while (identity.oneTimePreKeys.length > 0) {
                consumeOneTimePreKey(identity);
            }
            const preKey = consumeOneTimePreKey(identity);
            expect(preKey).toBeNull();
        });

        it('should replenish one-time pre-keys', () => {
            const identity = generateDisposableIdentity();
            const initialCount = identity.oneTimePreKeys.length;

            const newKeys = replenishOneTimePreKeys(identity, 5);
            expect(newKeys.length).toBe(5);
            expect(identity.oneTimePreKeys.length).toBe(initialCount + 5);
        });

        it('should rotate signed pre-key', () => {
            const identity = generateDisposableIdentity();
            const oldPreKeyCount = identity.preKeys.length;

            const newSignedPreKey = rotateSignedPreKey(identity);

            // Should return a valid pre-key
            expect(newSignedPreKey.id).toBeDefined();
        });
    });

    describe('Identity Export/Import', () => {
        it('should export and import identity', () => {
            const identity = generateDisposableIdentity();

            const exportResult = exportIdentity(identity);
            expect(exportResult.success).toBe(true);

            const importResult = importIdentity(exportResult.data!);
            expect(importResult.success).toBe(true);

            const imported = importResult.data!;
            expect(bytesToBase64(imported.id)).toBe(bytesToBase64(identity.id));
            expect(bytesToBase64(imported.identityKeyPair.publicKey))
                .toBe(bytesToBase64(identity.identityKeyPair.publicKey));
        });
    });

    describe('Utility Functions', () => {
        it('should generate display identifier', () => {
            const identity = generateDisposableIdentity();
            const displayId = getDisplayIdentifier(identity);

            expect(typeof displayId).toBe('string');
            expect(displayId.length).toBeGreaterThan(0);
        });

        it('should verify identity integrity', () => {
            const identity = generateDisposableIdentity();
            expect(verifyIdentityIntegrity(identity)).toBe(true);

            destroyIdentity(identity);
            expect(verifyIdentityIntegrity(identity)).toBe(false);
        });
    });
});
