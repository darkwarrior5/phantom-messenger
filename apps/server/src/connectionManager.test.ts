
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ConnectionManager } from './connectionManager';
import { generateSigningKeyPair, sign, bytesToBase64, base64ToBytes } from '@phantom/crypto';
import type { WebSocket } from 'ws';

describe('ConnectionManager Auth', () => {
    let cm: ConnectionManager;
    let mockSocket: any;
    let kp: any;

    beforeEach(() => {
        cm = new ConnectionManager();
        mockSocket = { send: vi.fn(), close: vi.fn(), readyState: 1 };
        kp = generateSigningKeyPair();
    });

    afterEach(() => {
        cm.stop();
    });

    it('should authenticate with valid signature', () => {
        const client = cm.addConnection(mockSocket as WebSocket, 'iphash');
        const challenge = cm.generateChallenge(client.clientId);

        // Sign the nonce (decoded)
        const nonceBytes = base64ToBytes(challenge.nonce);
        const signature = sign(nonceBytes, kp.secretKey);

        expect(signature.success).toBe(true);

        const success = cm.authenticate(
            client.clientId,
            bytesToBase64(kp.publicKey),
            bytesToBase64(signature.data!)
        );

        expect(success).toBe(true);
        expect(client.isAuthenticated).toBe(true);
        expect(client.publicKey).toBe(bytesToBase64(kp.publicKey));
    });

    it('should fail with invalid signature', () => {
        const client = cm.addConnection(mockSocket as WebSocket, 'iphash');
        const challenge = cm.generateChallenge(client.clientId);

        // Sign WRONG data
        const wrongData = new Uint8Array([1, 2, 3]);
        const signature = sign(wrongData, kp.secretKey);

        const success = cm.authenticate(
            client.clientId,
            bytesToBase64(kp.publicKey),
            bytesToBase64(signature.data!)
        );

        expect(success).toBe(false);
        expect(client.isAuthenticated).toBe(false);
    });

    it('should fail with random signature bytes', () => {
        const client = cm.addConnection(mockSocket as WebSocket, 'iphash');
        cm.generateChallenge(client.clientId);

        const randomSig = bytesToBase64(new Uint8Array(64).fill(1));

        const success = cm.authenticate(
            client.clientId,
            bytesToBase64(kp.publicKey),
            randomSig
        );

        expect(success).toBe(false);
        expect(client.isAuthenticated).toBe(false);
    });
});
