#!/usr/bin/env node

import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { ToolOrchestrationMCPServer } from './server.js';
import { logger } from './utils/logger.js';

// Handle uncaught exceptions and unhandled rejections
process.on('uncaughtException', (error) => {
  logger.error('Uncaught exception', { error: error.message, stack: error.stack });
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled rejection', { reason: String(reason), promise });
  process.exit(1);
});

// Handle process termination signals
process.on('SIGINT', async () => {
  logger.info('Received SIGINT, shutting down gracefully...');
  await shutdown();
});

process.on('SIGTERM', async () => {
  logger.info('Received SIGTERM, shutting down gracefully...');
  await shutdown();
});

let server: ToolOrchestrationMCPServer | null = null;

async function shutdown(): Promise<void> {
  if (server) {
    try {
      await server.cleanup();
      logger.info('Server shutdown completed');
    } catch (error) {
      logger.error('Error during shutdown', error);
    }
  }
  process.exit(0);
}

async function main(): Promise<void> {
  try {
    logger.info('Starting Package README Core MCP Server...');

    // Create and initialize server
    server = new ToolOrchestrationMCPServer();
    await server.initialize();

    // Create transport
    const transport = new StdioServerTransport();

    // Connect server to transport
    await server.getServer().connect(transport);

    logger.info('Package README Core MCP Server is running');

  } catch (error) {
    logger.error('Failed to start server', error);
    process.exit(1);
  }
}

// Start the server
main().catch((error) => {
  logger.error('Fatal error during startup', error);
  process.exit(1);
});