# Security Architecture

## Overview

Phantom Messenger implements a zero-knowledge, end-to-end encrypted messaging system. This document details the security architecture, cryptographic primitives, and threat model.

## Threat Model

### Assumptions
- The server is untrusted - it may be compromised or operated by a malicious party
- Network traffic may be monitored (TLS provides transport security)
- Client devices are trusted while the app is running
- Cryptographic primitives are secure (NaCl/TweetNaCl implementations)

### Protected Against
- Server-side data breaches (server stores no plaintext)
- Network eavesdropping (E2E encryption + TLS)
- Message tampering (authenticated encryption)
- Replay attacks (nonces + timestamps)
- Identity correlation (disposable identities)
- Metadata analysis (minimal metadata, encrypted headers)

### Not Protected Against
- Compromised client devices
- Physical access to unlocked device
- Malicious app modifications
- Side-channel attacks on client

## Cryptographic Primitives

### Symmetric Encryption
- **Algorithm**: AES-256-GCM
- **Key Size**: 256 bits
- **Nonce Size**: 96 bits (12 bytes)
- **Authentication Tag**: 128 bits (16 bytes)
- **Additional Layer**: 16-bit security token for defense in depth

### Asymmetric Encryption (Key Exchange)
- **Algorithm**: X25519 (Curve25519 ECDH)
- **Key Size**: 256 bits
- **Implementation**: TweetNaCl

### Digital Signatures
- **Algorithm**: Ed25519
- **Key Size**: 256 bits
- **Signature Size**: 512 bits

### Key Derivation
- **Algorithm**: HKDF-SHA-256
- **Salt**: 256 bits random
- **Info**: Context-specific strings

### Random Number Generation
- **Source**: crypto.getRandomValues() (Web Crypto API)
- **Fallback**: None (fails secure)

## Key Exchange Protocol

### Extended Triple Diffie-Hellman (X3DH)

Phantom implements a variant of the Signal Protocol's X3DH for initial key exchange:

```
Initiator (Alice)          Server              Responder (Bob)
    |                        |                      |
    |--- Identity Key (IKa) -->                     |
    |--- Ephemeral Key (EKa) -->                    |
    |                        |                      |
    |                        |<-- Identity Key (IKb) ---|
    |                        |<-- Signed Prekey (SPKb) -|
    |                        |<-- One-time Prekey (OPKb)|
    |                        |                      |
    |<----- Key Bundle ------|                      |
    |                        |                      |
    |  DH1 = DH(IKa, SPKb)                          |
    |  DH2 = DH(EKa, IKb)                           |
    |  DH3 = DH(EKa, SPKb)                          |
    |  DH4 = DH(EKa, OPKb) [if available]           |
    |                        |                      |
    |  SK = HKDF(DH1 || DH2 || DH3 || DH4)          |
    |                        |                      |
```

### Perfect Forward Secrecy (PFS)

After initial key exchange, session keys are ratcheted:

```typescript
// Session key derivation
const sessionKey = deriveSessionKey(
  sharedSecret,     // From X3DH
  senderPublicKey,
  receiverPublicKey,
  timestamp
);

// Key ratchet
const nextKey = HKDF(
  currentKey,
  salt: random(32),
  info: "phantom_ratchet"
);
```

## Message Encryption

### Encryption Flow

1. **Generate nonce**: 12 random bytes
2. **Apply security layer**: XOR with 16-bit rotating token
3. **Encrypt**: AES-256-GCM(key, nonce, plaintext)
4. **Package**: nonce || ciphertext || authTag

### Decryption Flow

1. **Parse**: Extract nonce, ciphertext, authTag
2. **Decrypt**: AES-256-GCM-Open(key, nonce, ciphertext, authTag)
3. **Remove security layer**: XOR with 16-bit token
4. **Verify**: Check authTag validity

### Message Structure

```typescript
interface EncryptedMessage {
  version: number;        // Protocol version
  nonce: Uint8Array;      // 12 bytes
  ciphertext: Uint8Array; // Variable
  authTag: Uint8Array;    // 16 bytes
}
```

## Identity Management

### Disposable Identities

Identities are ephemeral and can be destroyed at any time:

```typescript
interface DisposableIdentity {
  id: Uint8Array;           // Random identifier
  publicKey: Uint8Array;    // Ed25519 public key
  privateKey: Uint8Array;   // Ed25519 private key (SENSITIVE)
  exchangeKeyPair: {        // X25519 for ECDH
    publicKey: Uint8Array;
    privateKey: Uint8Array; // (SENSITIVE)
  };
  createdAt: number;
}
```

