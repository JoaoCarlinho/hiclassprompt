/**
 * Retry Logic & Circuit Breaker
 * Exponential backoff, circuit breaker pattern, and failed item tracking
 */

import { logger } from '../utils/logger';
import type { AIProvider } from '../types';

/**
 * Retry options
 */
export interface RetryOptions {
  maxAttempts?: number;
  initialDelayMs?: number;
  maxDelayMs?: number;
  backoffMultiplier?: number;
  retryableErrors?: string[];
}

/**
 * Circuit breaker state
 */
export type CircuitState = 'closed' | 'open' | 'half-open';

/**
 * Circuit breaker options
 */
export interface CircuitBreakerOptions {
  failureThreshold?: number;
  successThreshold?: number;
  timeout?: number;
  resetTimeoutMs?: number;
}

/**
 * Circuit breaker statistics
 */
export interface CircuitStats {
  state: CircuitState;
  failures: number;
  successes: number;
  lastFailureTime?: number;
  nextRetryTime?: number;
}

/**
 * Retry logic with exponential backoff
 */
export class RetryLogic {
  private defaultOptions: Required<RetryOptions> = {
    maxAttempts: 3,
    initialDelayMs: 1000,
    maxDelayMs: 30000,
    backoffMultiplier: 2,
    retryableErrors: ['RATE_LIMIT', 'TIMEOUT', 'NETWORK_ERROR', 'ECONNRESET', 'ETIMEDOUT'],
  };

  /**
   * Execute a function with retry logic
   * @param fn - Function to execute
   * @param options - Retry options
   * @returns Promise with function result
   */
  async execute<T>(fn: () => Promise<T>, options: RetryOptions = {}): Promise<T> {
    const opts = { ...this.defaultOptions, ...options };
    let lastError: Error | undefined;

    for (let attempt = 1; attempt <= opts.maxAttempts; attempt++) {
      try {
        const result = await fn();
        if (attempt > 1) {
          logger.info('Retry succeeded', { attempt });
        }
        return result;
      } catch (error) {
        lastError = error as Error;
        const isRetryable = this.isRetryableError(lastError, opts.retryableErrors);

        if (!isRetryable || attempt >= opts.maxAttempts) {
          logger.error('Request failed', {
            attempt,
            error: lastError.message,
            retryable: isRetryable,
          });
          throw lastError;
        }

        const delay = this.calculateDelay(attempt, opts);
        logger.warn('Request failed, retrying', {
          attempt,
          maxAttempts: opts.maxAttempts,
          delayMs: delay,
          error: lastError.message,
        });

        await this.sleep(delay);
      }
    }

    throw lastError || new Error('Max retry attempts exceeded');
  }

  /**
   * Check if error is retryable
   * @param error - Error object
   * @param retryableErrors - List of retryable error codes
   * @returns True if error is retryable
   */
  private isRetryableError(error: Error, retryableErrors: string[]): boolean {
    const errorMessage = error.message.toUpperCase();
    const errorCode = (error as Error & { code?: string }).code?.toUpperCase();

    return retryableErrors.some((retryableError) => {
      const pattern = retryableError.toUpperCase();
      return errorMessage.includes(pattern) || errorCode === pattern;
    });
  }

  /**
   * Calculate delay with exponential backoff
   * @param attempt - Current attempt number
   * @param options - Retry options
   * @returns Delay in milliseconds
   */
  private calculateDelay(attempt: number, options: Required<RetryOptions>): number {
    const delay = options.initialDelayMs * Math.pow(options.backoffMultiplier, attempt - 1);
    return Math.min(delay, options.maxDelayMs);
  }

  /**
   * Sleep for specified duration
   * @param ms - Milliseconds to sleep
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

/**
 * Circuit breaker pattern implementation
 */
export class CircuitBreaker {
  private state: CircuitState = 'closed';
  private failures: number = 0;
  private successes: number = 0;
  private lastFailureTime?: number;
  private nextRetryTime?: number;
  private options: Required<CircuitBreakerOptions>;

  constructor(options: CircuitBreakerOptions = {}) {
    this.options = {
      failureThreshold: options.failureThreshold || 5,
      successThreshold: options.successThreshold || 2,
      timeout: options.timeout || 60000,
      resetTimeoutMs: options.resetTimeoutMs || 60000,
    };
  }

