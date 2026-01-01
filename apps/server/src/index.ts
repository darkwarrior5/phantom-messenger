/**
 * Phantom Messenger Server - Entry Point
 */

import 'dotenv/config';
import { PhantomServer } from './server.js';
import { loadConfig, validateConfig } from './config.js';

async function main() {
  console.log('╔════════════════════════════════════════╗');
  console.log('║       PHANTOM MESSENGER SERVER         ║');
  console.log('║     Zero-Knowledge Architecture        ║');
  console.log('╚════════════════════════════════════════╝');
  console.log('');

  // Load and validate configuration
  const config = loadConfig();
  validateConfig(config);

  // Create and start server
  const server = new PhantomServer(config);
  
  try {
    await server.start();
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }

  // Graceful shutdown handlers
  const shutdown = async (signal: string) => {
    console.log(`\n[${signal}] Shutting down gracefully...`);
    await server.stop();
    process.exit(0);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

  // Handle uncaught errors (don't log details for privacy)
  process.on('uncaughtException', (error) => {
    console.error('[Fatal] Uncaught exception');
    process.exit(1);
  });

  process.on('unhandledRejection', (reason) => {
    console.error('[Fatal] Unhandled rejection');
    process.exit(1);
  });
}

main();
