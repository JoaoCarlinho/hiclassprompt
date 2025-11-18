/**
 * Rate limiter utility
 * Token bucket algorithm for rate limiting API requests
 */

import type { AIProvider, RateLimitStatus } from '../types';

/**
 * Rate limiter using token bucket algorithm
 */
export class RateLimiter {
  private requestsPerMinute: number;
  private tokens: number;
  private lastRefill: number;

  constructor(requestsPerMinute: number) {
    this.requestsPerMinute = requestsPerMinute;
    this.tokens = requestsPerMinute;
    this.lastRefill = Date.now();
  }

  /**
   * Acquire a token (wait if none available)
   */
  async acquire(): Promise<void> {
    this.refillTokens();

    if (this.tokens >= 1) {
      this.tokens -= 1;
      return;
    }

    // Wait until next refill
    const waitTime = 60000 - (Date.now() - this.lastRefill);
    await new Promise((resolve) => setTimeout(resolve, waitTime));

    this.refillTokens();
    this.tokens -= 1;
  }

  /**
   * Get current rate limit status
   */
  getStatus(provider: AIProvider): RateLimitStatus {
    this.refillTokens();

    return {
      provider,
      remainingRequests: Math.floor(this.tokens),
      resetAtMs: this.lastRefill + 60000,
      limitPerMinute: this.requestsPerMinute,
    };
  }

  /**
   * Refill tokens based on time passed
   */
  private refillTokens(): void {
    const now = Date.now();
    const timeSinceRefill = now - this.lastRefill;

    if (timeSinceRefill >= 60000) {
      // Full minute passed - full refill
      this.tokens = this.requestsPerMinute;
      this.lastRefill = now;
    } else {
      // Partial refill based on time passed
      const tokensToAdd = (timeSinceRefill / 60000) * this.requestsPerMinute;
      this.tokens = Math.min(this.requestsPerMinute, this.tokens + tokensToAdd);
    }
  }
}
