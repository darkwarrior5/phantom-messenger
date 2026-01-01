# Deployment Guide

## Overview

This guide covers deploying Phantom Messenger in production environments. The system consists of:

1. **WebSocket Server** - Handles real-time messaging
2. **Web Client** - React-based web application
3. **Mobile Apps** - React Native iOS/Android applications

## Prerequisites

- Node.js 18+ (LTS recommended)
- npm 9+ or pnpm 8+
- Docker (optional, for containerized deployment)
- SSL certificates for production
- Domain name configured

## Server Deployment

### Option 1: Direct Node.js

#### Build

```bash
# Install dependencies
npm install

# Build all packages
npm run build

# Or build server only
npm run build --filter=@phantom/server
```

#### Configuration

Create `.env` in `apps/server/`:

```env
# Server Configuration
PORT=8080
HOST=0.0.0.0
NODE_ENV=production

# Security
MAX_CONNECTIONS=10000
RATE_LIMIT_WINDOW=60000
RATE_LIMIT_MAX=100

# Logging
LOG_LEVEL=info

# Optional: External services
# REDIS_URL=redis://localhost:6379
```

#### Run

```bash
# Production
NODE_ENV=production node apps/server/dist/index.js

# Or with PM2
pm2 start apps/server/dist/index.js --name phantom-server
```

### Option 2: Docker

#### Dockerfile

```dockerfile
# apps/server/Dockerfile
FROM node:18-alpine AS builder

WORKDIR /app
COPY package*.json ./
COPY packages ./packages
COPY apps/server ./apps/server
COPY tsconfig.json turbo.json ./

RUN npm ci
RUN npm run build --filter=@phantom/server

FROM node:18-alpine AS runner

WORKDIR /app
ENV NODE_ENV=production

COPY --from=builder /app/apps/server/dist ./dist
COPY --from=builder /app/apps/server/package.json ./
COPY --from=builder /app/node_modules ./node_modules

EXPOSE 8080

USER node
CMD ["node", "dist/index.js"]
```

#### Build & Run

```bash
# Build image
docker build -t phantom-server -f apps/server/Dockerfile .

# Run container
docker run -d \
  --name phantom-server \
  -p 8080:8080 \
  -e NODE_ENV=production \
  phantom-server
```

### Option 3: Docker Compose

```yaml
# docker-compose.yml
version: '3.8'

services:
  server:
    build:
      context: .
      dockerfile: apps/server/Dockerfile
    ports:
      - "8080:8080"
    environment:
      - NODE_ENV=production
      - PORT=8080
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "wget", "-q", "--spider", "http://localhost:8080/health"]
      interval: 30s
      timeout: 10s
      retries: 3

  web:
    build:
      context: .
      dockerfile: apps/web/Dockerfile
    ports:
      - "3000:80"
    depends_on:
      - server
    restart: unless-stopped
```

## Web Client Deployment

### Build

```bash
# Build web client
npm run build --filter=@phantom/web

# Output in apps/web/dist/
```

### Static Hosting (Recommended)

The web client is a static SPA that can be hosted on:

- **Vercel**: `vercel deploy apps/web`
- **Netlify**: Connect repository, set build command
- **Cloudflare Pages**: Zero-config deployment
- **AWS S3 + CloudFront**: Static hosting with CDN
- **Nginx**: Traditional web server

### Nginx Configuration

```nginx
server {
    listen 443 ssl http2;
    server_name phantom.example.com;

    ssl_certificate /etc/ssl/certs/phantom.crt;
    ssl_certificate_key /etc/ssl/private/phantom.key;

    # Security headers
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header X-Frame-Options "DENY" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Content-Security-Policy "default-src 'self'; connect-src 'self' wss://api.phantom.example.com; script-src 'self'; style-src 'self' 'unsafe-inline';" always;

    root /var/www/phantom/dist;
    index index.html;

    # SPA routing
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Cache static assets
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # WebSocket proxy
    location /ws {
        proxy_pass http://localhost:8080;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_read_timeout 86400;
    }
}
```

### Environment Variables

Create `.env.production` in `apps/web/`:

```env
VITE_WS_URL=wss://api.phantom.example.com/ws
VITE_APP_NAME=Phantom Messenger
```

## Mobile App Deployment

### iOS (App Store)

1. **Configure Xcode project**:
   ```bash
   cd apps/mobile/ios
   pod install
   ```

2. **Update Bundle Identifier** in Xcode

3. **Configure signing**:
   - Add Apple Developer Team
   - Enable capabilities (Keychain, Push Notifications)

4. **Build for release**:
   ```bash
   npm run ios -- --configuration Release
   ```

