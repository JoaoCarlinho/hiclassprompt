/**
 * Express Application
 * Main application setup with all routes and middleware
 */

import express, { Express, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { Server as HTTPServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import { ResultStore } from '../core/result-store';
import { CostTracker } from '../core/cost-tracker';
import { BudgetManager } from '../core/budget-manager';
import { createCostsRouter } from './costs-api';
import { createBatchRouter, setupBatchWebSocket } from './batch-api';
import authRouter from './routes/auth';
import analyticsRouter from './routes/analytics';
import exportsRouter from './routes/exports';
import promptVersionsRouter from './routes/promptVersions';
import dashboardRouter from './routes/dashboard';
import { logger } from '../utils/logger';

export interface AppConfig {
  port?: number;
  apiKey?: string;
  enableRateLimit?: boolean;
  rateLimitWindowMs?: number;
  rateLimitMaxRequests?: number;
  enableCors?: boolean;
  corsOrigin?: string | string[];
}

export class Application {
  private app: Express;
  private server?: HTTPServer;
  private io?: SocketIOServer;
  private config: Required<AppConfig>;
  private resultStore: ResultStore;
  private costTracker: CostTracker;
  private budgetManager: BudgetManager;

  constructor(config: AppConfig = {}) {
    this.app = express();
    this.config = {
      port: config.port || parseInt(process.env.PORT || '3000', 10),
      apiKey: config.apiKey || process.env.API_KEY || '',
      enableRateLimit: config.enableRateLimit ?? true,
      rateLimitWindowMs: config.rateLimitWindowMs || 15 * 60 * 1000,
      rateLimitMaxRequests: config.rateLimitMaxRequests || 100,
      enableCors: config.enableCors ?? true,
      corsOrigin: config.corsOrigin || process.env.CORS_ORIGIN || '*'
    };

    this.resultStore = new ResultStore();
    this.costTracker = new CostTracker();
    this.budgetManager = new BudgetManager({
      monthlyLimit: 1000,
      dailyLimit: 100,
      perRequestLimit: 1
    }, this.costTracker);

    this.setupMiddleware();
    this.setupRoutes();
    this.setupErrorHandling();
  }

  private setupMiddleware(): void {
    // Security headers
    this.app.use(helmet());

    // CORS
    if (this.config.enableCors) {
      this.app.use(cors({
        origin: this.config.corsOrigin,
        credentials: true
      }));
    }

    // JSON parsing
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true, limit: '10mb' }));

    // Rate limiting
    if (this.config.enableRateLimit) {
      const limiter = rateLimit({
        windowMs: this.config.rateLimitWindowMs,
        max: this.config.rateLimitMaxRequests,
        message: { error: 'Too many requests, please try again later' },
        standardHeaders: true,
        legacyHeaders: false,
      });
      this.app.use('/api/', limiter);
    }

    // Request logging
    this.app.use((req: Request, _res: Response, next: NextFunction) => {
      logger.info('API request', {
        method: req.method,
        path: req.path,
        query: req.query,
        ip: req.ip
      });
      next();
    });

    // API key authentication middleware (optional)
    if (this.config.apiKey) {
      this.app.use('/api/', (req: Request, res: Response, next: NextFunction) => {
        // Skip authentication for health endpoints
        if (req.path.startsWith('/health')) {
          return next();
        }

        const apiKey = req.headers['x-api-key'] as string;

        if (!apiKey || apiKey !== this.config.apiKey) {
          return res.status(401).json({ error: 'Invalid or missing API key' });
        }

        next();
      });
    }
  }

  private setupRoutes(): void {
    // Health check endpoints
    this.app.get('/health', (_req: Request, res: Response) => {
      res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        service: 'hiclassprompt-backend',
        version: process.env.VERSION || '1.0.0'
      });
    });

    this.app.get('/health/ready', (_req: Request, res: Response) => {
      // Check if services are ready
      const ready = true; // TODO: Add actual health checks
      if (ready) {
        res.json({ status: 'ready' });
      } else {
        res.status(503).json({ status: 'not ready' });
      }
    });

    // API routes
    this.app.use('/api/costs', createCostsRouter(this.costTracker, this.budgetManager));
    this.app.use('/api/batch', createBatchRouter(this.io));
    this.app.use('/api/auth', authRouter);
    this.app.use('/api/analytics', analyticsRouter);
    this.app.use('/api/exports', exportsRouter);
    this.app.use('/api/dashboard', dashboardRouter);
    this.app.use('/api', promptVersionsRouter);

    // Classification endpoint
    this.app.post('/api/classify', async (req: Request, res: Response) => {
      try {
        const { imagePath, provider, prompt } = req.body;

        // TODO: Implement actual classification
        const result = {
          id: `class-${Date.now()}`,
          imagePath,
          provider,
          category: 'Electronics',
          confidence: 0.95,
          reasoning: 'Image appears to be an electronic device',
          latencyMs: 850,
          tokensInput: 10000,
          tokensOutput: 500,
          costUsd: 0.000075,
          timestamp: new Date().toISOString()
        };

        // Track cost
        this.costTracker.recordCost(result as any);

        res.json(result);
      } catch (error) {
        logger.error('Classification failed', { error });
        res.status(500).json({ error: 'Classification failed' });
      }
    });

    // Results endpoint
    this.app.get('/api/results', async (req: Request, res: Response) => {
      try {
        const page = parseInt(req.query.page as string) || 1;
        const limit = parseInt(req.query.limit as string) || 20;
        const provider = req.query.provider as string;

        const results = this.resultStore.search({
          provider,
          limit,
          offset: (page - 1) * limit
        });

        res.json({
          results,
          page,
          limit,
          total: this.resultStore.count()
        });
      } catch (error) {
        logger.error('Failed to get results', { error });
        res.status(500).json({ error: 'Failed to retrieve results' });
      }
    });

    // 404 handler
    this.app.use((_req: Request, res: Response) => {
      res.status(404).json({ error: 'Not found' });
    });
  }

  private setupErrorHandling(): void {
    this.app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
      logger.error('Unhandled error', { error: err });
      res.status(500).json({
        error: 'Internal server error',
        message: process.env.NODE_ENV === 'development' ? err.message : undefined
      });
    });
  }

  async start(): Promise<void> {
    return new Promise((resolve) => {
      this.server = this.app.listen(this.config.port, () => {
        logger.info('Server started', {
          port: this.config.port,
          environment: process.env.NODE_ENV || 'development'
        });

        // Setup WebSocket if server is running
        if (this.server) {
          this.io = new SocketIOServer(this.server, {
            cors: {
              origin: this.config.corsOrigin,
              methods: ['GET', 'POST']
            }
          });

          setupBatchWebSocket(this.io);
          logger.info('WebSocket server initialized');
        }

        resolve();
      });
    });
  }

  async stop(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.server) {
        return resolve();
      }

      // Close WebSocket connections
      if (this.io) {
        this.io.close();
      }

      this.server.close((err) => {
        if (err) {
          return reject(err);
        }
        logger.info('Server stopped');
        resolve();
      });
    });
  }

  getApp(): Express {
    return this.app;
  }
}