### Identity Destruction

When an identity is destroyed:

1. **Overwrite keys**: Fill with random data
2. **Clear memory**: Zero all buffers
3. **Delete storage**: Remove from keychain/localStorage
4. **Notify server**: Send destruction signal

```typescript
function destroyIdentity(identity: DisposableIdentity): void {
  // Overwrite sensitive data multiple times
  for (let i = 0; i < 3; i++) {
    crypto.getRandomValues(identity.privateKey);
    crypto.getRandomValues(identity.exchangeKeyPair.privateKey);
  }
  
  // Zero out
  identity.privateKey.fill(0);
  identity.exchangeKeyPair.privateKey.fill(0);
  
  // Clear storage
  secureStorage.delete('identity');
}
```

## Server Architecture

### Zero-Knowledge Design

The server NEVER has access to:
- Message content (encrypted client-side)
- Encryption keys (never transmitted)
- User identities (only random IDs)
- Conversation membership (encrypted metadata)

### What the Server Stores

**Ephemeral only** (memory, no disk):
- Active WebSocket connections
- Public keys for key exchange
- Pending key bundles

**What it routes**:
- Encrypted message blobs
- Key exchange messages
- Presence signals

### Rate Limiting

Privacy-preserving rate limiting:

```typescript
// Hash client identifier before storing
const hashedId = hash(clientId + dailySalt);
rateLimits.set(hashedId, {
  requests: count,
  window: timestamp
});
```

## Invitation System

### Invitation Generation

```typescript
interface SecureInvitation {
  code: string;          // Base64-encoded blob
  expiresAt: number;     // Unix timestamp
  maxUses: number;       // Usually 1
  creatorId: string;     // Encrypted
}

// Code contains:
// - Inviter's public signing key
// - Inviter's public exchange key
// - Random invitation ID
// - Expiration timestamp
// - HMAC signature
```

### Invitation Acceptance

1. **Decode**: Parse invitation code
2. **Verify**: Check HMAC and expiration
3. **Exchange**: Perform X3DH with inviter's keys
4. **Establish**: Create encrypted channel

## Storage Security

### Web (localStorage)

- Sensitive data encrypted with derived key
- Key derived from device fingerprint + user salt
- Consider: Web Crypto API for key storage (where available)

### Mobile (Keychain/Keystore)

- iOS: Keychain with `kSecAttrAccessibleWhenUnlockedThisDeviceOnly`
- Android: KeyStore with biometric binding
- Encryption at rest via OS mechanisms

### Memory Protection

- Clear sensitive data after use
- Avoid string operations on keys (use Uint8Array)
- No logging of sensitive data

## Protocol Messages

### Message Types

| Type | Direction | Encrypted | Description |
|------|-----------|-----------|-------------|
| AUTH | Client→Server | No* | Initial authentication |
| KEY_EXCHANGE | Both | Partial | X3DH key exchange |
| MESSAGE | Both | Yes | User messages |
| ACK | Both | Yes | Delivery confirmations |
| PRESENCE | Both | Yes | Online/typing status |
| DESTROY | Client→Server | No* | Identity destruction |

*Contains no sensitive data

## Security Recommendations

### For Users

1. **Create new identity** if device may be compromised
2. **Enable biometric lock** on mobile devices
3. **Share invitations** only through secure channels
4. **Destroy identity** when no longer needed
5. **Don't screenshot** sensitive conversations

### For Deployment

1. **Use TLS 1.3** for all server connections
2. **Enable HSTS** with long max-age
3. **Implement CSP** to prevent XSS
4. **Regular security audits** of cryptographic code
5. **Monitor for** unusual connection patterns

## Compliance Notes

### GDPR

- No persistent storage of personal data on server
- User-controlled data destruction
- No third-party data sharing

### Data Retention

- Messages exist only in client memory/storage
- Server retains no message content
- Metadata retained only during active session

## Audit Trail

The cryptographic implementation should be:

1. **Open source** for public review
2. **Audited** by qualified security researchers
3. **Tested** with established test vectors
4. **Updated** promptly when vulnerabilities are discovered

## References

- [Signal Protocol Specification](https://signal.org/docs/)
- [TweetNaCl](https://tweetnacl.js.org/)
- [X3DH Key Agreement Protocol](https://signal.org/docs/specifications/x3dh/)
- [Double Ratchet Algorithm](https://signal.org/docs/specifications/doubleratchet/)
- [NIST SP 800-38D (GCM)](https://csrc.nist.gov/publications/detail/sp/800-38d/final)
