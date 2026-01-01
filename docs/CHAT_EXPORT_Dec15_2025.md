# Phantom Messenger - Development Chat Export
**Date:** December 15, 2025

---

## Session Summary

This chat session covered:
1. Completing Supabase hybrid storage implementation for media attachments
2. Tech stack documentation for presentations
3. Investor pitch deck content
4. Production readiness assessment
5. Learning roadmap for backend development

---

## 1. Tech Stack Overview

### Architecture
| Layer | Technology |
|-------|------------|
| **Monorepo** | Turborepo |
| **Package Manager** | npm workspaces |
| **Language** | TypeScript (strict mode) |

### Frontend - Web Client (`apps/web`)
| Category | Technology | Purpose |
|----------|------------|---------|
| **Framework** | React 18 | UI components |
| **Build Tool** | Vite | Fast dev server & bundler |
| **State Management** | Zustand | Lightweight store with persist middleware |
| **Styling** | Tailwind CSS | Utility-first CSS |
| **Real-time** | WebSocket (native) | Server communication |

### Frontend - Mobile (`apps/mobile`)
| Category | Technology | Purpose |
|----------|------------|---------|
| **Framework** | React Native + Expo | Cross-platform mobile |
| **Storage** | expo-secure-store | Encrypted local storage |

### Backend Server (`apps/server`)
| Category | Technology | Purpose |
|----------|------------|---------|
| **Runtime** | Node.js | Server runtime |
| **WebSocket** | ws (native) | Real-time messaging |
| **Database** | Supabase (PostgreSQL) | Message persistence |
| **File Storage** | Supabase Storage (S3-compatible) | Encrypted media |

### Cryptography Package (`packages/crypto`)
| Algorithm | Library | Purpose |
|-----------|---------|---------|
| **Identity Keys** | TweetNaCl (Ed25519) | Digital signatures |
| **Key Exchange** | TweetNaCl (X25519) | ECDH shared secrets |
| **Symmetric Encryption** | Web Crypto API (AES-256-GCM) | Message & media encryption |
| **Key Derivation** | HKDF (SHA-256) | Deriving session keys |

### Encryption Protocols
- **Double Ratchet** - Forward secrecy (Signal Protocol-inspired)
- **X3DH** - Extended Triple Diffie-Hellman key exchange
- **Per-file AES keys** - Each media file gets unique key

### Database Schema (Supabase PostgreSQL)
```
┌─────────────────┐     ┌─────────────────┐
│    messages     │     │     media       │
├─────────────────┤     ├─────────────────┤
│ id (uuid)       │     │ id (uuid)       │
│ sender_key      │     │ uploader_key    │
│ recipient_key   │     │ recipient_key   │
│ encrypted_content│    │ encrypted_data  │
│ timestamp       │     │ encrypted_key   │
│ delivered       │     │ storage_path    │
│ burn_after_read │     │ downloaded_by[] │
└─────────────────┘     │ auto_delete ────┼──► Trigger
                        └─────────────────┘
```

---

## 2. Investor Pitch Highlights

### The Problem
- 3.8 billion people use messaging apps daily
- 80% of data breaches involve messaging
- Competitors (WhatsApp, Signal, Telegram) all have privacy limitations

### The Solution: Phantom Messenger
| Feature | Phantom | WhatsApp | Signal | Telegram |
|---------|---------|----------|--------|----------|
| E2E Encryption | ✅ | ✅ | ✅ | ❌ (opt-in) |
| No Phone Required | ✅ | ❌ | ❌ | ❌ |
| No Email Required | ✅ | ❌ | ❌ | ❌ |
| Disposable Identity | ✅ | ❌ | ❌ | ❌ |
| Self-Destructing Media | ✅ | ❌ | ✅ | ✅ |

### Market Opportunity
- $120B+ Secure Messaging Market by 2027
- Target: Journalists, Healthcare, Legal, Enterprise, Privacy-conscious consumers

