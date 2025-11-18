/**
 * Concurrency Controller
 * Manages concurrent requests with provider-specific rate limiting
 */

import PQueue from 'p-queue';
import type { AIProvider } from '../types';
import { logger } from '../utils/logger';

/**
 * Provider concurrency limits
 */
const PROVIDER_CONCURRENCY: Record<AIProvider, number> = {
  gemini: 10, // Gemini can handle higher concurrency
  claude: 5, // Claude has stricter rate limits
  openai: 5, // OpenAI moderate concurrency
  bedrock: 8, // Bedrock has good throughput
};

/**
 * Concurrency controller options
 */
export interface ConcurrencyOptions {
  maxConcurrent?: number;
  intervalCap?: number;
  interval?: number;
  autoStart?: boolean;
}

/**
 * Queue statistics
 */
export interface QueueStats {
  size: number;
  pending: number;
  isPaused: boolean;
  concurrency: number;
}

/**
 * Concurrency controller for managing parallel requests
 */
export class ConcurrencyController {
  private queues: Map<AIProvider, PQueue>;
  private globalQueue?: PQueue;

  constructor() {
    this.queues = new Map();
  }

  /**
   * Get or create queue for a provider
   * @param provider - AI provider
   * @param options - Queue options
   * @returns PQueue instance
   */
  getQueue(provider: AIProvider, options: ConcurrencyOptions = {}): PQueue {
    if (!this.queues.has(provider)) {
      const concurrency = options.maxConcurrent || PROVIDER_CONCURRENCY[provider] || 5;

      const queue = new PQueue({
        concurrency,
        autoStart: options.autoStart !== false,
        intervalCap: options.intervalCap,
        interval: options.interval,
      });

      // Add event listeners
      queue.on('active', () => {
        logger.debug(`Queue active for ${provider}`, {
          size: queue.size,
          pending: queue.pending,
        });
      });

      queue.on('idle', () => {
        logger.debug(`Queue idle for ${provider}`);
      });

      queue.on('error', (error) => {
        logger.error(`Queue error for ${provider}`, { error: (error as Error).message });
      });

      this.queues.set(provider, queue);
      logger.info(`Created queue for ${provider}`, { concurrency });
    }

    return this.queues.get(provider)!;
  }

  /**
   * Get or create global queue for cross-provider concurrency
   * @param options - Queue options
   * @returns PQueue instance
   */
  getGlobalQueue(options: ConcurrencyOptions = {}): PQueue {
    if (!this.globalQueue) {
      this.globalQueue = new PQueue({
        concurrency: options.maxConcurrent || 20,
        autoStart: options.autoStart !== false,
        intervalCap: options.intervalCap,
        interval: options.interval,
      });

      this.globalQueue.on('idle', () => {
        logger.debug('Global queue idle');
      });

      logger.info('Created global queue', {
        concurrency: this.globalQueue.concurrency,
      });
    }

    return this.globalQueue;
  }

  /**
   * Execute a task with provider-specific concurrency control
   * @param provider - AI provider
   * @param task - Task function to execute
   * @returns Promise with task result
   */
  async execute<T>(provider: AIProvider, task: () => Promise<T>): Promise<T> {
    const queue = this.getQueue(provider);
    return queue.add(task) as Promise<T>;
  }

  /**
   * Execute a task with global concurrency control
   * @param task - Task function to execute
   * @returns Promise with task result
   */
  async executeGlobal<T>(task: () => Promise<T>): Promise<T> {
    const queue = this.getGlobalQueue();
    return queue.add(task) as Promise<T>;
  }

  /**
   * Get statistics for a provider queue
   * @param provider - AI provider
   * @returns Queue statistics
   */
  getStats(provider: AIProvider): QueueStats {
    const queue = this.queues.get(provider);
    if (!queue) {
      return {
        size: 0,
        pending: 0,
        isPaused: false,
        concurrency: PROVIDER_CONCURRENCY[provider] || 5,
      };
    }

    return {
      size: queue.size,
      pending: queue.pending,
      isPaused: queue.isPaused,
      concurrency: queue.concurrency,
    };
  }

  /**
   * Get statistics for global queue
   * @returns Queue statistics
   */
  getGlobalStats(): QueueStats {
    if (!this.globalQueue) {
      return {
        size: 0,
        pending: 0,
        isPaused: false,
        concurrency: 20,
      };
    }

    return {
      size: this.globalQueue.size,
      pending: this.globalQueue.pending,
      isPaused: this.globalQueue.isPaused,
      concurrency: this.globalQueue.concurrency,
    };
  }

  /**
   * Pause a provider queue
   * @param provider - AI provider
   */
  pause(provider: AIProvider): void {
    const queue = this.queues.get(provider);
    if (queue) {
      queue.pause();
      logger.info(`Paused queue for ${provider}`);
    }
  }

  /**
   * Resume a provider queue
   * @param provider - AI provider
   */
  resume(provider: AIProvider): void {
    const queue = this.queues.get(provider);
    if (queue) {
      queue.start();
      logger.info(`Resumed queue for ${provider}`);
    }
  }

  /**
   * Pause all queues
   */
  pauseAll(): void {
    for (const [provider, queue] of this.queues) {
      queue.pause();
      logger.info(`Paused queue for ${provider}`);
    }
    if (this.globalQueue) {
      this.globalQueue.pause();
      logger.info('Paused global queue');
    }
  }

  /**
   * Resume all queues
   */
  resumeAll(): void {
    for (const [provider, queue] of this.queues) {
      queue.start();
      logger.info(`Resumed queue for ${provider}`);
    }
    if (this.globalQueue) {
      this.globalQueue.start();
      logger.info('Resumed global queue');
    }
  }

  /**
   * Wait for a provider queue to become idle
   * @param provider - AI provider
   */
  async waitForIdle(provider: AIProvider): Promise<void> {
    const queue = this.queues.get(provider);
    if (queue) {
      await queue.onIdle();
    }
  }

  /**
   * Wait for all queues to become idle
   */
  async waitForAllIdle(): Promise<void> {
    const promises: Promise<void>[] = [];

    for (const queue of this.queues.values()) {
      promises.push(queue.onIdle());
    }

    if (this.globalQueue) {
      promises.push(this.globalQueue.onIdle());
    }

    await Promise.all(promises);
  }

  /**
   * Clear a provider queue
   * @param provider - AI provider
   */
  clear(provider: AIProvider): void {
    const queue = this.queues.get(provider);
    if (queue) {
      queue.clear();
      logger.info(`Cleared queue for ${provider}`);
    }
  }

  /**
   * Clear all queues
   */
  clearAll(): void {
    for (const [provider, queue] of this.queues) {
      queue.clear();
      logger.info(`Cleared queue for ${provider}`);
    }
    if (this.globalQueue) {
      this.globalQueue.clear();
      logger.info('Cleared global queue');
    }
  }

  /**
   * Adjust concurrency for a provider
   * @param provider - AI provider
   * @param concurrency - New concurrency limit
   */
  adjustConcurrency(provider: AIProvider, concurrency: number): void {
    const queue = this.queues.get(provider);
    if (queue) {
      queue.concurrency = concurrency;
      logger.info(`Adjusted concurrency for ${provider}`, { concurrency });
    }
  }
}
