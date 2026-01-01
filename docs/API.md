# WebSocket API Reference

## Overview

Phantom Messenger uses WebSocket for real-time, bidirectional communication. All messages are JSON-encoded with a standard envelope structure.

## Connection

### Endpoint

```
wss://your-server.com/ws
```

### Connection Flow

1. Client establishes WebSocket connection
2. Server sends `CONNECTION_ACK`
3. Client sends `AUTH` message
4. Server validates and sends `AUTH_SUCCESS` or `AUTH_FAILURE`
5. Client can now send/receive messages

## Message Envelope

All messages follow this structure:

```typescript
interface ProtocolMessage {
  type: MessageType;
  payload: unknown;
  timestamp: number;
  id?: string;          // Message ID for acknowledgments
  signature?: string;   // Ed25519 signature (base64)
}

type MessageType =
  | 'AUTH'
  | 'AUTH_SUCCESS'
  | 'AUTH_FAILURE'
  | 'KEY_EXCHANGE_INIT'
  | 'KEY_EXCHANGE_RESPONSE'
  | 'MESSAGE'
  | 'MESSAGE_ACK'
  | 'PRESENCE'
  | 'ERROR'
  | 'PING'
  | 'PONG';
```

## Authentication

### AUTH Request

```typescript
// Client → Server
{
  type: 'AUTH',
  payload: {
    userId: string;           // Base64-encoded user ID
    publicKey: string;        // Base64-encoded Ed25519 public key
  },
  timestamp: number
}
```

### AUTH_SUCCESS Response

```typescript
// Server → Client
{
  type: 'AUTH_SUCCESS',
  payload: {
    sessionId: string;
    serverTime: number;
  },
  timestamp: number
}
```

### AUTH_FAILURE Response

```typescript
// Server → Client
{
  type: 'AUTH_FAILURE',
  payload: {
    reason: string;
    code: number;
  },
  timestamp: number
}
```

## Key Exchange

### KEY_EXCHANGE_INIT

Initiates X3DH key exchange with a peer.

```typescript
// Client → Server
{
  type: 'KEY_EXCHANGE_INIT',
  payload: {
    targetId: string;           // Recipient's user ID
    identityKey: string;        // Sender's identity key (base64)
    ephemeralKey: string;       // Sender's ephemeral key (base64)
    preKeyBundle?: {            // Optional prekey bundle request
      signedPreKey: string;
      signature: string;
      oneTimePreKey?: string;
    }
  },
  timestamp: number,
  signature: string
}
```

### KEY_EXCHANGE_RESPONSE

Response to key exchange initiation.

```typescript
// Server → Client (forwarded from peer)
{
  type: 'KEY_EXCHANGE_RESPONSE',
  payload: {
    senderId: string;
    identityKey: string;
    signedPreKey: string;
    preKeySignature: string;
    oneTimePreKey?: string;
  },
  timestamp: number,
  signature: string
}
```

## Messaging

### MESSAGE

Send an encrypted message.

```typescript
// Client → Server
{
  type: 'MESSAGE',
  payload: {
    recipientId: string;        // Target user ID
    encrypted: string;          // Base64-encoded encrypted content
    messageId: string;          // Unique message ID (UUID)
    conversationId: string;     // Conversation identifier
    metadata?: {
      burnAfterRead?: boolean;
      expiresIn?: number;       // Milliseconds
    }
  },
  timestamp: number,
  id: string,
  signature: string
}
```

### MESSAGE_ACK

Acknowledge message receipt.

```typescript
// Server → Client
{
  type: 'MESSAGE_ACK',
  payload: {
    messageId: string;
    status: 'delivered' | 'read' | 'burned';
    timestamp: number;
  },
  timestamp: number
}
```

## Presence

### PRESENCE

Update or query presence status.

```typescript
// Client → Server (update)
{
  type: 'PRESENCE',
  payload: {
    status: 'online' | 'typing' | 'idle' | 'offline';
    conversationId?: string;    // For typing indicator
  },
  timestamp: number
}

// Server → Client (notification)
{
  type: 'PRESENCE',
  payload: {
    userId: string;
    status: 'online' | 'typing' | 'idle' | 'offline';
    conversationId?: string;
    lastSeen?: number;
  },
  timestamp: number
}
```