5. **Archive and upload** via Xcode or Fastlane

### Android (Play Store)

1. **Generate signing key**:
   ```bash
   keytool -genkey -v -keystore phantom-release.keystore \
     -alias phantom -keyalg RSA -keysize 2048 -validity 10000
   ```

2. **Configure `gradle.properties`**:
   ```properties
   PHANTOM_RELEASE_STORE_FILE=phantom-release.keystore
   PHANTOM_RELEASE_KEY_ALIAS=phantom
   PHANTOM_RELEASE_STORE_PASSWORD=****
   PHANTOM_RELEASE_KEY_PASSWORD=****
   ```

3. **Build APK/AAB**:
   ```bash
   cd apps/mobile/android
   ./gradlew bundleRelease
   ```

4. **Upload** to Play Console

## Infrastructure Recommendations

### Production Architecture

```
                    ┌─────────────┐
                    │   CloudFlare │
                    │     (CDN)    │
                    └──────┬──────┘
                           │
           ┌───────────────┼───────────────┐
           │               │               │
    ┌──────▼──────┐ ┌──────▼──────┐ ┌──────▼──────┐
    │  Web Client │ │  Web Client │ │  Web Client │
    │  (Static)   │ │  (Static)   │ │  (Static)   │
    └─────────────┘ └─────────────┘ └─────────────┘
                           │
                    ┌──────▼──────┐
                    │    Load     │
                    │  Balancer   │
                    └──────┬──────┘
                           │
           ┌───────────────┼───────────────┐
           │               │               │
    ┌──────▼──────┐ ┌──────▼──────┐ ┌──────▼──────┐
    │   Server    │ │   Server    │ │   Server    │
    │  (Node.js)  │ │  (Node.js)  │ │  (Node.js)  │
    └─────────────┘ └─────────────┘ └─────────────┘
                           │
                    ┌──────▼──────┐
                    │    Redis    │
                    │  (Pub/Sub)  │
                    └─────────────┘
```

### Scaling Considerations

1. **WebSocket Connections**:
   - Use sticky sessions or Redis pub/sub for multi-server
   - Each server handles ~10,000 connections

2. **Static Assets**:
   - CDN for global distribution
   - Enable Brotli/gzip compression

3. **Database** (if adding persistence):
   - PostgreSQL for relational data
   - Redis for sessions and pub/sub

## Monitoring & Logging

### Health Endpoints

```javascript
// Add to server
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    uptime: process.uptime(),
    connections: connectionManager.getConnectionCount(),
    timestamp: Date.now()
  });
});
```

### Logging

Use structured logging:

```javascript
// apps/server/src/logger.ts
import pino from 'pino';

export const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  transport: process.env.NODE_ENV === 'production' 
    ? undefined 
    : { target: 'pino-pretty' }
});
```

### Metrics (Optional)

Prometheus metrics:

```javascript
import promClient from 'prom-client';

const connectionGauge = new promClient.Gauge({
  name: 'phantom_connections_total',
  help: 'Total active WebSocket connections'
});

const messageCounter = new promClient.Counter({
  name: 'phantom_messages_total',
  help: 'Total messages relayed'
});
```

## Security Checklist

### Server
- [ ] TLS 1.3 enabled
- [ ] Rate limiting configured
- [ ] No sensitive data logged
- [ ] Firewall rules (only 443/8080)
- [ ] Regular security updates

### Web Client
- [ ] CSP headers configured
- [ ] HTTPS only
- [ ] No inline scripts
- [ ] Subresource integrity
- [ ] HSTS enabled

### Mobile Apps
- [ ] Certificate pinning
- [ ] Keychain/Keystore for secrets
- [ ] ProGuard/R8 obfuscation
- [ ] No debug builds in production

## Backup & Recovery

Since the server stores no persistent data, backup focuses on:

1. **Configuration files**
2. **SSL certificates**
3. **Environment variables**
4. **Infrastructure as Code** (Terraform, Pulumi)

## Troubleshooting

### Common Issues

1. **WebSocket connection fails**
   - Check CORS configuration
   - Verify SSL certificate
   - Check firewall rules

2. **High memory usage**
   - Monitor connection count
   - Check for memory leaks in handlers
   - Implement connection limits

3. **Slow message delivery**
   - Check network latency
   - Monitor server CPU
   - Consider geographic distribution

### Debug Mode

Enable debug logging:

```bash
LOG_LEVEL=debug node apps/server/dist/index.js
```

## Support

For issues or questions:
- GitHub Issues: [project-repo/issues]
- Security issues: security@example.com
