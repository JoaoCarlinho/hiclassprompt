/**
 * Provider Comparison Type Definitions
 * Types for multi-provider comparison functionality
 */

import type { AIProvider } from './provider.types';
import type { ClassificationResult } from './classification.types';

/**
 * Comparison request
 */
export interface ComparisonRequest {
  /** Prompt to test across providers */
  prompt: string;

  /** Array of image URLs or base64 data */
  imageUrls: string[];

  /** Optional: filter specific providers (defaults to all) */
  providers?: AIProvider[];

  /** Additional options */
  options?: {
    /** Include statistical analysis */
    includeStatistics?: boolean;

    /** Include cost analysis */
    includeCostAnalysis?: boolean;

    /** Timeout per provider in milliseconds */
    timeout?: number;
  };
}

/**
 * Provider-specific aggregated results
 */
export interface ProviderResult {
  /** Provider identifier */
  provider: AIProvider;

  /** Model used */
  model: string;

  /** Individual classification results */
  results: ClassificationResult[];

  /** Aggregated statistics */
  aggregates: {
    /** Average latency across all classifications */
    averageLatency: number;

    /** Total cost for all classifications */
    totalCost: number;

    /** Total tokens used */
    totalTokens: number;

    /** Average confidence score */
    averageConfidence: number;

    /** Success rate (successful / total) */
    successRate: number;
  };
}

/**
 * Consensus analysis across providers
 */
export interface ConsensusAnalysis {
  /** Agreement level as percentage (0-100) */
  agreementLevel: number;

  /** Number of classifications agreeing on majority */
  agreementCount: number;

  /** The category most providers agree on */
  majorityCategory: string | null;

  /** All unique categories detected */
  allCategories: string[];

  /** Categories with disagreement */
  disagreementCategories?: string[];
}

/**
 * Statistical comparison across providers
 */
export interface ComparisonStatistics {
  /** Fastest provider */
  fastest: {
    provider: AIProvider;
    latency: number;
  };

  /** Cheapest provider */
  cheapest: {
    provider: AIProvider;
    cost: number;
  };

  /** Most confident provider */
  mostConfident: {
    provider: AIProvider;
    confidence: number;
  };

  /** Most accurate (optional, requires ground truth) */
  mostAccurate?: {
    provider: AIProvider;
    accuracy: number;
  };

  /** Average latency across all providers */
  averageLatency: number;

  /** Total cost across all providers */
  totalCost: number;

  /** Total tokens across all providers */
  totalTokens: number;
}

/**
 * Provider error information
 */
export interface ProviderError {
  /** Provider that failed */
  provider: AIProvider;

  /** Error message */
  error: string;

  /** Timestamp of failure */
  timestamp?: Date;
}

/**
 * Complete comparison response
 */
export interface ComparisonResponse {
  /** Unique comparison ID */
  comparisonId: string;

  /** Request summary */
  request: {
    prompt: string;
    imageCount: number;
    providers: AIProvider[];
    timestamp: string;
  };

  /** Results from each provider */
  results: ProviderResult[];

  /** Consensus analysis */
  consensus: ConsensusAnalysis;

  /** Statistical comparison */
  statistics: ComparisonStatistics;

  /** Any errors encountered */
  errors: ProviderError[];
}

/**
 * WebSocket progress update
 */
export interface ComparisonProgressUpdate {
  /** Comparison ID */
  comparisonId: string;

  /** Provider reporting progress */
  provider: AIProvider;

  /** Current status */
  status: 'pending' | 'processing' | 'completed' | 'failed';

  /** Number of results completed so far */
  resultsCount?: number;

  /** Error message if failed */
  error?: string;

  /** Timestamp */
  timestamp: Date;
}
