
import { describe, it, expect } from 'vitest';
import {
    generateDisposableIdentity,
    destroyIdentity,
    performKeyExchange,
    deriveSessionKeys,
    encryptMessage,
    decryptMessage,
    serializeEncryptedMessage,
    deserializeEncryptedMessage,
    secureWipe,
    bytesToHex
} from './index';

describe('End-to-End Encryption Flow', () => {
    it('should complete the full E2E flow', async () => {
        // Step 1: Generate disposable identities for Alice and Bob
        const alice = await generateDisposableIdentity(10);
        const bob = await generateDisposableIdentity(10);

        expect(alice.preKeys.length).toBe(10);
        expect(bob.preKeys.length).toBe(10);

        // Step 2: Establish shared secret via direct key exchange
        const aliceSharedResult = performKeyExchange(
            alice.identityKeyPair.secretKey,
            bob.identityKeyPair.publicKey
        );

        const bobSharedResult = performKeyExchange(
            bob.identityKeyPair.secretKey,
            alice.identityKeyPair.publicKey
        );

        expect(aliceSharedResult.success).toBe(true);
        expect(bobSharedResult.success).toBe(true);

        const aliceShared = bytesToHex(aliceSharedResult.data!);
        const bobShared = bytesToHex(bobSharedResult.data!);

        expect(aliceShared).toBe(bobShared);

        // Step 3: Derive session keys
        const aliceSessionKeys = await deriveSessionKeys(
            aliceSharedResult.data!,
            alice.identityKeyPair.publicKey,
            bob.identityKeyPair.publicKey
        );

        const bobSessionKeys = await deriveSessionKeys(
            bobSharedResult.data!,
            bob.identityKeyPair.publicKey,
            alice.identityKeyPair.publicKey
        );

        expect(bytesToHex(aliceSessionKeys.sendKey.key)).toBe(bytesToHex(bobSessionKeys.receiveKey.key));

        // Step 4: Alice encrypts a message to Bob
        const originalMessage = 'Hello Bob! This is a secure message with E2E encryption. 🔒';

        const encryptedResult = await encryptMessage(
            originalMessage,
            aliceSessionKeys,
            alice,
            bob.identityKeyPair.publicKey
        );

        expect(encryptedResult.success).toBe(true);
        const encrypted = encryptedResult.data!;

        // Step 5: Serialize for transport
        const serialized = serializeEncryptedMessage(encrypted);

        // Step 6: Deserialize on recipient side
        const deserialized = deserializeEncryptedMessage(serialized);

        // Step 7: Bob decrypts the message
        const decryptedResult = await decryptMessage(
            deserialized,
            bobSessionKeys,
            bob,
            alice.identityKeyPair.publicKey
        );

        expect(decryptedResult.success).toBe(true);
        expect(decryptedResult.data!.content).toBe(originalMessage);

        // Step 9: Testing bidirectional messaging
        const replyMessage = 'Hi Alice! Got your secure message. Replying with E2E encryption! 🛡️';

        const replyEncrypted = await encryptMessage(
            replyMessage,
            bobSessionKeys,
            bob,
            alice.identityKeyPair.publicKey
        );

        expect(replyEncrypted.success).toBe(true);

        const replyDecrypted = await decryptMessage(
            replyEncrypted.data!,
            aliceSessionKeys,
            alice,
            bob.identityKeyPair.publicKey
        );

        expect(replyDecrypted.success).toBe(true);
        expect(replyDecrypted.data!.content).toBe(replyMessage);

        // Step 10: Destroy identities
        destroyIdentity(alice);
        destroyIdentity(bob);

        expect(alice.isActive).toBe(false);
        expect(bob.isActive).toBe(false);

        // Step 11: Verify destroyed identity can't encrypt
        const failedEncrypt = await encryptMessage(
            'This should fail',
            aliceSessionKeys,
            alice,
            bob.identityKeyPair.publicKey
        );

        expect(failedEncrypt.success).toBe(false);

        // Clean up
        secureWipe(aliceSessionKeys.chainKey);
        secureWipe(bobSessionKeys.chainKey);
        secureWipe(aliceSharedResult.data!);
        secureWipe(bobSharedResult.data!);
    });
});
