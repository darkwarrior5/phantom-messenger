/**
 * Phantom Messenger - Utility Function Tests
 */

import { describe, it, expect } from 'vitest';
import {
    bytesToBase64,
    base64ToBytes,
    bytesToHex,
    hexToBytes,
    stringToBytes,
    bytesToString,
    randomBytes,
    constantTimeEqual,
    secureWipe,
    concatBytes,
    splitBytes,
    isNonZero,
    createDeterministicId
} from './index';

describe('Utility Functions', () => {
    describe('Base64 Encoding', () => {
        it('should encode and decode bytes correctly', () => {
            const original = new Uint8Array([0, 1, 127, 128, 255]);
            const encoded = bytesToBase64(original);
            const decoded = base64ToBytes(encoded);
            expect(decoded).toEqual(original);
        });

        it('should handle empty array', () => {
            const empty = new Uint8Array(0);
            const encoded = bytesToBase64(empty);
            const decoded = base64ToBytes(encoded);
            expect(decoded.length).toBe(0);
        });

        it('should handle text round-trip', () => {
            const text = 'Hello, World! 🔐';
            const bytes = stringToBytes(text);
            const encoded = bytesToBase64(bytes);
            const decoded = base64ToBytes(encoded);
            expect(bytesToString(decoded)).toBe(text);
        });
    });

    describe('Hex Encoding', () => {
        it('should encode and decode bytes correctly', () => {
            const original = new Uint8Array([0, 15, 16, 255]);
            const encoded = bytesToHex(original);
            expect(encoded).toBe('000f10ff');
            const decoded = hexToBytes(encoded);
            expect(decoded).toEqual(original);
        });

        it('should handle uppercase hex', () => {
            const decoded = hexToBytes('ABCDEF');
            expect(bytesToHex(decoded)).toBe('abcdef');
        });

        it('should handle empty array', () => {
            const empty = new Uint8Array(0);
            expect(bytesToHex(empty)).toBe('');
            expect(hexToBytes('').length).toBe(0);
        });
    });

    describe('String Encoding', () => {
        it('should encode and decode ASCII', () => {
            const text = 'Hello World';
            const bytes = stringToBytes(text);
            expect(bytesToString(bytes)).toBe(text);
        });

        it('should encode and decode UTF-8', () => {
            const text = '你好世界 🌍 مرحبا';
            const bytes = stringToBytes(text);
            expect(bytesToString(bytes)).toBe(text);
        });

        it('should handle empty string', () => {
            expect(stringToBytes('').length).toBe(0);
            expect(bytesToString(new Uint8Array(0))).toBe('');
        });
    });

    describe('Random Bytes', () => {
        it('should generate correct length', () => {
            expect(randomBytes(16).length).toBe(16);
            expect(randomBytes(32).length).toBe(32);
            expect(randomBytes(64).length).toBe(64);
        });

        it('should generate different bytes each time', () => {
            const a = randomBytes(32);
            const b = randomBytes(32);
            expect(a).not.toEqual(b);
        });

        it('should handle zero length', () => {
            expect(randomBytes(0).length).toBe(0);
        });
    });

    describe('Constant Time Comparison', () => {
        it('should return true for equal arrays', () => {
            const a = new Uint8Array([1, 2, 3, 4]);
            const b = new Uint8Array([1, 2, 3, 4]);
            expect(constantTimeEqual(a, b)).toBe(true);
        });

        it('should return false for different arrays', () => {
            const a = new Uint8Array([1, 2, 3, 4]);
            const b = new Uint8Array([1, 2, 3, 5]);
            expect(constantTimeEqual(a, b)).toBe(false);
        });

        it('should return false for different lengths', () => {
            const a = new Uint8Array([1, 2, 3]);
            const b = new Uint8Array([1, 2, 3, 4]);
            expect(constantTimeEqual(a, b)).toBe(false);
        });

        it('should handle empty arrays', () => {
            const a = new Uint8Array(0);
            const b = new Uint8Array(0);
            expect(constantTimeEqual(a, b)).toBe(true);
        });
    });

    describe('Secure Wipe', () => {
        it('should zero out array', () => {
            const data = new Uint8Array([1, 2, 3, 4, 5]);
            secureWipe(data);
            expect(data.every(b => b === 0)).toBe(true);
        });

        it('should handle empty array', () => {
            const empty = new Uint8Array(0);
            expect(() => secureWipe(empty)).not.toThrow();
        });
    });

    describe('Concat/Split Bytes', () => {
        it('should concatenate multiple arrays', () => {
            const a = new Uint8Array([1, 2]);
            const b = new Uint8Array([3, 4]);
            const c = new Uint8Array([5]);
            const result = concatBytes(a, b, c);
            expect(result).toEqual(new Uint8Array([1, 2, 3, 4, 5]));
        });

        it('should split at position', () => {
            const data = new Uint8Array([1, 2, 3, 4, 5]);
            const [left, right] = splitBytes(data, 2);
            expect(left).toEqual(new Uint8Array([1, 2]));
            expect(right).toEqual(new Uint8Array([3, 4, 5]));
        });

        it('should handle edge cases', () => {
            const data = new Uint8Array([1, 2, 3]);
            const [left0, right0] = splitBytes(data, 0);
            expect(left0.length).toBe(0);
            expect(right0).toEqual(data);

            const [left3, right3] = splitBytes(data, 3);
            expect(left3).toEqual(data);
            expect(right3.length).toBe(0);
        });
    });

    describe('isNonZero', () => {
        it('should return true for non-zero arrays', () => {
            expect(isNonZero(new Uint8Array([0, 0, 1]))).toBe(true);
            expect(isNonZero(new Uint8Array([255]))).toBe(true);
        });

        it('should return false for all-zero arrays', () => {
            expect(isNonZero(new Uint8Array([0, 0, 0]))).toBe(false);
            expect(isNonZero(new Uint8Array(32))).toBe(false);
        });
    });

    describe('Deterministic ID', () => {
        it('should be deterministic', async () => {
            const input = stringToBytes('test-input');
            const id1 = await createDeterministicId(input);
            const id2 = await createDeterministicId(input);
            expect(id1).toEqual(id2);
        });

        it('should produce different IDs for different inputs', async () => {
            const id1 = await createDeterministicId(stringToBytes('input-a'));
            const id2 = await createDeterministicId(stringToBytes('input-b'));
            expect(id1).not.toEqual(id2);
        });
    });
});
