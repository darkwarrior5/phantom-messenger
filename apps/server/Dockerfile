# Phantom Messenger Server - Render Deployment

## Build
FROM node:20-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY packages/crypto/package*.json ./packages/crypto/
COPY packages/shared/package*.json ./packages/shared/
COPY apps/server/package*.json ./apps/server/

# Install dependencies
RUN npm ci --workspace=@phantom/crypto --workspace=@phantom/shared --workspace=@phantom/server

# Copy source
COPY packages/crypto ./packages/crypto
COPY packages/shared ./packages/shared
COPY apps/server ./apps/server
COPY tsconfig.json ./

# Build packages
RUN npm run build --workspace=@phantom/crypto
RUN npm run build --workspace=@phantom/shared
RUN npm run build --workspace=@phantom/server

# Set production environment
ENV NODE_ENV=production

# Expose port
EXPOSE 8080

# Start server
CMD ["node", "apps/server/dist/index.js"]
