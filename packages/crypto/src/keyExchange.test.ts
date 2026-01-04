/**
 * Phantom Messenger - Key Exchange Tests
 */

import { describe, it, expect } from 'vitest';
import {
    generateKeyPair,
    generateKeyPairFromSeed,
    generateSigningKeyPair,
    generateSigningKeyPairFromSeed,
    performKeyExchange,
    sign,
    verify,
    hkdf,
    deriveSessionKeys,
    bytesToHex,
    randomBytes
} from './index';

describe('Key Exchange & Signing', () => {
    describe('X25519 Key Pairs', () => {
        it('should generate valid key pair', () => {
            const kp = generateKeyPair();
            expect(kp.publicKey.length).toBe(32);
            expect(kp.secretKey.length).toBe(32);
        });

        it('should generate unique keys each time', () => {
            const kp1 = generateKeyPair();
            const kp2 = generateKeyPair();
            expect(kp1.publicKey).not.toEqual(kp2.publicKey);
            expect(kp1.secretKey).not.toEqual(kp2.secretKey);
        });

        it('should generate deterministic keys from seed', () => {
            const seed = randomBytes(32);
            const kp1 = generateKeyPairFromSeed(seed);
            const kp2 = generateKeyPairFromSeed(seed);
            expect(kp1.publicKey).toEqual(kp2.publicKey);
            expect(kp1.secretKey).toEqual(kp2.secretKey);
        });

        it('should generate different keys from different seeds', () => {
            const kp1 = generateKeyPairFromSeed(randomBytes(32));
            const kp2 = generateKeyPairFromSeed(randomBytes(32));
            expect(kp1.publicKey).not.toEqual(kp2.publicKey);
        });
    });

    describe('Ed25519 Signing Key Pairs', () => {
        it('should generate valid signing key pair', () => {
            const kp = generateSigningKeyPair();
            expect(kp.publicKey.length).toBe(32);
            expect(kp.secretKey.length).toBe(64);
        });

        it('should generate deterministic signing keys from seed', () => {
            const seed = randomBytes(32);
            const kp1 = generateSigningKeyPairFromSeed(seed);
            const kp2 = generateSigningKeyPairFromSeed(seed);
            expect(kp1.publicKey).toEqual(kp2.publicKey);
            expect(kp1.secretKey).toEqual(kp2.secretKey);
        });
    });

    describe('X25519 Key Exchange', () => {
        it('should produce matching shared secrets', () => {
            const alice = generateKeyPair();
            const bob = generateKeyPair();

            const aliceShared = performKeyExchange(alice.secretKey, bob.publicKey);
            const bobShared = performKeyExchange(bob.secretKey, alice.publicKey);

            expect(aliceShared.success).toBe(true);
            expect(bobShared.success).toBe(true);
            expect(bytesToHex(aliceShared.data!)).toBe(bytesToHex(bobShared.data!));
        });

        it('should produce 32-byte shared secret', () => {
            const alice = generateKeyPair();
            const bob = generateKeyPair();

            const shared = performKeyExchange(alice.secretKey, bob.publicKey);
            expect(shared.data?.length).toBe(32);
        });

        it('should produce different secrets with different partners', () => {
            const alice = generateKeyPair();
            const bob = generateKeyPair();
            const charlie = generateKeyPair();

            const sharedAB = performKeyExchange(alice.secretKey, bob.publicKey);
            const sharedAC = performKeyExchange(alice.secretKey, charlie.publicKey);

            expect(sharedAB.data).not.toEqual(sharedAC.data);
        });
    });

    describe('Ed25519 Signing', () => {
        it('should sign and verify message', () => {
            const kp = generateSigningKeyPair();
            const message = randomBytes(64);

            const signResult = sign(message, kp.secretKey);
            expect(signResult.success).toBe(true);
            expect(signResult.data?.length).toBe(64);

            // verify returns boolean directly
            const isValid = verify(message, signResult.data!, kp.publicKey);
            expect(isValid).toBe(true);
        });

        it('should fail verification with wrong key', () => {
            const kp1 = generateSigningKeyPair();
            const kp2 = generateSigningKeyPair();
            const message = randomBytes(64);

            const signResult = sign(message, kp1.secretKey);
            const isValid = verify(message, signResult.data!, kp2.publicKey);
            expect(isValid).toBe(false);
        });

        it('should fail verification with tampered message', () => {
            const kp = generateSigningKeyPair();
            const message = randomBytes(64);

            const signResult = sign(message, kp.secretKey);

            // Tamper with message
            const tampered = new Uint8Array(message);
            tampered[0] ^= 0xFF;

            const isValid = verify(tampered, signResult.data!, kp.publicKey);
            expect(isValid).toBe(false);
        });

        it('should fail verification with tampered signature', () => {
            const kp = generateSigningKeyPair();
            const message = randomBytes(64);

            const signResult = sign(message, kp.secretKey);
            expect(signResult.success).toBe(true);

            // Tamper with signature
            const tamperedSig = new Uint8Array(signResult.data!);
            tamperedSig[0] ^= 0xFF;

            const isValid = verify(message, tamperedSig, kp.publicKey);
            expect(isValid).toBe(false);
        });
    });

    describe('HKDF Key Derivation', () => {
        it('should derive key of specified length', async () => {
            const inputKey = randomBytes(32);
            const salt = randomBytes(32);
            const info = randomBytes(16);

            const derived = await hkdf(inputKey, salt, info, 64);
            expect(derived.length).toBe(64);
        });

        it('should be deterministic', async () => {
            const inputKey = randomBytes(32);
            const salt = randomBytes(32);
            const info = randomBytes(16);

            const derived1 = await hkdf(inputKey, salt, info, 32);
            const derived2 = await hkdf(inputKey, salt, info, 32);
            expect(derived1).toEqual(derived2);
        });

        it('should produce different output for different inputs', async () => {
            const inputKey = randomBytes(32);
            const salt = randomBytes(32);
            const info = randomBytes(16);

            const derived1 = await hkdf(inputKey, salt, info, 32);
            const derived2 = await hkdf(randomBytes(32), salt, info, 32);
            expect(derived1).not.toEqual(derived2);
        });
    });

    describe('Session Key Derivation', () => {
        it('should derive symmetric session keys', async () => {
            const sharedSecret = randomBytes(32);
            const initiatorPub = randomBytes(32);
            const responderPub = randomBytes(32);

            const sessionKeys = await deriveSessionKeys(sharedSecret, initiatorPub, responderPub);

            expect(sessionKeys.sendKey.key.length).toBe(32);
            expect(sessionKeys.receiveKey.key.length).toBe(32);
            expect(sessionKeys.chainKey.length).toBe(32);
        });

        it('should produce matching send/receive keys for both parties', async () => {
            const alice = generateKeyPair();
            const bob = generateKeyPair();

            const sharedA = performKeyExchange(alice.secretKey, bob.publicKey);
            const sharedB = performKeyExchange(bob.secretKey, alice.publicKey);

            const aliceKeys = await deriveSessionKeys(sharedA.data!, alice.publicKey, bob.publicKey);
            const bobKeys = await deriveSessionKeys(sharedB.data!, bob.publicKey, alice.publicKey);

            // Alice's send = Bob's receive
            expect(aliceKeys.sendKey.key).toEqual(bobKeys.receiveKey.key);
            // Alice's receive = Bob's send
            expect(aliceKeys.receiveKey.key).toEqual(bobKeys.sendKey.key);
        });
    });
});
