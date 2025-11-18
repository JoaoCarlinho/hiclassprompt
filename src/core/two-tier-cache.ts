/**
 * Two-Tier Cache
 * Memory (L1) + Redis (L2) caching with automatic promotion
 */

import Redis from 'ioredis';
import { MemoryCache, CacheStats } from './memory-cache';
import { logger } from '../utils/logger';
import type { ClassificationResult } from '../types';

/**
 * Two-tier cache configuration
 */
export interface TwoTierCacheConfig {
  memoryCacheSize?: number;
  redisUrl?: string;
  redisTTL?: number;
  enableRedis?: boolean;
  redisRetryAttempts?: number;
  redisRetryDelay?: number;
}

/**
 * Extended cache statistics including Redis
 */
export interface TwoTierCacheStats extends CacheStats {
  redisMemoryUsageMB?: number;
  redisConnected: boolean;
  l1Hits: number;
  l2Hits: number;
  promotions: number;
}

/**
 * Two-Tier Cache implementation
 * L1: Memory cache (fast, limited size)
 * L2: Redis cache (persistent, shared across instances)
 */
export class TwoTierCache {
  private memoryCache: MemoryCache<ClassificationResult>;
  private redis: Redis | null = null;
  private config: Required<TwoTierCacheConfig>;
  private l1Hits = 0;
  private l2Hits = 0;
  private promotions = 0;
  private isConnected = false;

  constructor(config: TwoTierCacheConfig = {}) {
    this.config = {
      memoryCacheSize: config.memoryCacheSize || 10000,
      redisUrl: config.redisUrl || process.env.REDIS_URL || '',
      redisTTL: config.redisTTL || 86400, // 24 hours in seconds
      enableRedis: config.enableRedis ?? true,
      redisRetryAttempts: config.redisRetryAttempts || 3,
      redisRetryDelay: config.redisRetryDelay || 1000,
    };

    // Initialize memory cache
    this.memoryCache = new MemoryCache<ClassificationResult>({
      maxSize: this.config.memoryCacheSize,
      ttlMs: this.config.redisTTL * 1000,
      enableStats: true,
    });

    // Initialize Redis if enabled and URL provided
    if (this.config.enableRedis && this.config.redisUrl) {
      this.initializeRedis();
    } else {
      logger.info('Two-tier cache initialized (memory-only mode)');
    }
  }

