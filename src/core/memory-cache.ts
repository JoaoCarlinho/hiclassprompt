/**
 * Memory Cache
 * LRU (Least Recently Used) memory cache for classification results
 */

import { createHash } from 'crypto';
import { logger } from '../utils/logger';
import type { AIProvider, ClassificationResult } from '../types';

/**
 * Cached entry
 */
export interface CachedEntry<T = unknown> {
  value: T;
  createdAt: number;
  accessCount: number;
}

/**
 * Cache statistics
 */
export interface CacheStats {
  size: number;
  maxSize: number;
  hits: number;
  misses: number;
  hitRate: number;
  evictions: number;
  memoryUsageMB: number;
}

/**
 * Cache key components
 */
export interface CacheKeyComponents {
  provider: AIProvider;
  model: string;
  prompt: string;
  imageHash: string;
}

/**
 * Cache options
 */
export interface CacheOptions {
  maxSize?: number;
  ttlMs?: number;
  enableStats?: boolean;
}

/**
 * LRU Memory Cache
 */
export class MemoryCache<T = ClassificationResult> {
  private cache: Map<string, CachedEntry<T>> = new Map();
  private accessOrder: string[] = [];
  private maxSize: number;
  private ttlMs: number;
  private hits = 0;
  private misses = 0;
  private evictions = 0;
  private enableStats: boolean;

  constructor(options: CacheOptions = {}) {
    this.maxSize = options.maxSize || 10000;
    this.ttlMs = options.ttlMs || 24 * 60 * 60 * 1000; // 24 hours
    this.enableStats = options.enableStats ?? true;

    logger.info('Memory cache initialized', {
      maxSize: this.maxSize,
      ttlHours: this.ttlMs / (60 * 60 * 1000),
    });
  }

  /**
   * Get value from cache
   * @param key - Cache key
   * @returns Cached value or null if not found/expired
   */
  get(key: string): T | null {
    const entry = this.cache.get(key);

    if (!entry) {
      this.misses++;
      if (this.enableStats) {
        logger.debug('Cache miss', { key: this.truncateKey(key) });
      }
      return null;
    }

    // Check TTL
    if (Date.now() - entry.createdAt > this.ttlMs) {
      this.cache.delete(key);
      this.removeFromAccessOrder(key);
      this.misses++;
      if (this.enableStats) {
        logger.debug('Cache expired', { key: this.truncateKey(key) });
      }
      return null;
    }

    // Update access order (LRU)
    this.removeFromAccessOrder(key);
    this.accessOrder.push(key);
    entry.accessCount++;
    this.hits++;

    if (this.enableStats) {
      logger.debug('Cache hit', {
        key: this.truncateKey(key),
        accessCount: entry.accessCount,
      });
    }

    return entry.value;
  }

  /**
   * Set value in cache
   * @param key - Cache key
   * @param value - Value to cache
   */
  set(key: string, value: T): void {
    // If cache is full and key doesn't exist, evict LRU
    if (this.cache.size >= this.maxSize && !this.cache.has(key)) {
      const lruKey = this.accessOrder.shift();
      if (lruKey) {
        this.cache.delete(lruKey);
        this.evictions++;
        if (this.enableStats) {
          logger.debug('Cache eviction (LRU)', { key: this.truncateKey(lruKey) });
        }
      }
    }

    // If key exists, remove from old position in access order
    if (this.cache.has(key)) {
      this.removeFromAccessOrder(key);
    }

    this.cache.set(key, {
      value,
      createdAt: Date.now(),
      accessCount: 0,
    });

    this.accessOrder.push(key);

    if (this.enableStats) {
      logger.debug('Cache set', { key: this.truncateKey(key), size: this.cache.size });
    }
  }

  /**
   * Check if key exists in cache
   * @param key - Cache key
   * @returns True if key exists and not expired
   */
  has(key: string): boolean {
    return this.get(key) !== null;
  }

  /**
   * Delete entry from cache
   * @param key - Cache key
   * @returns True if entry was deleted
   */
  delete(key: string): boolean {
    const deleted = this.cache.delete(key);
    if (deleted) {
      this.removeFromAccessOrder(key);
      if (this.enableStats) {
        logger.debug('Cache delete', { key: this.truncateKey(key) });
      }
    }
    return deleted;
  }

  /**
   * Clear all entries from cache
   */
  clear(): void {
    const previousSize = this.cache.size;
    this.cache.clear();
    this.accessOrder = [];
    logger.info('Cache cleared', { previousSize });
  }

