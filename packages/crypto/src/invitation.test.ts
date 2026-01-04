/**
 * Phantom Messenger - Invitation System Tests
 */

import { describe, it, expect } from 'vitest';
import {
    generateInvitation,
    validateInvitation,
    revokeInvitation,
    isInvitationValid,
    serializeInvitation,
    deserializeInvitation,
    generateDisposableIdentity,
    bytesToBase64
} from './index';

describe('Invitation System', () => {
    describe('Invitation Generation', () => {
        it('should generate a valid invitation', async () => {
            const creator = generateDisposableIdentity();

            const result = await generateInvitation(creator);
            expect(result.success).toBe(true);
            expect(result.data).toBeDefined();

            const { invitation, invitationCode, invitationSecret } = result.data!;
            expect(invitation).toBeDefined();
            expect(invitationCode).toBeDefined();
            expect(invitationCode.length).toBeGreaterThan(0);
            expect(invitationSecret).toBeDefined();
        });

        it('should generate unique invitations', async () => {
            const creator = generateDisposableIdentity();

            const inv1 = await generateInvitation(creator);
            const inv2 = await generateInvitation(creator);

            expect(inv1.data!.invitationCode).not.toBe(inv2.data!.invitationCode);
        });

        it('should respect custom expiration', async () => {
            const creator = generateDisposableIdentity();

            const result = await generateInvitation(creator, { expiresIn: 3600000 }); // 1 hour
            expect(result.success).toBe(true);

            // Expiration should be within ~1 hour from now
            const exp = result.data!.invitation.expiresAt;
            const expectedMin = Date.now() + 3500000;
            const expectedMax = Date.now() + 3700000;
            expect(exp).toBeGreaterThan(expectedMin);
            expect(exp).toBeLessThan(expectedMax);
        });
    });

    describe('Invitation Validation', () => {
        it('should validate a fresh invitation', async () => {
            const creator = generateDisposableIdentity();
            const { data } = await generateInvitation(creator);

            expect(isInvitationValid(data!.invitation)).toBe(true);
        });

        it('should reject expired invitations', async () => {
            const creator = generateDisposableIdentity();
            const { data } = await generateInvitation(creator, { expiresIn: 1 }); // 1ms

            // Wait for expiration
            await new Promise(r => setTimeout(r, 10));

            expect(isInvitationValid(data!.invitation)).toBe(false);
        });

        it('should reject revoked invitations', async () => {
            const creator = generateDisposableIdentity();
            const { data } = await generateInvitation(creator);

            expect(isInvitationValid(data!.invitation)).toBe(true);

            revokeInvitation(data!.invitation);

            expect(isInvitationValid(data!.invitation)).toBe(false);
        });
    });

    describe('Invitation Serialization', () => {
        it('should serialize and deserialize invitation', async () => {
            const creator = generateDisposableIdentity();
            const { data } = await generateInvitation(creator);

            const serialized = serializeInvitation(data!.invitation);
            expect(typeof serialized).toBe('string');
            expect(serialized.length).toBeGreaterThan(0);

            const deserialized = deserializeInvitation(serialized);
            expect(deserialized.id).toEqual(data!.invitation.id);
            expect(deserialized.expiresAt).toBe(data!.invitation.expiresAt);
        });
    });

    describe('Single-Use Invitations', () => {
        it('should create single-use invitation', async () => {
            const creator = generateDisposableIdentity();

            const result = await generateInvitation(creator, { singleUse: true });
            expect(result.success).toBe(true);
            expect(result.data!.invitation).toBeDefined();
        });

        it('should respect max uses option', async () => {
            const creator = generateDisposableIdentity();

            const result = await generateInvitation(creator, { maxUses: 5 });
            expect(result.success).toBe(true);
            expect(result.data!.invitation).toBeDefined();
        });
    });

    describe('Invitation Metadata', () => {
        it('should include custom metadata', async () => {
            const creator = generateDisposableIdentity();
            const metadata = { nickname: 'Alice', channel: 'test' };

            const result = await generateInvitation(creator, { metadata });
            expect(result.success).toBe(true);
        });
    });
});