  /**
   * Execute a function through the circuit breaker
   * @param fn - Function to execute
   * @returns Promise with function result
   */
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === 'open') {
      if (this.shouldAttemptReset()) {
        this.state = 'half-open';
        logger.info('Circuit breaker half-open, attempting reset');
      } else {
        const nextRetry = this.nextRetryTime ? new Date(this.nextRetryTime).toISOString() : 'unknown';
        throw new Error(`Circuit breaker is open. Next retry at ${nextRetry}`);
      }
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  /**
   * Handle successful execution
   */
  private onSuccess(): void {
    this.successes++;

    if (this.state === 'half-open') {
      if (this.successes >= this.options.successThreshold) {
        this.reset();
        logger.info('Circuit breaker reset to closed state');
      }
    } else {
      this.failures = 0;
    }
  }

  /**
   * Handle failed execution
   */
  private onFailure(): void {
    this.failures++;
    this.lastFailureTime = Date.now();
    this.successes = 0;

    if (this.failures >= this.options.failureThreshold) {
      this.trip();
    }
  }

  /**
   * Trip the circuit breaker (open state)
   */
  private trip(): void {
    this.state = 'open';
    this.nextRetryTime = Date.now() + this.options.resetTimeoutMs;
    logger.warn('Circuit breaker tripped to open state', {
      failures: this.failures,
      nextRetryTime: new Date(this.nextRetryTime),
    });
  }

  /**
   * Reset the circuit breaker
   */
  private reset(): void {
    this.state = 'closed';
    this.failures = 0;
    this.successes = 0;
    this.lastFailureTime = undefined;
    this.nextRetryTime = undefined;
  }

  /**
   * Check if we should attempt to reset the circuit breaker
   * @returns True if we should attempt reset
   */
  private shouldAttemptReset(): boolean {
    return this.nextRetryTime !== undefined && Date.now() >= this.nextRetryTime;
  }

  /**
   * Get circuit breaker statistics
   * @returns Circuit statistics
   */
  getStats(): CircuitStats {
    return {
      state: this.state,
      failures: this.failures,
      successes: this.successes,
      lastFailureTime: this.lastFailureTime,
      nextRetryTime: this.nextRetryTime,
    };
  }

  /**
   * Force reset the circuit breaker
   */
  forceReset(): void {
    this.reset();
    logger.info('Circuit breaker force reset');
  }
}

/**
 * Circuit breaker manager for multiple providers
 */
export class CircuitBreakerManager {
  private breakers: Map<AIProvider, CircuitBreaker>;

  constructor() {
    this.breakers = new Map();
  }

  /**
   * Get or create circuit breaker for a provider
   * @param provider - AI provider
   * @param options - Circuit breaker options
   * @returns Circuit breaker instance
   */
  getBreaker(provider: AIProvider, options?: CircuitBreakerOptions): CircuitBreaker {
    if (!this.breakers.has(provider)) {
      this.breakers.set(provider, new CircuitBreaker(options));
      logger.info(`Created circuit breaker for ${provider}`);
    }
    return this.breakers.get(provider)!;
  }

  /**
   * Execute function through provider's circuit breaker
   * @param provider - AI provider
   * @param fn - Function to execute
   * @returns Promise with function result
   */
  async execute<T>(provider: AIProvider, fn: () => Promise<T>): Promise<T> {
    const breaker = this.getBreaker(provider);
    return breaker.execute(fn);
  }

  /**
   * Get statistics for a provider
   * @param provider - AI provider
   * @returns Circuit statistics
   */
  getStats(provider: AIProvider): CircuitStats | null {
    const breaker = this.breakers.get(provider);
    return breaker ? breaker.getStats() : null;
  }

  /**
   * Get statistics for all providers
   * @returns Map of statistics by provider
   */
  getAllStats(): Map<AIProvider, CircuitStats> {
    const stats = new Map<AIProvider, CircuitStats>();
    for (const [provider, breaker] of this.breakers) {
      stats.set(provider, breaker.getStats());
    }
    return stats;
  }

  /**
   * Force reset a provider's circuit breaker
   * @param provider - AI provider
   */
  forceReset(provider: AIProvider): void {
    const breaker = this.breakers.get(provider);
    if (breaker) {
      breaker.forceReset();
    }
  }

  /**
   * Force reset all circuit breakers
   */
  forceResetAll(): void {
    for (const breaker of this.breakers.values()) {
      breaker.forceReset();
    }
    logger.info('All circuit breakers force reset');
  }
}
