/**
 * Phantom Messenger Server - Configuration
 */

import type { ServerConfig } from './types.js';

export interface SupabaseConfig {
  url: string;
  anonKey: string;
  serviceRoleKey?: string | undefined;
}

export function loadConfig(): ServerConfig & { supabase: SupabaseConfig } {
  return {
    port: parseInt(process.env['PORT'] ?? '8080', 10),
    host: process.env['HOST'] ?? '0.0.0.0',
    enableRateLimiting: process.env['ENABLE_RATE_LIMITING'] !== 'false',
    maxConnectionsPerIP: parseInt(process.env['MAX_CONNECTIONS_PER_IP'] ?? '5', 10),
    requireInvitation: process.env['REQUIRE_INVITATION'] !== 'false',
    pingInterval: parseInt(process.env['WS_PING_INTERVAL'] ?? '30000', 10),
    pingTimeout: parseInt(process.env['WS_PING_TIMEOUT'] ?? '10000', 10),
    corsOrigin: process.env['CORS_ORIGIN'] ?? 'http://localhost:3000',
    
    // Supabase configuration
    supabase: {
      url: process.env['SUPABASE_URL'] ?? '',
      anonKey: process.env['SUPABASE_ANON_KEY'] ?? '',
      serviceRoleKey: process.env['SUPABASE_SERVICE_ROLE_KEY'] ?? undefined
    }
  };
}

export function validateConfig(config: ServerConfig & { supabase: SupabaseConfig }): void {
  if (config.port < 1 || config.port > 65535) {
    throw new Error('Invalid port number');
  }
  
  if (config.maxConnectionsPerIP < 1) {
    throw new Error('Invalid max connections per IP');
  }
  
  if (config.pingInterval < 5000) {
    throw new Error('Ping interval too short');
  }
  
  // Supabase is optional - falls back to in-memory store
  if (config.supabase.url && !config.supabase.anonKey) {
    throw new Error('SUPABASE_ANON_KEY required when SUPABASE_URL is set');
  }
}