  /**
   * Invalidate cache by provider
   * @param provider - AI provider
   * @returns Number of entries invalidated
   */
  invalidateByProvider(provider: AIProvider): number {
    let count = 0;
    const keysToDelete: string[] = [];

    for (const key of this.cache.keys()) {
      if (key.startsWith(`${provider}:`)) {
        keysToDelete.push(key);
      }
    }

    for (const key of keysToDelete) {
      this.delete(key);
      count++;
    }

    logger.info('Cache invalidated by provider', { provider, count });
    return count;
  }

  /**
   * Invalidate cache by model
   * @param provider - AI provider
   * @param model - Model name
   * @returns Number of entries invalidated
   */
  invalidateByModel(provider: AIProvider, model: string): number {
    let count = 0;
    const keysToDelete: string[] = [];
    const prefix = `${provider}:${model}:`;

    for (const key of this.cache.keys()) {
      if (key.startsWith(prefix)) {
        keysToDelete.push(key);
      }
    }

    for (const key of keysToDelete) {
      this.delete(key);
      count++;
    }

    logger.info('Cache invalidated by model', { provider, model, count });
    return count;
  }

  /**
   * Clean up expired entries
   * @returns Number of entries cleaned
   */
  cleanup(): number {
    let count = 0;
    const now = Date.now();
    const keysToDelete: string[] = [];

    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.createdAt > this.ttlMs) {
        keysToDelete.push(key);
      }
    }

    for (const key of keysToDelete) {
      this.cache.delete(key);
      this.removeFromAccessOrder(key);
      count++;
    }

    if (count > 0) {
      logger.info('Cache cleanup complete', { expiredEntries: count });
    }

    return count;
  }

  /**
   * Get cache statistics
   * @returns Cache statistics
   */
  getStats(): CacheStats {
    const total = this.hits + this.misses;
    const memoryUsage = this.estimateMemoryUsage();

    return {
      size: this.cache.size,
      maxSize: this.maxSize,
      hits: this.hits,
      misses: this.misses,
      hitRate: total > 0 ? (this.hits / total) * 100 : 0,
      evictions: this.evictions,
      memoryUsageMB: memoryUsage,
    };
  }

  /**
   * Generate cache key from components
   * @param components - Cache key components
   * @returns Cache key
   */
  static generateKey(components: CacheKeyComponents): string {
    const { provider, model, prompt, imageHash } = components;

    // Create a deterministic key using provider:model:promptHash:imageHash
    const promptHash = createHash('sha256')
      .update(prompt)
      .digest('hex')
      .substring(0, 16);

    return `${provider}:${model}:${promptHash}:${imageHash}`;
  }

  /**
   * Generate image hash from buffer
   * @param imageBuffer - Image buffer
   * @returns SHA256 hash of image
   */
  static generateImageHash(imageBuffer: Buffer): string {
    return createHash('sha256').update(imageBuffer).digest('hex').substring(0, 16);
  }

  /**
   * Reset statistics
   */
  resetStats(): void {
    this.hits = 0;
    this.misses = 0;
    this.evictions = 0;
    logger.info('Cache statistics reset');
  }

  /**
   * Get cache size in MB
   * @returns Estimated cache size in MB
   */
  private estimateMemoryUsage(): number {
    // Rough estimate: ~1KB per entry on average
    const avgEntrySize = 1024; // bytes
    const totalBytes = this.cache.size * avgEntrySize;
    return totalBytes / (1024 * 1024);
  }

  /**
   * Remove key from access order array
   * @param key - Key to remove
   */
  private removeFromAccessOrder(key: string): void {
    const index = this.accessOrder.indexOf(key);
    if (index !== -1) {
      this.accessOrder.splice(index, 1);
    }
  }

  /**
   * Truncate key for logging
   * @param key - Full key
   * @returns Truncated key
   */
  private truncateKey(key: string): string {
    return key.length > 50 ? key.substring(0, 50) + '...' : key;
  }

  /**
   * Warmup cache with entries
   * @param entries - Map of key-value pairs to warmup
   */
  warmup(entries: Map<string, T>): void {
    logger.info('Warming up cache', { count: entries.size });

    for (const [key, value] of entries.entries()) {
      this.set(key, value);
    }

    logger.info('Cache warmup complete', { size: this.cache.size });
  }
}