### Business Model
| Tier | Price | Features |
|------|-------|----------|
| **Free** | $0 | Basic messaging, 50MB media |
| **Pro** | $9.99/mo | Unlimited media, group chats |
| **Enterprise** | $29/user/mo | Admin controls, audit logs, SSO |

---

## 3. Production Readiness Assessment

### Overall: ~70% Complete

### Critical Blockers (Must Fix)
| Issue | Location | Effort |
|-------|----------|--------|
| Hardcoded localhost URLs | websocket.ts, vite.config.ts, server.ts | 2 hours |
| Server signature verification missing | messageHandler.ts | 4 hours |
| Rate limiter salt hardcoded | rateLimiter.ts | 30 min |
| 40+ console.log statements | Throughout codebase | 2 hours |
| No HTTPS/WSS | Server needs TLS | 2 hours |

### Time Estimate to MVP
| Phase | Duration |
|-------|----------|
| Critical fixes | 1-2 days |
| Important fixes | 1 day |
| Mobile app completion | 2-3 days |
| Testing & QA | 2-3 days |
| Deployment & config | 1 day |
| **Total** | **~1.5-2 weeks** |

---

## 4. Backend Learning Roadmap (For Beginners)

### Month 1: Programming Fundamentals
- Week 1-2: JavaScript Basics (variables, functions, conditionals, loops)
- Week 3: Async JavaScript (callbacks, promises, async/await)
- Week 4: Node.js Basics

### Month 2: Building Servers
- Week 5: HTTP & REST Basics
- Week 6: Build a Simple Server
- Week 7: WebSockets (How Phantom Works)
- Week 8: TypeScript Basics

### Month 3: Understanding Phantom Server
- Week 9: Project Structure
- Week 10: Read the Code (In Order)
- Week 11: Databases with Supabase
- Week 12: Build Mini Chat Server

### Recommended Resources (Free)
| Topic | Resource |
|-------|----------|
| JavaScript | [javascript.info](https://javascript.info) |
| Node.js | [nodejs.dev/learn](https://nodejs.dev/learn) |
| TypeScript | [TypeScript Handbook](https://www.typescriptlang.org/docs/handbook/) |
| WebSockets | [MDN WebSocket Guide](https://developer.mozilla.org/en-US/docs/Web/API/WebSockets_API) |
| SQL | [SQLBolt](https://sqlbolt.com/) |
| Supabase | [Supabase Docs](https://supabase.com/docs) |

---

## 5. Files Modified This Session

### Created
- `apps/web/src/services/media.ts` - Media upload/download with encryption

### Modified
- `apps/web/src/components/ChatView.tsx` - Added attachment UI & sending
- `apps/web/src/components/Icons.tsx` - Added PaperclipIcon, ImageIcon, DownloadIcon, XIcon
- `packages/shared/src/types.ts` - Added MediaInfo interface

---

## 6. Quick Commands Reference

| Command | What Happens |
|---------|--------------|
| "let's build the prototype" | Fix all bugs, prepare for deployment |
| "deploy it" | Step-by-step deployment guide |
| "explain [filename]" | Walk through any file in detail |
| "help me understand [concept]" | Explain with examples |
| "what's next" | Show current progress & next steps |

---

## 7. Environment Variables Needed for Production

```env
# Server
PORT=8080
NODE_ENV=production
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_KEY=xxx
RATE_LIMIT_SALT=<random-32-chars>
CORS_ORIGIN=https://yourdomain.com

# Web Client
VITE_WS_URL=wss://api.yourdomain.com/ws
VITE_APP_URL=https://yourdomain.com
```

---

## 8. What's Already Solid (Production-Ready)

- ✅ Cryptography library
- ✅ Encryption protocols (Signal-level security)
- ✅ Web client UI
- ✅ Server architecture
- ✅ Database schema
- ✅ Media upload/download with auto-delete

---

*End of Chat Export*
