/**
 * Batch API Endpoints
 * Handles batch job creation, status, and WebSocket updates
 */

import { Router, Request, Response } from 'express';
import { Server as SocketIOServer } from 'socket.io';
import { BatchResultManager } from '../core/batch-result-manager';
import { logger } from '../utils/logger';
import { v4 as uuidv4 } from 'uuid';

export interface BatchJob {
  id: string;
  userId: string;
  name: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  totalImages: number;
  processedImages: number;
  successfulImages: number;
  failedImages: number;
  progress: number;
  startedAt?: Date;
  completedAt?: Date;
  createdAt: Date;
}

// In-memory store (replace with database in production)
const batchJobs = new Map<string, BatchJob>();

export function createBatchRouter(io?: SocketIOServer): Router {
  const router = Router();

  // Create a new batch job
  router.post('/', async (req: Request, res: Response) => {
    try {
      const { name, images, provider } = req.body;

      const jobId = uuidv4();
      const job: BatchJob = {
        id: jobId,
        userId: req.body.userId || 'anonymous',
        name: name || `Batch Job ${jobId.slice(0, 8)}`,
        status: 'pending',
        totalImages: images?.length || 0,
        processedImages: 0,
        successfulImages: 0,
        failedImages: 0,
        progress: 0,
        createdAt: new Date()
      };

      batchJobs.set(jobId, job);

      // Emit to WebSocket
      if (io) {
        io.emit('batch:created', job);
      }

      logger.info('Batch job created', { jobId, totalImages: job.totalImages });

      res.status(201).json(job);
    } catch (error) {
      logger.error('Failed to create batch job', { error });
      res.status(500).json({ error: 'Failed to create batch job' });
    }
  });

  // Get all batch jobs
  router.get('/', async (req: Request, res: Response) => {
    try {
      const userId = req.query.userId as string;
      const status = req.query.status as string;

      let jobs = Array.from(batchJobs.values());

      if (userId) {
        jobs = jobs.filter(job => job.userId === userId);
      }

      if (status) {
        jobs = jobs.filter(job => job.status === status);
      }

      // Sort by created date descending
      jobs.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

      res.json({ jobs, total: jobs.length });
    } catch (error) {
      logger.error('Failed to get batch jobs', { error });
      res.status(500).json({ error: 'Failed to retrieve batch jobs' });
    }
  });

  // Get specific batch job
  router.get('/:id', async (req: Request, res: Response) => {
    try {
      const job = batchJobs.get(req.params.id);

      if (!job) {
        return res.status(404).json({ error: 'Batch job not found' });
      }

      res.json(job);
    } catch (error) {
      logger.error('Failed to get batch job', { error });
      res.status(500).json({ error: 'Failed to retrieve batch job' });
    }
  });

  // Update batch job progress (internal endpoint)
  router.patch('/:id', async (req: Request, res: Response) => {
    try {
      const job = batchJobs.get(req.params.id);

      if (!job) {
        return res.status(404).json({ error: 'Batch job not found' });
      }

      // Update fields
      Object.assign(job, req.body);
      job.progress = (job.processedImages / job.totalImages) * 100;

      if (job.processedImages >= job.totalImages && job.status === 'running') {
        job.status = 'completed';
        job.completedAt = new Date();
      }

      batchJobs.set(job.id, job);

      // Emit to WebSocket
      if (io) {
        io.emit('batch:updated', job);
      }

      res.json(job);
    } catch (error) {
      logger.error('Failed to update batch job', { error });
      res.status(500).json({ error: 'Failed to update batch job' });
    }
  });

  // Start batch job
  router.post('/:id/start', async (req: Request, res: Response) => {
    try {
      const job = batchJobs.get(req.params.id);

      if (!job) {
        return res.status(404).json({ error: 'Batch job not found' });
      }

      job.status = 'running';
      job.startedAt = new Date();
      batchJobs.set(job.id, job);

      // Emit to WebSocket
      if (io) {
        io.emit('batch:started', job);
      }

      logger.info('Batch job started', { jobId: job.id });

      res.json(job);
    } catch (error) {
      logger.error('Failed to start batch job', { error });
      res.status(500).json({ error: 'Failed to start batch job' });
    }
  });

  // Cancel batch job
  router.post('/:id/cancel', async (req: Request, res: Response) => {
    try {
      const job = batchJobs.get(req.params.id);

      if (!job) {
        return res.status(404).json({ error: 'Batch job not found' });
      }

      job.status = 'failed';
      job.completedAt = new Date();
      batchJobs.set(job.id, job);

      // Emit to WebSocket
      if (io) {
        io.emit('batch:cancelled', job);
      }

      logger.info('Batch job cancelled', { jobId: job.id });

      res.json(job);
    } catch (error) {
      logger.error('Failed to cancel batch job', { error });
      res.status(500).json({ error: 'Failed to cancel batch job' });
    }
  });

  // Get batch job results
  router.get('/:id/results', async (req: Request, res: Response) => {
    try {
      const job = batchJobs.get(req.params.id);

      if (!job) {
        return res.status(404).json({ error: 'Batch job not found' });
      }

      // TODO: Load results from JSONL file or database
      const results = [];

      res.json({ results, total: results.length });
    } catch (error) {
      logger.error('Failed to get batch results', { error });
      res.status(500).json({ error: 'Failed to retrieve batch results' });
    }
  });

  return router;
}

// WebSocket handler
export function setupBatchWebSocket(io: SocketIOServer) {
  io.on('connection', (socket) => {
    logger.info('WebSocket client connected', { id: socket.id });

    // Subscribe to batch job updates
    socket.on('batch:subscribe', (jobId: string) => {
      socket.join(`batch:${jobId}`);
      logger.info('Client subscribed to batch job', { socketId: socket.id, jobId });
    });

    // Unsubscribe from batch job updates
    socket.on('batch:unsubscribe', (jobId: string) => {
      socket.leave(`batch:${jobId}`);
      logger.info('Client unsubscribed from batch job', { socketId: socket.id, jobId });
    });

    socket.on('disconnect', () => {
      logger.info('WebSocket client disconnected', { id: socket.id });
    });
  });
}
