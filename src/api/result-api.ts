/**
 * Result API
 * REST API endpoints for querying classification results
 */

import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { ResultStore, SearchCriteria } from '../core/result-store';
import { logger } from '../utils/logger';
import type { AIProvider } from '../types';

/**
 * API configuration
 */
export interface APIConfig {
  port?: number;
  apiKey?: string;
  enableRateLimit?: boolean;
  rateLimitWindowMs?: number;
  rateLimitMaxRequests?: number;
  enableCors?: boolean;
}

/**
 * API error response
 */
interface ErrorResponse {
  error: string;
  message: string;
  statusCode: number;
}

/**
 * Result API server
 */
export class ResultAPI {
  private app = express();
  private server?: ReturnType<typeof this.app.listen>;
  private config: Required<APIConfig>;

  constructor(
    private resultStore: ResultStore,
    config: APIConfig = {}
  ) {
    this.config = {
      port: config.port || 3000,
      apiKey: config.apiKey || process.env.API_KEY || '',
      enableRateLimit: config.enableRateLimit ?? true,
      rateLimitWindowMs: config.rateLimitWindowMs || 15 * 60 * 1000, // 15 minutes
      rateLimitMaxRequests: config.rateLimitMaxRequests || 100,
      enableCors: config.enableCors ?? true,
    };

    this.setupMiddleware();
    this.setupRoutes();
    this.setupErrorHandling();
  }

  /**
   * Setup Express middleware
   */
  private setupMiddleware(): void {
    // Security headers
    this.app.use(helmet());

    // CORS
    if (this.config.enableCors) {
      this.app.use(cors());
    }

    // JSON parsing
    this.app.use(express.json());

    // Rate limiting
    if (this.config.enableRateLimit) {
      const limiter = rateLimit({
        windowMs: this.config.rateLimitWindowMs,
        max: this.config.rateLimitMaxRequests,
        message: 'Too many requests, please try again later',
      });
      this.app.use('/api/', limiter);
    }

    // Request logging
    this.app.use((req: Request, _res: Response, next: NextFunction) => {
      logger.info('API request', {
        method: req.method,
        path: req.path,
        query: req.query,
      });
      next();
    });

    // API key authentication
    if (this.config.apiKey) {
      this.app.use('/api/', (req: Request, res: Response, next: NextFunction) => {
        const apiKey = req.headers['x-api-key'] as string;

        if (apiKey !== this.config.apiKey) {
          res.status(401).json({
            error: 'Unauthorized',
            message: 'Invalid or missing API key',
            statusCode: 401,
          } as ErrorResponse);
          return;
        }

        next();
      });
    }
  }

