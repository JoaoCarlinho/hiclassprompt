#!/usr/bin/env node

/**
 * Server Entry Point
 * Starts the Express API server for production
 */

import { ResultAPI } from './result-api';
import { ResultStore } from '../core/result-store';
import { logger } from '../utils/logger';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

async function main() {
  try {
    // Initialize result store (in-memory for now, can be backed by Redis/DB)
    const resultStore = new ResultStore();

    // Create and start API server
    const api = new ResultAPI(resultStore, {
      port: parseInt(process.env.PORT || '3000', 10),
      apiKey: process.env.API_KEY,
      enableRateLimit: true,
      enableCors: true,
    });

    await api.start();

    logger.info('Server started successfully', {
      port: process.env.PORT || 3000,
      environment: process.env.NODE_ENV || 'development',
    });

    // Graceful shutdown
    const shutdown = async (signal: string) => {
      logger.info(`Received ${signal}, starting graceful shutdown`);

      try {
        await api.stop();
        logger.info('Server stopped successfully');
        process.exit(0);
      } catch (error) {
        logger.error('Error during shutdown', { error });
        process.exit(1);
      }
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));

  } catch (error) {
    logger.error('Failed to start server', { error });
    process.exit(1);
  }
}

main();
