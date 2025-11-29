/**
 * Classification API Routes
 * Handles image classification requests
 */

import { Router, Request, Response } from 'express';
import multer from 'multer';
import { ProviderFactory } from '../../providers/provider-factory';
import { AIProvider } from '../../types/provider.types';
import { ClassificationRequest, ClassificationResult } from '../../types/classification.types';
import { ImageInput } from '../../types/image.types';
import { logger } from '../../utils/logger';
import { v4 as uuidv4 } from 'uuid';

const router = Router();

// Configure multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (_req, file, cb) => {
    const allowedMimes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only JPEG, PNG, WebP, and GIF are allowed.'));
    }
  },
});

/**
 * POST /api/classify
 * Classify an image using file upload or URL
 */
router.post('/', upload.single('image'), async (req: Request, res: Response) => {
  try {
    const { imageURL, provider, model, title, description } = req.body;
    const requestId = uuidv4();

    // Determine the default provider from environment
    const defaultProvider = (process.env.DEFAULT_PROVIDER || 'openai') as AIProvider;
    const selectedProvider = (provider || defaultProvider) as AIProvider;

    // Get API key for the provider
    let apiKey: string;
    switch (selectedProvider) {
      case 'openai':
        apiKey = process.env.OPENAI_API_KEY || '';
        break;
      case 'claude':
        apiKey = process.env.ANTHROPIC_API_KEY || '';
        break;
      case 'gemini':
        apiKey = process.env.GEMINI_API_KEY || '';
        break;
      case 'bedrock':
        apiKey = process.env.AWS_ACCESS_KEY_ID || '';
        break;
      default:
        return res.status(400).json({ error: `Unsupported provider: ${selectedProvider}` });
    }

    if (!apiKey) {
      return res.status(503).json({
        error: `Provider ${selectedProvider} is not configured. API key missing.`
      });
    }

    // Create image input
    let imageInput: ImageInput;

    if (req.file) {
      // File upload - convert to base64
      const base64Data = req.file.buffer.toString('base64');
      imageInput = {
        source: req.file.originalname,
        base64Data,
        metadata: {
          path: req.file.originalname,
          format: req.file.mimetype.split('/')[1] as any,
          sizeBytes: req.file.size,
        },
        hints: {
          title,
          description,
        },
      };
    } else if (imageURL) {
      // URL-based classification
      imageInput = {
        source: imageURL,
        hints: {
          title,
          description,
        },
      };
    } else {
      return res.status(400).json({ error: 'Either image file or imageURL is required' });
    }

    // Create provider instance
    const providerInstance = ProviderFactory.create({
      provider: selectedProvider,
      apiKey,
      model,
    });

    // Prepare classification request
    const classificationRequest: ClassificationRequest = {
      image: imageInput,
      provider: selectedProvider,
      metadata: {
        requestId,
        timestamp: new Date(),
      },
    };

    // Perform classification
    logger.info('Starting classification', {
      requestId,
      provider: selectedProvider,
      model: model || 'default',
      hasFile: !!req.file,
      hasURL: !!imageURL,
    });

    const result: ClassificationResult = await providerInstance.classify(classificationRequest);

    logger.info('Classification completed', {
      requestId,
      provider: selectedProvider,
      latencyMs: result.latencyMs,
      costUsd: result.costUsd,
    });

    // Format response to match frontend expectations
    const response = {
      id: result.requestId,
      provider: result.provider,
      model: model || 'default',
      category: result.primaryCategory.category,
      confidence: Math.round(result.primaryCategory.confidence * 100),
      reasoning: result.primaryCategory.reasoning || 'No reasoning provided',
      latency: result.latencyMs,
      cost: result.costUsd.toFixed(6),
      tokensInput: result.tokens.input,
      tokensOutput: result.tokens.output,
      timestamp: result.timestamp,
    };

    res.json(response);
  } catch (error) {
    const err = error as Error;
    logger.error('Classification failed', { error: err.message, stack: err.stack });

    if (err.message.includes('API key') || err.message.includes('authentication')) {
      return res.status(401).json({ error: 'Authentication failed with provider' });
    }

    if (err.message.includes('rate limit')) {
      return res.status(429).json({ error: 'Rate limit exceeded. Please try again later.' });
    }

    res.status(500).json({
      error: 'Classification failed',
      message: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
});

export default router;