  /**
   * Setup API routes
   */
  private setupRoutes(): void {
    // Health check
    this.app.get('/health', (_req: Request, res: Response) => {
      res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        resultCount: this.resultStore.getCount(),
      });
    });

    // List all results with pagination
    this.app.get('/api/results', (req: Request, res: Response) => {
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 100;
      const offset = req.query.offset ? parseInt(req.query.offset as string) : 0;

      const results = this.resultStore.getResults(limit, offset);

      res.json({
        results,
        count: results.length,
        total: this.resultStore.getCount(),
        limit,
        offset,
      });
    });

    // Get specific result by ID
    this.app.get('/api/results/:id', (req: Request, res: Response) => {
      const id = req.params.id;
      if (!id) {
        res.status(400).json({
          error: 'Bad Request',
          message: 'Missing result ID',
          statusCode: 400,
        } as ErrorResponse);
        return;
      }

      const result = this.resultStore.getResult(id);

      if (!result) {
        res.status(404).json({
          error: 'Not Found',
          message: `Result with ID ${req.params.id} not found`,
          statusCode: 404,
        } as ErrorResponse);
        return;
      }

      res.json(result);
    });

    // Get batch results
    this.app.get('/api/batches/:batchId/results', (req: Request, res: Response) => {
      const batchId = req.params.batchId;
      if (!batchId) {
        res.status(400).json({
          error: 'Bad Request',
          message: 'Missing batch ID',
          statusCode: 400,
        } as ErrorResponse);
        return;
      }

      const results = this.resultStore.getBatchResults(batchId);

      res.json({
        batchId: req.params.batchId,
        results,
        count: results.length,
      });
    });

    // Get list of batch IDs
    this.app.get('/api/batches', (_req: Request, res: Response) => {
      const batchIds = this.resultStore.getBatchIds();

      res.json({
        batches: batchIds,
        count: batchIds.length,
      });
    });

    // Get aggregated statistics
    this.app.get('/api/stats', (_req: Request, res: Response) => {
      const stats = this.resultStore.getStats();

      // Convert Map to object for JSON serialization
      const byProvider: Record<string, unknown> = {};
      for (const [provider, data] of stats.byProvider) {
        byProvider[provider] = data;
      }

      res.json({
        ...stats,
        byProvider,
      });
    });

    // Search results by criteria
    this.app.post('/api/search', (req: Request, res: Response) => {
      const criteria: SearchCriteria = {
        provider: req.body.provider as AIProvider | undefined,
        minConfidence: req.body.minConfidence,
        maxConfidence: req.body.maxConfidence,
        category: req.body.category,
        startDate: req.body.startDate ? new Date(req.body.startDate) : undefined,
        endDate: req.body.endDate ? new Date(req.body.endDate) : undefined,
        batchId: req.body.batchId,
      };

      const limit = req.body.limit || 100;
      const offset = req.body.offset || 0;

      const results = this.resultStore.search(criteria, limit, offset);

      res.json({
        results,
        count: results.length,
        criteria,
        limit,
        offset,
      });
    });

    // API documentation
    this.app.get('/api', (_req: Request, res: Response) => {
      res.json({
        name: 'Classification Results API',
        version: '1.0.0',
        endpoints: [
          {
            method: 'GET',
            path: '/health',
            description: 'Health check endpoint',
          },
          {
            method: 'GET',
            path: '/api/results',
            description: 'List all results with pagination',
            params: ['limit', 'offset'],
          },
          {
            method: 'GET',
            path: '/api/results/:id',
            description: 'Get specific result by ID',
          },
          {
            method: 'GET',
            path: '/api/batches',
            description: 'List all batch IDs',
          },
          {
            method: 'GET',
            path: '/api/batches/:batchId/results',
            description: 'Get results for a specific batch',
          },
          {
            method: 'GET',
            path: '/api/stats',
            description: 'Get aggregated statistics',
          },
          {
            method: 'POST',
            path: '/api/search',
            description: 'Search results by criteria',
            body: {
              provider: 'string (optional)',
              minConfidence: 'number (optional)',
              maxConfidence: 'number (optional)',
              category: 'string (optional)',
              startDate: 'ISO date string (optional)',
              endDate: 'ISO date string (optional)',
              batchId: 'string (optional)',
              limit: 'number (default: 100)',
              offset: 'number (default: 0)',
            },
          },
        ],
      });
    });
  }

  /**
   * Setup error handling
   */
  private setupErrorHandling(): void {
    // 404 handler
    this.app.use((_req: Request, res: Response) => {
      res.status(404).json({
        error: 'Not Found',
        message: 'The requested endpoint does not exist',
        statusCode: 404,
      } as ErrorResponse);
    });

    // Error handler
    this.app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
      logger.error('API error', {
        error: err.message,
        stack: err.stack,
      });

      res.status(500).json({
        error: 'Internal Server Error',
        message: err.message,
        statusCode: 500,
      } as ErrorResponse);
    });
  }

  /**
   * Start the API server
   * @param port - Optional port number (overrides config)
   * @returns Promise that resolves when server is listening
   */
  start(port?: number): Promise<void> {
    const serverPort = port || this.config.port;

    return new Promise((resolve) => {
      this.server = this.app.listen(serverPort, () => {
        logger.info('Result API server started', {
          port: serverPort,
          apiKeyRequired: !!this.config.apiKey,
          rateLimitEnabled: this.config.enableRateLimit,
        });
        resolve();
      });
    });
  }

  /**
   * Stop the API server
   * @returns Promise that resolves when server is closed
   */
  stop(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.server) {
        resolve();
        return;
      }

      this.server.close((err) => {
        if (err) {
          logger.error('Error stopping API server', { error: err.message });
          reject(err);
        } else {
          logger.info('Result API server stopped');
          resolve();
        }
      });
    });
  }

  /**
   * Get Express app instance (for testing)
   * @returns Express application
   */
  getApp(): express.Application {
    return this.app;
  }
}
