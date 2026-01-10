/**
 * MessageHandler Tests
 * 
 * Comprehensive tests for the message handler including:
 * - Message validation
 * - Authentication flow
 * - Message routing
 * - Rate limiting integration
 * - Sync request handling
 * - Presence/typing indicators
 * - Invitation handling
 * - Error handling
 */

import { describe, it, expect, vi, beforeEach, afterEach, type Mock } from 'vitest';
import { MessageHandler } from './messageHandler';
import { ConnectionManager } from './connectionManager';
import { RateLimiter } from './rateLimiter';
import { MessageStore } from './messageStore';
import type { ClientConnection } from './types';
import type { ProtocolMessage } from '@phantom/shared';

// Mock WebSocket
const createMockSocket = () => ({
    send: vi.fn(),
    close: vi.fn(),
    readyState: 1,
});

// Create mock connection
const createMockConnection = (overrides: Partial<ClientConnection> = {}): ClientConnection => ({
    clientId: 'test-client-id',
    socket: createMockSocket() as any,
    ipHash: 'test-ip-hash',
    connectedAt: Date.now(),
    lastActivity: Date.now(),
    isAuthenticated: false,
    ...overrides,
});

// Helper to parse sent messages
const getSentMessage = (socket: { send: Mock }): ProtocolMessage<any> | null => {
    if (socket.send.mock.calls.length === 0) return null;
    const lastCall = socket.send.mock.calls[socket.send.mock.calls.length - 1];
    return JSON.parse(lastCall[0]);
};

const getAllSentMessages = (socket: { send: Mock }): ProtocolMessage<any>[] => {
    return socket.send.mock.calls.map(call => JSON.parse(call[0]));
};

