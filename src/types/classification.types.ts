/**
 * Classification type definitions
 * Defines types for classification requests, results, and categories
 */

import type { AIProvider } from './provider.types';
import type { ImageInput } from './image.types';

/**
 * Classification confidence level
 */
export enum ConfidenceLevel {
  /** High confidence: > 0.8 */
  HIGH = 'high',

  /** Medium confidence: 0.5 - 0.8 */
  MEDIUM = 'medium',

  /** Low confidence: < 0.5 */
  LOW = 'low',
}

/**
 * Classification category result
 */
export interface CategoryResult {
  /** Category name/label */
  category: string;

  /** Confidence score (0-1) */
  confidence: number;

  /** Confidence level enum */
  confidenceLevel: ConfidenceLevel;

  /** Optional reasoning from model */
  reasoning?: string;
}

/**
 * Classification request
 */
export interface ClassificationRequest {
  /** Image to classify */
  image: ImageInput;

  /** Provider to use */
  provider: AIProvider;

  /** Optional custom prompt template */
  promptTemplate?: string;

  /** Optional maximum categories to return */
  maxCategories?: number;

  /** Request metadata */
  metadata?: {
    /** Unique request identifier */
    requestId?: string;

    /** User identifier */
    userId?: string;

    /** Request timestamp */
    timestamp?: Date;
  };
}

/**
 * Successful classification result
 */
export interface ClassificationResult {
  /** Request ID for tracking */
  requestId: string;

  /** Provider used */
  provider: AIProvider;

  /** Classification results (sorted by confidence, descending) */
  categories: CategoryResult[];

  /** Primary category (highest confidence) */
  primaryCategory: CategoryResult;

  /** Token usage statistics */
  tokens: {
    /** Input tokens consumed */
    input: number;

    /** Output tokens generated */
    output: number;

    /** Total tokens (input + output) */
    total: number;
  };

  /** Cost in USD */
  costUsd: number;

  /** Latency in milliseconds */
  latencyMs: number;

  /** Timestamp when classification completed */
  timestamp: Date;

  /** Optional provider-specific metadata */
  providerMetadata?: Record<string, unknown>;
}