  /**
   * Initialize Redis connection
   */
  private initializeRedis(): void {
    try {
      this.redis = new Redis(this.config.redisUrl, {
        retryStrategy: (times: number) => {
          if (times > this.config.redisRetryAttempts) {
            logger.error('Redis connection failed after max retries');
            return null;
          }
          const delay = Math.min(times * this.config.redisRetryDelay, 5000);
          logger.warn('Redis retry attempt', { attempt: times, delay });
          return delay;
        },
        lazyConnect: true,
        enableReadyCheck: true,
        maxRetriesPerRequest: 3,
      });

      this.redis.on('connect', () => {
        this.isConnected = true;
        logger.info('Redis connected', { url: this.config.redisUrl });
      });

      this.redis.on('error', (err: Error) => {
        this.isConnected = false;
        logger.error('Redis error', { error: err.message });
      });

      this.redis.on('close', () => {
        this.isConnected = false;
        logger.warn('Redis connection closed');
      });

      this.redis.on('reconnecting', () => {
        logger.info('Redis reconnecting');
      });

      // Connect to Redis
      this.redis.connect().catch((err: Error) => {
        logger.error('Failed to connect to Redis', { error: err.message });
        this.redis = null;
      });

      logger.info('Two-tier cache initialized', {
        memorySize: this.config.memoryCacheSize,
        redisEnabled: true,
      });
    } catch (error) {
      logger.error('Failed to initialize Redis', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      this.redis = null;
    }
  }

  /**
   * Get value from cache
   * Tries L1 (memory) first, then L2 (Redis)
   * Promotes L2 hits to L1
   * @param key - Cache key
   * @returns Cached value or null
   */
  async get(key: string): Promise<ClassificationResult | null> {
    // Try L1 (memory cache) first
    const memCached = this.memoryCache.get(key);
    if (memCached) {
      this.l1Hits++;
      logger.debug('L1 cache hit', { key: this.truncateKey(key) });
      return memCached;
    }

    // Try L2 (Redis) if available
    if (this.redis && this.isConnected) {
      try {
        const redisCached = await this.redis.get(key);
        if (redisCached) {
          this.l2Hits++;
          logger.debug('L2 cache hit', { key: this.truncateKey(key) });

          const value = JSON.parse(redisCached) as ClassificationResult;

          // Promote to L1
          this.memoryCache.set(key, value);
          this.promotions++;
          logger.debug('Cache promotion', { key: this.truncateKey(key) });

          return value;
        }
      } catch (error) {
        logger.error('Redis get error', {
          key: this.truncateKey(key),
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    return null;
  }

  /**
   * Set value in cache
   * Always sets in L1, optionally sets in L2
   * @param key - Cache key
   * @param value - Value to cache
   * @param ttl - Optional TTL override in seconds
   */
  async set(key: string, value: ClassificationResult, ttl?: number): Promise<void> {
    // Always update L1 (memory cache)
    this.memoryCache.set(key, value);
    logger.debug('L1 cache set', { key: this.truncateKey(key) });

    // Optionally update L2 (Redis)
    if (this.redis && this.isConnected) {
      try {
        const ttlSeconds = ttl || this.config.redisTTL;
        await this.redis.setex(key, ttlSeconds, JSON.stringify(value));
        logger.debug('L2 cache set', {
          key: this.truncateKey(key),
          ttl: ttlSeconds,
        });
      } catch (error) {
        logger.error('Redis set error', {
          key: this.truncateKey(key),
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }
  }

  /**
   * Check if key exists in cache
   * @param key - Cache key
   * @returns True if key exists in L1 or L2
   */
  async has(key: string): Promise<boolean> {
    // Check L1
    if (this.memoryCache.has(key)) {
      return true;
    }

    // Check L2
    if (this.redis && this.isConnected) {
      try {
        const exists = await this.redis.exists(key);
        return exists === 1;
      } catch (error) {
        logger.error('Redis exists error', {
          key: this.truncateKey(key),
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    return false;
  }

  /**
   * Delete entry from cache
   * Removes from both L1 and L2
   * @param key - Cache key
   * @returns True if entry was deleted
   */
  async delete(key: string): Promise<boolean> {
    let deleted = false;

    // Delete from L1
    const memDeleted = this.memoryCache.delete(key);
    if (memDeleted) {
      deleted = true;
      logger.debug('L1 cache delete', { key: this.truncateKey(key) });
    }

    // Delete from L2
    if (this.redis && this.isConnected) {
      try {
        const redisDeleted = await this.redis.del(key);
        if (redisDeleted > 0) {
          deleted = true;
          logger.debug('L2 cache delete', { key: this.truncateKey(key) });
        }
      } catch (error) {
        logger.error('Redis delete error', {
          key: this.truncateKey(key),
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    return deleted;
  }

  /**
   * Clear all entries from cache
   * Clears both L1 and L2
   */
  async clear(): Promise<void> {
    // Clear L1
    this.memoryCache.clear();
    logger.info('L1 cache cleared');

    // Clear L2
    if (this.redis && this.isConnected) {
      try {
        await this.redis.flushdb();
        logger.info('L2 cache cleared');
      } catch (error) {
        logger.error('Redis flush error', {
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }
  }

  /**
   * Get cache statistics
   * @returns Cache statistics including both L1 and L2
   */
  async getStats(): Promise<TwoTierCacheStats> {
    const memStats = this.memoryCache.getStats();

    let redisMemoryUsageMB: number | undefined;

    if (this.redis && this.isConnected) {
      try {
        const info = await this.redis.info('memory');
        redisMemoryUsageMB = this.parseRedisMemory(info);
      } catch (error) {
        logger.error('Failed to get Redis stats', {
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    return {
      ...memStats,
      redisMemoryUsageMB,
      redisConnected: this.isConnected,
      l1Hits: this.l1Hits,
      l2Hits: this.l2Hits,
      promotions: this.promotions,
    };
  }

  /**
   * Warmup cache with entries
   * Loads entries into both L1 and L2
   * @param entries - Map of key-value pairs to warmup
   */
  async warmup(entries: Map<string, ClassificationResult>): Promise<void> {
    logger.info('Warming up cache', { count: entries.size });

    const promises: Promise<void>[] = [];

    for (const [key, value] of entries.entries()) {
      promises.push(this.set(key, value));
    }

    await Promise.all(promises);

    logger.info('Cache warmup complete', {
      l1Size: this.memoryCache.getStats().size,
      entries: entries.size,
    });
  }

  /**
   * Reset statistics
   */
  resetStats(): void {
    this.memoryCache.resetStats();
    this.l1Hits = 0;
    this.l2Hits = 0;
    this.promotions = 0;
    logger.info('Cache statistics reset');
  }

  /**
   * Close Redis connection
   */
  async close(): Promise<void> {
    if (this.redis) {
      await this.redis.quit();
      this.redis = null;
      this.isConnected = false;
      logger.info('Redis connection closed');
    }
  }

  /**
   * Check if Redis is connected
   * @returns True if Redis is connected
   */
  isRedisConnected(): boolean {
    return this.isConnected;
  }

  /**
   * Parse Redis memory usage from info string
   * @param info - Redis INFO output
   * @returns Memory usage in MB
   */
  private parseRedisMemory(info: string): number {
    const match = info.match(/used_memory:(\d+)/);
    if (match && match[1]) {
      const bytes = parseInt(match[1], 10);
      return bytes / (1024 * 1024);
    }
    return 0;
  }

  /**
   * Truncate key for logging
   * @param key - Full key
   * @returns Truncated key
   */
  private truncateKey(key: string): string {
    return key.length > 50 ? key.substring(0, 50) + '...' : key;
  }
}
