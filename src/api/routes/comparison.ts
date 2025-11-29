/**
 * Provider Comparison API Routes
 * Handles multi-provider comparison requests
 */

import { Router, Request, Response } from 'express';
import { Server as SocketIOServer } from 'socket.io';
import { ComparisonService } from '../services/comparisonService';
import { ComparisonRequest } from '../../types/comparison.types';
import { AIProvider } from '../../types/provider.types';
import { logger } from '../../utils/logger';

/**
 * Create comparison router
 */
export function createComparisonRouter(io?: SocketIOServer): Router {
  const router = Router();
  const comparisonService = new ComparisonService(io);

  /**
   * POST /api/v1/prompts/compare
   * Execute comparison across multiple providers
   */
  router.post('/', async (req: Request, res: Response) => {
    try {
      const { prompt, imageUrls, providers, options } = req.body as ComparisonRequest;

      // Validate request
      if (!prompt || typeof prompt !== 'string') {
        return res.status(400).json({ error: 'Prompt is required and must be a string' });
      }

      if (!imageUrls || !Array.isArray(imageUrls) || imageUrls.length === 0) {
        return res.status(400).json({
          error: 'imageUrls is required and must be a non-empty array',
        });
      }

      // Validate image URLs
      const invalidUrls = imageUrls.filter(
        (url) => typeof url !== 'string' || url.trim() === ''
      );
      if (invalidUrls.length > 0) {
        return res.status(400).json({
          error: 'All imageUrls must be non-empty strings',
        });
      }

      // Validate providers if specified
      if (providers && Array.isArray(providers)) {
        const validProviders = Object.values(AIProvider);
        const invalidProviders = providers.filter(
          (p) => !validProviders.includes(p as AIProvider)
        );
        if (invalidProviders.length > 0) {
          return res.status(400).json({
            error: `Invalid providers: ${invalidProviders.join(', ')}`,
            validProviders,
          });
        }
      }

      // Limit image count to prevent abuse
      const maxImages = parseInt(process.env.MAX_COMPARISON_IMAGES || '100', 10);
      if (imageUrls.length > maxImages) {
        return res.status(400).json({
          error: `Maximum ${maxImages} images allowed per comparison`,
        });
      }

      // Execute comparison
      logger.info('Processing comparison request', {
        promptLength: prompt.length,
        imageCount: imageUrls.length,
        providers: providers?.join(', ') || 'all',
      });

      const result = await comparisonService.executeComparison(
        {
          prompt,
          imageUrls,
          providers: providers as AIProvider[] | undefined,
          options,
        },
        req.headers['x-user-id'] as string | undefined
      );

      logger.info('Comparison request completed', {
        comparisonId: result.comparisonId,
        successfulProviders: result.results.length,
        failedProviders: result.errors.length,
      });

      res.json(result);
    } catch (error) {
      const err = error as Error;
      logger.error('Comparison failed', { error: err.message, stack: err.stack });

      if (err.message.includes('API key') || err.message.includes('not configured')) {
        return res.status(503).json({
          error: 'One or more providers are not configured properly',
          message: err.message,
        });
      }

      if (err.message.includes('rate limit')) {
        return res.status(429).json({
          error: 'Rate limit exceeded. Please try again later.',
        });
      }

      res.status(500).json({
        error: 'Comparison failed',
        message: process.env.NODE_ENV === 'development' ? err.message : undefined,
      });
    }
  });

  /**
   * GET /api/v1/prompts/compare/:id
   * Retrieve a previous comparison result (if stored)
   */
  router.get('/:id', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;

      // TODO: Implement retrieval from database/cache
      // For now, return not implemented
      res.status(501).json({
        error: 'Comparison retrieval not yet implemented',
        message: 'This feature will be available in a future release',
      });
    } catch (error) {
      const err = error as Error;
      logger.error('Failed to retrieve comparison', { error: err.message });
      res.status(500).json({ error: 'Failed to retrieve comparison' });
    }
  });

  return router;
}

export default createComparisonRouter;