## Error Handling

### ERROR

Server error response.

```typescript
// Server → Client
{
  type: 'ERROR',
  payload: {
    code: ErrorCode;
    message: string;
    details?: unknown;
    retryAfter?: number;        // For rate limiting
  },
  timestamp: number
}

enum ErrorCode {
  INVALID_MESSAGE = 1001,
  UNAUTHORIZED = 1002,
  RATE_LIMITED = 1003,
  USER_NOT_FOUND = 1004,
  KEY_EXCHANGE_FAILED = 1005,
  MESSAGE_TOO_LARGE = 1006,
  INTERNAL_ERROR = 1007
}
```

## Health Check

### PING/PONG

Keep-alive mechanism.

```typescript
// Client → Server
{
  type: 'PING',
  timestamp: number
}

// Server → Client
{
  type: 'PONG',
  timestamp: number
}
```

## Rate Limits

| Endpoint | Limit | Window |
|----------|-------|--------|
| AUTH | 5 | 1 minute |
| MESSAGE | 60 | 1 minute |
| KEY_EXCHANGE | 10 | 1 minute |
| PRESENCE | 30 | 1 minute |
| PING | 60 | 1 minute |

When rate limited, server responds with:

```typescript
{
  type: 'ERROR',
  payload: {
    code: 1003,
    message: 'Rate limited',
    retryAfter: 30000  // milliseconds
  }
}
```

## Message Size Limits

| Field | Limit |
|-------|-------|
| Total message | 64 KB |
| Encrypted payload | 60 KB |
| Metadata | 1 KB |

## Connection Limits

| Limit | Value |
|-------|-------|
| Max connections per IP | 10 |
| Connection timeout | 30 seconds |
| Idle timeout | 5 minutes |
| Max message backlog | 1000 |

## Example Flow

### 1. Connect and Authenticate

```javascript
// Connect
const ws = new WebSocket('wss://server.com/ws');

// On connection
ws.onopen = () => {
  ws.send(JSON.stringify({
    type: 'AUTH',
    payload: {
      userId: base64Encode(identity.id),
      publicKey: base64Encode(identity.publicKey)
    },
    timestamp: Date.now()
  }));
};

// Handle auth response
ws.onmessage = (event) => {
  const msg = JSON.parse(event.data);
  if (msg.type === 'AUTH_SUCCESS') {
    console.log('Authenticated!');
  }
};
```

### 2. Initiate Key Exchange

```javascript
ws.send(JSON.stringify({
  type: 'KEY_EXCHANGE_INIT',
  payload: {
    targetId: recipientId,
    identityKey: base64Encode(identity.publicKey),
    ephemeralKey: base64Encode(ephemeralKeyPair.publicKey)
  },
  timestamp: Date.now(),
  signature: sign(payload, identity.privateKey)
}));
```

### 3. Send Encrypted Message

```javascript
const encrypted = encryptMessage(
  plaintext,
  sessionKey,
  identity.privateKey
);

ws.send(JSON.stringify({
  type: 'MESSAGE',
  payload: {
    recipientId: recipientId,
    encrypted: base64Encode(encrypted),
    messageId: generateUUID(),
    conversationId: conversationId,
    metadata: {
      burnAfterRead: true
    }
  },
  timestamp: Date.now(),
  id: generateUUID(),
  signature: sign(payload, identity.privateKey)
}));
```

## WebSocket Close Codes

| Code | Meaning |
|------|---------|
| 1000 | Normal closure |
| 1001 | Going away |
| 1008 | Policy violation |
| 1011 | Server error |
| 4000 | Authentication required |
| 4001 | Authentication failed |
| 4002 | Rate limited |
| 4003 | Invalid message |

## Security Considerations

1. **Always use WSS** (WebSocket Secure) in production
2. **Validate all signatures** before processing messages
3. **Implement message replay protection** using timestamps
4. **Handle reconnection** gracefully with exponential backoff
5. **Clear sensitive data** from memory when connection closes
