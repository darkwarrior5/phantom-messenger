/**
 * Phantom Messenger - AES Encryption Tests
 */

import { describe, it, expect } from 'vitest';
import {
    generateAESKey,
    importAESKey,
    aesEncrypt,
    aesDecrypt,
    aesEncryptWithSecurityLayer,
    aesDecryptWithSecurityLayer,
    generateSecuritySalt,
    stringToBytes,
    bytesToString,
    randomBytes
} from './index';

describe('AES-256-GCM Encryption', () => {
    describe('Key Generation', () => {
        it('should generate a 256-bit key', () => {
            const key = generateAESKey();
            expect(key.key.length).toBe(32); // 256 bits = 32 bytes
            expect(key.algorithm).toBe('AES-256-GCM');
        });

        it('should generate unique keys each time', () => {
            const key1 = generateAESKey();
            const key2 = generateAESKey();
            expect(key1.key).not.toEqual(key2.key);
        });
    });

    describe('Key Import', () => {
        it('should import valid 32-byte key', () => {
            const rawKey = randomBytes(32);
            const result = importAESKey(rawKey);
            expect(result.success).toBe(true);
            expect(result.data?.key).toEqual(rawKey);
        });

        it('should reject invalid key sizes', () => {
            const shortKey = randomBytes(16);
            const result = importAESKey(shortKey);
            expect(result.success).toBe(false);
            expect(result.error).toContain('32 bytes');
        });
    });

    describe('Encrypt/Decrypt', () => {
        it('should encrypt and decrypt text correctly', async () => {
            const key = generateAESKey();
            const plaintext = stringToBytes('Hello, World! 🔐');

            const encResult = await aesEncrypt(plaintext, key);
            expect(encResult.success).toBe(true);
            expect(encResult.data).toBeDefined();

            const { ciphertext, nonce, tag } = encResult.data!;
            expect(ciphertext.length).toBeGreaterThan(0);
            expect(nonce.length).toBe(12); // GCM nonce
            expect(tag.length).toBe(16); // GCM tag

            const decResult = await aesDecrypt(ciphertext, nonce, tag, key);
            expect(decResult.success).toBe(true);
            expect(bytesToString(decResult.data!)).toBe('Hello, World! 🔐');
        });

        it('should produce different ciphertext for same plaintext (random nonce)', async () => {
            const key = generateAESKey();
            const plaintext = stringToBytes('Same message');

            const enc1 = await aesEncrypt(plaintext, key);
            const enc2 = await aesEncrypt(plaintext, key);

            expect(enc1.data!.ciphertext).not.toEqual(enc2.data!.ciphertext);
            expect(enc1.data!.nonce).not.toEqual(enc2.data!.nonce);
        });

        it('should fail decryption with wrong key', async () => {
            const key1 = generateAESKey();
            const key2 = generateAESKey();
            const plaintext = stringToBytes('Secret message');

            const encResult = await aesEncrypt(plaintext, key1);
            const { ciphertext, nonce, tag } = encResult.data!;

            const decResult = await aesDecrypt(ciphertext, nonce, tag, key2);
            expect(decResult.success).toBe(false);
        });

        it('should fail decryption with tampered ciphertext', async () => {
            const key = generateAESKey();
            const plaintext = stringToBytes('Authentic message');

            const encResult = await aesEncrypt(plaintext, key);
            const { ciphertext, nonce, tag } = encResult.data!;

            // Tamper with ciphertext
            const tampered = new Uint8Array(ciphertext);
            tampered[0] ^= 0xFF;

            const decResult = await aesDecrypt(tampered, nonce, tag, key);
            expect(decResult.success).toBe(false);
        });

        it('should fail decryption with tampered tag', async () => {
            const key = generateAESKey();
            const plaintext = stringToBytes('Authentic message');

            const encResult = await aesEncrypt(plaintext, key);
            const { ciphertext, nonce, tag } = encResult.data!;

            // Tamper with tag
            const tamperedTag = new Uint8Array(tag);
            tamperedTag[0] ^= 0xFF;

            const decResult = await aesDecrypt(ciphertext, nonce, tamperedTag, key);
            expect(decResult.success).toBe(false);
        });
    });

    describe('Associated Data (AAD)', () => {
        it('should authenticate with associated data', async () => {
            const key = generateAESKey();
            const plaintext = stringToBytes('Protected message');
            const aad = stringToBytes('metadata-header');

            const encResult = await aesEncrypt(plaintext, key, aad);
            expect(encResult.success).toBe(true);

            const { ciphertext, nonce, tag } = encResult.data!;
            const decResult = await aesDecrypt(ciphertext, nonce, tag, key, aad);
            expect(decResult.success).toBe(true);
            expect(bytesToString(decResult.data!)).toBe('Protected message');
        });

        it('should fail with wrong associated data', async () => {
            const key = generateAESKey();
            const plaintext = stringToBytes('Protected message');
            const aad = stringToBytes('correct-header');
            const wrongAad = stringToBytes('wrong-header');

            const encResult = await aesEncrypt(plaintext, key, aad);
            const { ciphertext, nonce, tag } = encResult.data!;

            const decResult = await aesDecrypt(ciphertext, nonce, tag, key, wrongAad);
            expect(decResult.success).toBe(false);
        });
    });

    describe('Security Layer', () => {
        it('should generate 16-byte security salt', () => {
            const salt = generateSecuritySalt();
            expect(salt.length).toBe(16);
        });

        it('should encrypt/decrypt with security layer', async () => {
            const key = generateAESKey();
            const plaintext = stringToBytes('Extra secure message');
            const salt = generateSecuritySalt();

            const encResult = await aesEncryptWithSecurityLayer(plaintext, key, salt);
            expect(encResult.success).toBe(true);

            const { ciphertext, nonce, tag, securitySalt } = encResult.data!;
            const decResult = await aesDecryptWithSecurityLayer(
                ciphertext, nonce, tag, key, securitySalt
            );
            expect(decResult.success).toBe(true);
            expect(bytesToString(decResult.data!)).toBe('Extra secure message');
        });

        it('should fail with wrong security salt', async () => {
            const key = generateAESKey();
            const plaintext = stringToBytes('Secure message');
            const salt = generateSecuritySalt();

            const encResult = await aesEncryptWithSecurityLayer(plaintext, key, salt);
            const { ciphertext, nonce, tag } = encResult.data!;

            const wrongSalt = generateSecuritySalt();
            const decResult = await aesDecryptWithSecurityLayer(
                ciphertext, nonce, tag, key, wrongSalt
            );
            expect(decResult.success).toBe(false);
        });
    });

    describe('Edge Cases', () => {
        it('should handle empty plaintext', async () => {
            const key = generateAESKey();
            const plaintext = new Uint8Array(0);

            const encResult = await aesEncrypt(plaintext, key);
            expect(encResult.success).toBe(true);

            const { ciphertext, nonce, tag } = encResult.data!;
            const decResult = await aesDecrypt(ciphertext, nonce, tag, key);
            expect(decResult.success).toBe(true);
            expect(decResult.data!.length).toBe(0);
        });

        it('should handle large plaintext (10KB)', async () => {
            const key = generateAESKey();
            const plaintext = randomBytes(10 * 1024); // 10KB

            const encResult = await aesEncrypt(plaintext, key);
            expect(encResult.success).toBe(true);

            const { ciphertext, nonce, tag } = encResult.data!;
            const decResult = await aesDecrypt(ciphertext, nonce, tag, key);
            expect(decResult.success).toBe(true);
            expect(decResult.data!).toEqual(plaintext);
        });
    });
});
