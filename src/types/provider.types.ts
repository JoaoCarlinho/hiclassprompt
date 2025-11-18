/**
 * Provider type definitions
 * Defines interfaces and types for AI provider implementations
 */

import type { ClassificationRequest, ClassificationResult } from './classification.types';

/**
 * Supported AI provider identifiers
 */
export enum AIProvider {
  GOOGLE_GEMINI = 'gemini',
  ANTHROPIC_CLAUDE = 'claude',
  OPENAI_GPT4V = 'openai',
  AWS_BEDROCK = 'bedrock',
}

/**
 * Provider-specific configuration
 */
export interface ProviderConfig {
  /** Provider identifier */
  provider: AIProvider;

  /** API key for authentication */
  apiKey: string;

  /** Optional model name/version */
  model?: string;

  /** Maximum number of retry attempts */
  maxRetries?: number;

  /** Request timeout in milliseconds */
  timeoutMs?: number;

  /** Rate limit (requests per minute) */
  rateLimitPerMinute?: number;
}

/**
 * Provider rate limit status
 */
export interface RateLimitStatus {
  /** Provider identifier */
  provider: AIProvider;

  /** Number of requests remaining in current window */
  remainingRequests: number;

  /** Timestamp when rate limit resets (milliseconds) */
  resetAtMs: number;

  /** Maximum requests allowed per minute */
  limitPerMinute: number;
}

/**
 * Base provider interface - all providers must implement this
 */
export interface IProvider {
  /** Provider identifier (readonly) */
  readonly name: AIProvider;

  /**
   * Classify a single image using this provider
   * @param request - Classification request with image and parameters
   * @returns Promise resolving to classification result
   */
  classify(request: ClassificationRequest): Promise<ClassificationResult>;

  /**
   * Validate provider configuration and API access
   * @throws Error if configuration is invalid or API is unreachable
   */
  validateConfig(): Promise<void>;

  /**
   * Get current rate limit status for this provider
   * @returns Current rate limit information
   */
  getRateLimitStatus(): Promise<RateLimitStatus>;
}
