#!/usr/bin/env node

/**
 * Server Entry Point
 * Starts the Express API server for production
 */

import { Application } from './app';
import { logger } from '../utils/logger';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

async function main() {
  try {
    // Create and start application
    const app = new Application({
      port: parseInt(process.env.PORT || '3000', 10),
      apiKey: process.env.API_KEY,
      enableRateLimit: true,
      enableCors: true,
      corsOrigin: process.env.CORS_ORIGIN || '*'
    });

    await app.start();

    logger.info('Application started successfully', {
      port: process.env.PORT || 3000,
      environment: process.env.NODE_ENV || 'development',
    });

    // Graceful shutdown
    const shutdown = async (signal: string) => {
      logger.info(`Received ${signal}, starting graceful shutdown`);

      try {
        await app.stop();
        logger.info('Application stopped successfully');
        process.exit(0);
      } catch (error) {
        logger.error('Error during shutdown', { error });
        process.exit(1);
      }
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('uncaughtException', (error) => {
      logger.error('Uncaught exception', { error });
      shutdown('UNCAUGHT_EXCEPTION');
    });
    process.on('unhandledRejection', (reason) => {
      logger.error('Unhandled rejection', { reason });
      shutdown('UNHANDLED_REJECTION');
    });

  } catch (error) {
    logger.error('Failed to start application', { error });
    process.exit(1);
  }
}

main();