describe('MessageHandler', () => {
    let handler: MessageHandler;
    let connectionManager: ConnectionManager;
    let rateLimiter: RateLimiter;
    let messageStore: MessageStore;
    let mockConnection: ClientConnection;

    beforeEach(() => {
        connectionManager = new ConnectionManager();
        rateLimiter = new RateLimiter();
        messageStore = new MessageStore();
        handler = new MessageHandler(
            connectionManager,
            rateLimiter,
            messageStore,
            true, // requireInvitation
            null  // no database
        );
        mockConnection = createMockConnection();
    });

    afterEach(() => {
        connectionManager.stop();
        rateLimiter.stop();
        messageStore.destroy();
    });

    describe('Message Validation', () => {
        it('should reject invalid JSON', async () => {
            await handler.handleMessage(mockConnection, 'not valid json');

            const sent = getSentMessage(mockConnection.socket as any);
            expect(sent).not.toBeNull();
            expect(sent?.type).toBe('error');
            expect(sent?.payload.code).toBe('INVALID_REQUEST');
        });

        it('should reject messages without type', async () => {
            await handler.handleMessage(mockConnection, JSON.stringify({
                requestId: 'test-id',
                payload: {},
            }));

            const sent = getSentMessage(mockConnection.socket as any);
            expect(sent?.type).toBe('error');
            expect(sent?.payload.code).toBe('INVALID_REQUEST');
        });

        it('should reject messages without requestId', async () => {
            await handler.handleMessage(mockConnection, JSON.stringify({
                type: 'ping',
                payload: {},
            }));

            const sent = getSentMessage(mockConnection.socket as any);
            expect(sent?.type).toBe('error');
            expect(sent?.payload.code).toBe('INVALID_REQUEST');
        });

        it('should reject messages without payload', async () => {
            await handler.handleMessage(mockConnection, JSON.stringify({
                type: 'ping',
                requestId: 'test-id',
            }));

            const sent = getSentMessage(mockConnection.socket as any);
            expect(sent?.type).toBe('error');
            expect(sent?.payload.code).toBe('INVALID_REQUEST');
        });

        it('should reject unknown message types', async () => {
            await handler.handleMessage(mockConnection, JSON.stringify({
                type: 'unknown-type',
                requestId: 'test-id',
                payload: {},
            }));

            const sent = getSentMessage(mockConnection.socket as any);
            expect(sent?.type).toBe('error');
            expect(sent?.payload.code).toBe('INVALID_REQUEST');
            expect(sent?.payload.message).toBe('Unknown message type');
        });
    });

    describe('Authentication Flow', () => {
        it('should send challenge on first auth request', async () => {
            // Create a real connection through the connection manager
            const conn = connectionManager.addConnection(mockConnection.socket as any, 'test-ip-hash');

            await handler.handleMessage(conn, JSON.stringify({
                type: 'authenticate',
                requestId: 'auth-1',
                payload: {},
                timestamp: Date.now(),
            }));

            const sent = getSentMessage(conn.socket as any);
            expect(sent?.type).toBe('authenticate');
            expect(sent?.payload.challenge).toBeDefined();
            expect(sent?.payload.timestamp).toBeDefined();
        });

        it('should reject auth without public key after challenge', async () => {
            const conn = connectionManager.addConnection(mockConnection.socket as any, 'test-ip-hash');

            // First request to get challenge
            await handler.handleMessage(conn, JSON.stringify({
                type: 'authenticate',
                requestId: 'auth-1',
                payload: {},
                timestamp: Date.now(),
            }));

            // Second request without required fields
            await handler.handleMessage(conn, JSON.stringify({
                type: 'authenticate',
                requestId: 'auth-2',
                payload: {},
                timestamp: Date.now(),
            }));

            const messages = getAllSentMessages(conn.socket as any);
            const errorMsg = messages.find(m => m.type === 'error');
            expect(errorMsg).toBeDefined();
            expect(errorMsg?.payload.code).toBe('INVALID_REQUEST');
        });

        it('should complete auth flow with valid challenge response', async () => {
            // Note: ConnectionManager.authenticate() doesn't verify signatures server-side
            // by design (zero-knowledge architecture). This test verifies the flow completes.
            const conn = connectionManager.addConnection(mockConnection.socket as any, 'test-ip-hash');

            // Get challenge
            await handler.handleMessage(conn, JSON.stringify({
                type: 'authenticate',
                requestId: 'auth-1',
                payload: {},
                timestamp: Date.now(),
            }));

            // Submit with any signature (server trusts client-side verification)
            await handler.handleMessage(conn, JSON.stringify({
                type: 'authenticate',
                requestId: 'auth-2',
                payload: {
                    publicKey: 'user-public-key',
                    signedChallenge: 'client-signed-challenge',
                },
                timestamp: Date.now(),
            }));

            const messages = getAllSentMessages(conn.socket as any);
            // Should have challenge response first, then success
            expect(messages.length).toBe(2);
            expect(messages[0]!.payload.challenge).toBeDefined();
            expect(messages[1]!.type).toBe('authenticate');
            expect(messages[1]!.payload.success).toBe(true);
        });
    });

    describe('Rate Limiting', () => {
        it('should rate limit excessive auth attempts', async () => {
            const conn = connectionManager.addConnection(mockConnection.socket as any, 'same-ip-hash');

            // Make 6 auth attempts (limit is 5)
            for (let i = 0; i < 6; i++) {
                await handler.handleMessage(conn, JSON.stringify({
                    type: 'authenticate',
                    requestId: `auth-${i}`,
                    payload: {},
                    timestamp: Date.now(),
                }));
            }

            const messages = getAllSentMessages(conn.socket as any);
            const rateLimitedMsg = messages.find(m =>
                m.type === 'error' && m.payload.code === 'RATE_LIMITED'
            );
            expect(rateLimitedMsg).toBeDefined();
        });

        it('should rate limit excessive messages', async () => {
            // Create authenticated connection
            const conn = createMockConnection({
                clientId: 'auth-client',
                isAuthenticated: true,
                publicKey: 'sender-public-key',
            });

            // Make 61 message attempts (limit is 60)
            for (let i = 0; i < 61; i++) {
                await handler.handleMessage(conn, JSON.stringify({
                    type: 'message',
                    requestId: `msg-${i}`,
                    payload: {
                        recipientKey: 'recipient-key',
                        encryptedContent: { data: 'encrypted' },
                    },
                    timestamp: Date.now(),
                }));
            }

            const messages = getAllSentMessages(conn.socket as any);
            const rateLimitedMsg = messages.find(m =>
                m.type === 'error' && m.payload.code === 'RATE_LIMITED'
            );
            expect(rateLimitedMsg).toBeDefined();
        });
    });

    describe('Encrypted Message Routing', () => {
        let authenticatedSender: ClientConnection;
        let authenticatedRecipient: ClientConnection;

        beforeEach(() => {
            authenticatedSender = createMockConnection({
                clientId: 'sender-client',
                isAuthenticated: true,
                publicKey: 'sender-public-key',
            });

            authenticatedRecipient = createMockConnection({
                clientId: 'recipient-client',
                isAuthenticated: true,
                publicKey: 'recipient-public-key',
            });

            // Register connections
            vi.spyOn(connectionManager, 'routeMessage').mockReturnValue(true);
            vi.spyOn(connectionManager, 'routeToOtherDevices').mockImplementation(() => true);
            vi.spyOn(connectionManager, 'updateActivity').mockImplementation(() => { });
        });

        it('should reject message from unauthenticated connection', async () => {
            const unauthConn = createMockConnection({ isAuthenticated: false });

            await handler.handleMessage(unauthConn, JSON.stringify({
                type: 'message',
                requestId: 'msg-1',
                payload: {
                    recipientKey: 'recipient-key',
                    encryptedContent: { data: 'encrypted' },
                },
                timestamp: Date.now(),
            }));

            const sent = getSentMessage(unauthConn.socket as any);
            expect(sent?.type).toBe('error');
            expect(sent?.payload.code).toBe('UNAUTHORIZED');
        });

        it('should reject message without recipient key', async () => {
            await handler.handleMessage(authenticatedSender, JSON.stringify({
                type: 'message',
                requestId: 'msg-1',
                payload: {
                    encryptedContent: { data: 'encrypted' },
                },
                timestamp: Date.now(),
            }));

            const sent = getSentMessage(authenticatedSender.socket as any);
            expect(sent?.type).toBe('error');
            expect(sent?.payload.code).toBe('INVALID_REQUEST');
        });

        it('should reject message without encrypted content', async () => {
            await handler.handleMessage(authenticatedSender, JSON.stringify({
                type: 'message',
                requestId: 'msg-1',
                payload: {
                    recipientKey: 'recipient-key',
                },
                timestamp: Date.now(),
            }));

            const sent = getSentMessage(authenticatedSender.socket as any);
            expect(sent?.type).toBe('error');
            expect(sent?.payload.code).toBe('INVALID_REQUEST');
        });

        it('should send message-ack on successful message', async () => {
            await handler.handleMessage(authenticatedSender, JSON.stringify({
                type: 'message',
                requestId: 'msg-1',
                payload: {
                    recipientKey: 'recipient-key',
                    encryptedContent: { data: 'encrypted' },
                },
                timestamp: Date.now(),
            }));

            const sent = getSentMessage(authenticatedSender.socket as any);
            expect(sent?.type).toBe('message-ack');
            expect(sent?.payload.messageId).toBeDefined();
            expect(sent?.payload.delivered).toBe(true);
        });

        it('should store message in message store', async () => {
            const storeSpy = vi.spyOn(messageStore, 'storeMessage');

            await handler.handleMessage(authenticatedSender, JSON.stringify({
                type: 'message',
                requestId: 'msg-1',
                payload: {
                    recipientKey: 'recipient-key',
                    encryptedContent: { data: 'encrypted' },
                },
                timestamp: Date.now(),
            }));

            expect(storeSpy).toHaveBeenCalledWith(
                'sender-public-key',
                'recipient-key',
                { data: 'encrypted' }
            );
        });

        it('should route message to recipient', async () => {
            const routeSpy = vi.spyOn(connectionManager, 'routeMessage');

            await handler.handleMessage(authenticatedSender, JSON.stringify({
                type: 'message',
                requestId: 'msg-1',
                payload: {
                    recipientKey: 'recipient-key',
                    encryptedContent: { data: 'encrypted' },
                },
                timestamp: Date.now(),
            }));

            expect(routeSpy).toHaveBeenCalledWith(
                'recipient-key',
                expect.objectContaining({
                    type: 'message',
                    payload: expect.objectContaining({
                        senderKey: 'sender-public-key',
                        encryptedContent: { data: 'encrypted' },
                    }),
                })
            );
        });
    });

    describe('Ping/Pong', () => {
        it('should respond to ping with pong', async () => {
            await handler.handleMessage(mockConnection, JSON.stringify({
                type: 'ping',
                requestId: 'ping-1',
                payload: {},
                timestamp: Date.now(),
            }));

            const sent = getSentMessage(mockConnection.socket as any);
            expect(sent?.type).toBe('pong');
            expect(sent?.requestId).toBe('ping-1');
        });
    });

    describe('Presence Updates', () => {
        let authenticatedConnection: ClientConnection;

        beforeEach(() => {
            authenticatedConnection = createMockConnection({
                clientId: 'presence-client',
                isAuthenticated: true,
                publicKey: 'presence-user-key',
            });

            vi.spyOn(connectionManager, 'updateActivity').mockImplementation(() => { });
        });

        it('should ignore presence from unauthenticated user', async () => {
            const routeSpy = vi.spyOn(connectionManager, 'routeMessage');
            const unauthConn = createMockConnection({ isAuthenticated: false });

            await handler.handleMessage(unauthConn, JSON.stringify({
                type: 'presence',
                requestId: 'presence-1',
                payload: {
                    recipientKey: 'target-key',
                    status: 'online',
                },
                timestamp: Date.now(),
            }));

            expect(routeSpy).not.toHaveBeenCalled();
        });

        it('should route presence to specific recipient', async () => {
            const routeSpy = vi.spyOn(connectionManager, 'routeMessage').mockReturnValue(true);

            await handler.handleMessage(authenticatedConnection, JSON.stringify({
                type: 'presence',
                requestId: 'presence-1',
                payload: {
                    recipientKey: 'target-key',
                    status: 'online',
                },
                timestamp: Date.now(),
            }));

            expect(routeSpy).toHaveBeenCalledWith(
                'target-key',
                expect.objectContaining({
                    type: 'presence',
                    payload: expect.objectContaining({
                        userKey: 'presence-user-key',
                        status: 'online',
                    }),
                })
            );
        });
    });

    describe('Typing Indicators', () => {
        let authenticatedConnection: ClientConnection;

        beforeEach(() => {
            authenticatedConnection = createMockConnection({
                clientId: 'typing-client',
                isAuthenticated: true,
                publicKey: 'typing-user-key',
            });

            vi.spyOn(connectionManager, 'updateActivity').mockImplementation(() => { });
        });

        it('should ignore typing from unauthenticated user', async () => {
            const routeSpy = vi.spyOn(connectionManager, 'routeMessage');
            const unauthConn = createMockConnection({ isAuthenticated: false });

            await handler.handleMessage(unauthConn, JSON.stringify({
                type: 'typing',
                requestId: 'typing-1',
                payload: {
                    recipientKey: 'target-key',
                    isTyping: true,
                },
                timestamp: Date.now(),
            }));

            expect(routeSpy).not.toHaveBeenCalled();
        });

        it('should route typing indicator to recipient', async () => {
            const routeSpy = vi.spyOn(connectionManager, 'routeMessage').mockReturnValue(true);

            await handler.handleMessage(authenticatedConnection, JSON.stringify({
                type: 'typing',
                requestId: 'typing-1',
                payload: {
                    recipientKey: 'target-key',
                    isTyping: true,
                },
                timestamp: Date.now(),
            }));

            expect(routeSpy).toHaveBeenCalledWith(
                'target-key',
                expect.objectContaining({
                    type: 'typing',
                    payload: expect.objectContaining({
                        userKey: 'typing-user-key',
                        isTyping: true,
                    }),
                })
            );
        });

        it('should ignore typing without recipient key', async () => {
            const routeSpy = vi.spyOn(connectionManager, 'routeMessage');

            await handler.handleMessage(authenticatedConnection, JSON.stringify({
                type: 'typing',
                requestId: 'typing-1',
                payload: {
                    isTyping: true,
                },
                timestamp: Date.now(),
            }));

            expect(routeSpy).not.toHaveBeenCalled();
        });
    });

    describe('Key Exchange', () => {
        let authenticatedConnection: ClientConnection;

        beforeEach(() => {
            authenticatedConnection = createMockConnection({
                clientId: 'kex-client',
                isAuthenticated: true,
                publicKey: 'initiator-key',
            });

            vi.spyOn(connectionManager, 'updateActivity').mockImplementation(() => { });
        });

        it('should reject key exchange from unauthenticated user', async () => {
            const unauthConn = createMockConnection({ isAuthenticated: false });

            await handler.handleMessage(unauthConn, JSON.stringify({
                type: 'key-exchange',
                requestId: 'kex-1',
                payload: {
                    recipientKey: 'recipient-key',
                    keyBundle: { identityKey: 'key', signedPreKey: 'spk' },
                },
                timestamp: Date.now(),
            }));

            const sent = getSentMessage(unauthConn.socket as any);
            expect(sent?.type).toBe('error');
            expect(sent?.payload.code).toBe('UNAUTHORIZED');
        });

        it('should reject key exchange without recipient key', async () => {
            await handler.handleMessage(authenticatedConnection, JSON.stringify({
                type: 'key-exchange',
                requestId: 'kex-1',
                payload: {
                    keyBundle: { identityKey: 'key', signedPreKey: 'spk' },
                },
                timestamp: Date.now(),
            }));

            const sent = getSentMessage(authenticatedConnection.socket as any);
            expect(sent?.type).toBe('error');
            expect(sent?.payload.code).toBe('INVALID_REQUEST');
        });

        it('should forward key exchange to recipient', async () => {
            const routeSpy = vi.spyOn(connectionManager, 'routeMessage').mockReturnValue(true);
            vi.spyOn(connectionManager, 'storePendingKeyExchange').mockImplementation(() => { });

            await handler.handleMessage(authenticatedConnection, JSON.stringify({
                type: 'key-exchange',
                requestId: 'kex-1',
                payload: {
                    recipientKey: 'recipient-key',
                    keyBundle: { identityKey: 'key', signedPreKey: 'spk' },
                },
                timestamp: Date.now(),
            }));

            expect(routeSpy).toHaveBeenCalledWith(
                'recipient-key',
                expect.objectContaining({
                    type: 'key-exchange',
                    payload: expect.objectContaining({
                        initiatorKey: 'initiator-key',
                    }),
                })
            );

            // Check acknowledgment
            const sent = getSentMessage(authenticatedConnection.socket as any);
            expect(sent?.type).toBe('key-exchange');
            expect(sent?.payload.delivered).toBe(true);
        });
    });

    describe('Key Exchange Response', () => {
        let authenticatedConnection: ClientConnection;

        beforeEach(() => {
            authenticatedConnection = createMockConnection({
                clientId: 'kex-resp-client',
                isAuthenticated: true,
                publicKey: 'responder-key',
            });

            vi.spyOn(connectionManager, 'updateActivity').mockImplementation(() => { });
        });

        it('should forward key exchange response to initiator', async () => {
            const routeSpy = vi.spyOn(connectionManager, 'routeMessage').mockReturnValue(true);

            await handler.handleMessage(authenticatedConnection, JSON.stringify({
                type: 'key-exchange-response',
                requestId: 'kex-resp-1',
                payload: {
                    initiatorKey: 'initiator-key',
                    keyBundle: { identityKey: 'key', signedPreKey: 'spk' },
                },
                timestamp: Date.now(),
            }));

            expect(routeSpy).toHaveBeenCalledWith(
                'initiator-key',
                expect.objectContaining({
                    type: 'key-exchange-response',
                    payload: expect.objectContaining({
                        responderKey: 'responder-key',
                    }),
                })
            );
        });
    });

    describe('Invitation Handling', () => {
        let authenticatedConnection: ClientConnection;

        beforeEach(() => {
            authenticatedConnection = createMockConnection({
                clientId: 'invite-client',
                isAuthenticated: true,
                publicKey: 'inviter-key',
            });

            vi.spyOn(connectionManager, 'updateActivity').mockImplementation(() => { });
        });

        it('should reject invitation from unauthenticated user', async () => {
            const unauthConn = createMockConnection({ isAuthenticated: false });

            await handler.handleMessage(unauthConn, JSON.stringify({
                type: 'invitation',
                requestId: 'invite-1',
                payload: {},
                timestamp: Date.now(),
            }));

            const sent = getSentMessage(unauthConn.socket as any);
            expect(sent?.type).toBe('error');
            expect(sent?.payload.code).toBe('UNAUTHORIZED');
        });

        it('should acknowledge invitation', async () => {
            await handler.handleMessage(authenticatedConnection, JSON.stringify({
                type: 'invitation',
                requestId: 'invite-1',
                payload: {},
                timestamp: Date.now(),
            }));

            const sent = getSentMessage(authenticatedConnection.socket as any);
            expect(sent?.type).toBe('invitation');
            expect(sent?.payload.acknowledged).toBe(true);
        });
    });

    describe('Invitation Accept', () => {
        let authenticatedConnection: ClientConnection;

        beforeEach(() => {
            authenticatedConnection = createMockConnection({
                clientId: 'accept-client',
                isAuthenticated: true,
                publicKey: 'accepter-key',
            });

            vi.spyOn(connectionManager, 'updateActivity').mockImplementation(() => { });
        });

        it('should notify inviter of acceptance', async () => {
            const routeSpy = vi.spyOn(connectionManager, 'routeMessage').mockReturnValue(true);

            await handler.handleMessage(authenticatedConnection, JSON.stringify({
                type: 'invitation-accept',
                requestId: 'accept-1',
                payload: {
                    inviterKey: 'inviter-key',
                    accepterKey: 'accepter-key',
                },
                timestamp: Date.now(),
            }));

            expect(routeSpy).toHaveBeenCalledWith(
                'inviter-key',
                expect.objectContaining({
                    type: 'invitation-accept',
                    payload: expect.objectContaining({
                        accepterKey: 'accepter-key',
                    }),
                })
            );

            const sent = getSentMessage(authenticatedConnection.socket as any);
            expect(sent?.type).toBe('invitation-accept');
            expect(sent?.payload.success).toBe(true);
        });
    });

    describe('Burn Request', () => {
        let authenticatedConnection: ClientConnection;

        beforeEach(() => {
            authenticatedConnection = createMockConnection({
                clientId: 'burn-client',
                isAuthenticated: true,
                publicKey: 'burner-key',
            });

            vi.spyOn(connectionManager, 'updateActivity').mockImplementation(() => { });
        });

        it('should ignore burn request from unauthenticated user', async () => {
            const routeSpy = vi.spyOn(connectionManager, 'routeMessage');
            const unauthConn = createMockConnection({ isAuthenticated: false });

            await handler.handleMessage(unauthConn, JSON.stringify({
                type: 'burn-request',
                requestId: 'burn-1',
                payload: {
                    recipientKey: 'target-key',
                    messageId: 'msg-123',
                },
                timestamp: Date.now(),
            }));

            expect(routeSpy).not.toHaveBeenCalled();
        });

        it('should forward burn request to recipient', async () => {
            const routeSpy = vi.spyOn(connectionManager, 'routeMessage').mockReturnValue(true);

            await handler.handleMessage(authenticatedConnection, JSON.stringify({
                type: 'burn-request',
                requestId: 'burn-1',
                payload: {
                    recipientKey: 'target-key',
                    messageId: 'msg-123',
                },
                timestamp: Date.now(),
            }));

            expect(routeSpy).toHaveBeenCalledWith(
                'target-key',
                expect.objectContaining({
                    type: 'burn-request',
                    payload: expect.objectContaining({
                        senderKey: 'burner-key',
                        messageId: 'msg-123',
                    }),
                })
            );
        });
    });

    describe('Sync Request', () => {
        let authenticatedConnection: ClientConnection;

        beforeEach(() => {
            authenticatedConnection = createMockConnection({
                clientId: 'sync-client',
                isAuthenticated: true,
                publicKey: 'sync-user-key',
            });

            vi.spyOn(connectionManager, 'updateActivity').mockImplementation(() => { });
        });

        it('should reject sync from unauthenticated user', async () => {
            const unauthConn = createMockConnection({ isAuthenticated: false });

            await handler.handleMessage(unauthConn, JSON.stringify({
                type: 'sync-request',
                requestId: 'sync-1',
                payload: {},
                timestamp: Date.now(),
            }));

            const sent = getSentMessage(unauthConn.socket as any);
            expect(sent?.type).toBe('error');
            expect(sent?.payload.code).toBe('UNAUTHORIZED');
        });

        it('should return sync-response with messages', async () => {
            // Store a test message
            messageStore.storeMessage('sender-key', 'sync-user-key', { encrypted: 'content' });

            await handler.handleMessage(authenticatedConnection, JSON.stringify({
                type: 'sync-request',
                requestId: 'sync-1',
                payload: {},
                timestamp: Date.now(),
            }));

            const sent = getSentMessage(authenticatedConnection.socket as any);
            expect(sent?.type).toBe('sync-response');
            expect(sent?.payload.messages).toBeInstanceOf(Array);
            expect(sent?.payload.hasMore).toBeDefined();
        });

        it('should filter messages by timestamp', async () => {
            const oldTimestamp = Date.now() - 10000;

            await handler.handleMessage(authenticatedConnection, JSON.stringify({
                type: 'sync-request',
                requestId: 'sync-1',
                payload: {
                    sinceTimestamp: Date.now(),  // Only messages from now
                },
                timestamp: Date.now(),
            }));

            const sent = getSentMessage(authenticatedConnection.socket as any);
            expect(sent?.type).toBe('sync-response');
            expect(sent?.payload.messages.length).toBe(0);
        });

        it('should filter messages by conversation', async () => {
            // Store messages from different senders
            messageStore.storeMessage('sender-a', 'sync-user-key', { from: 'a' });
            messageStore.storeMessage('sender-b', 'sync-user-key', { from: 'b' });

            await handler.handleMessage(authenticatedConnection, JSON.stringify({
                type: 'sync-request',
                requestId: 'sync-1',
                payload: {
                    conversationWith: 'sender-a',
                },
                timestamp: Date.now(),
            }));

            const sent = getSentMessage(authenticatedConnection.socket as any);
            expect(sent?.type).toBe('sync-response');
            expect(sent?.payload.messages.every((m: any) =>
                m.senderKey === 'sender-a' || m.recipientKey === 'sender-a'
            )).toBe(true);
        });

        it('should respect limit parameter', async () => {
            // Store multiple messages
            for (let i = 0; i < 10; i++) {
                messageStore.storeMessage(`sender-${i}`, 'sync-user-key', { msg: i });
            }

            await handler.handleMessage(authenticatedConnection, JSON.stringify({
                type: 'sync-request',
                requestId: 'sync-1',
                payload: {
                    limit: 5,
                },
                timestamp: Date.now(),
            }));

            const sent = getSentMessage(authenticatedConnection.socket as any);
            expect(sent?.type).toBe('sync-response');
            expect(sent?.payload.messages.length).toBeLessThanOrEqual(5);
        });
    });

    describe('Media Upload (without database)', () => {
        let authenticatedConnection: ClientConnection;

        beforeEach(() => {
            authenticatedConnection = createMockConnection({
                clientId: 'media-client',
                isAuthenticated: true,
                publicKey: 'media-user-key',
            });

            vi.spyOn(connectionManager, 'updateActivity').mockImplementation(() => { });
        });

        it('should reject media upload without database', async () => {
            await handler.handleMessage(authenticatedConnection, JSON.stringify({
                type: 'media-upload',
                requestId: 'upload-1',
                payload: {
                    recipientKey: 'recipient-key',
                    encryptedData: 'base64data',
                    encryptedKey: 'encrypted-key',
                    fileSize: 1000,
                },
                timestamp: Date.now(),
            }));

            const sent = getSentMessage(authenticatedConnection.socket as any);
            expect(sent?.type).toBe('error');
            expect(sent?.payload.code).toBe('NOT_SUPPORTED');
        });
    });

    describe('Media Download (without database)', () => {
        let authenticatedConnection: ClientConnection;

        beforeEach(() => {
            authenticatedConnection = createMockConnection({
                clientId: 'download-client',
                isAuthenticated: true,
                publicKey: 'download-user-key',
            });

            vi.spyOn(connectionManager, 'updateActivity').mockImplementation(() => { });
        });

        it('should reject media download without database', async () => {
            await handler.handleMessage(authenticatedConnection, JSON.stringify({
                type: 'media-download',
                requestId: 'download-1',
                payload: {
                    mediaId: 'media-123',
                },
                timestamp: Date.now(),
            }));

            const sent = getSentMessage(authenticatedConnection.socket as any);
            expect(sent?.type).toBe('error');
            expect((sent?.payload as any).code).toBe('NOT_SUPPORTED');
        });
    });
});
