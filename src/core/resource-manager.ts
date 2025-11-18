/**
 * Resource Manager
 * Memory monitoring, queue depth limits, and graceful shutdown
 */

import { logger } from '../utils/logger';

/**
 * Memory statistics
 */
export interface MemoryStats {
  heapUsed: number;
  heapTotal: number;
  external: number;
  rss: number;
  heapUsedMB: number;
  heapTotalMB: number;
  externalMB: number;
  rssMB: number;
  heapUsagePercent: number;
}

/**
 * Resource limits
 */
export interface ResourceLimits {
  maxMemoryMB?: number;
  maxQueueDepth?: number;
  memoryWarningThresholdPercent?: number;
}

/**
 * Resource manager options
 */
export interface ResourceManagerOptions extends ResourceLimits {
  monitoringIntervalMs?: number;
  enableGarbageCollection?: boolean;
}

/**
 * Resource manager for monitoring and controlling system resources
 */
export class ResourceManager {
  private options: Required<ResourceManagerOptions>;
  private monitoringInterval?: NodeJS.Timeout;
  private shutdownCallbacks: Array<() => Promise<void>> = [];
  private isShuttingDown: boolean = false;

  constructor(options: ResourceManagerOptions = {}) {
    this.options = {
      maxMemoryMB: options.maxMemoryMB || 2048,
      maxQueueDepth: options.maxQueueDepth || 10000,
      memoryWarningThresholdPercent: options.memoryWarningThresholdPercent || 80,
      monitoringIntervalMs: options.monitoringIntervalMs || 5000,
      enableGarbageCollection: options.enableGarbageCollection ?? true,
    };
  }

  /**
   * Start resource monitoring
   */
  startMonitoring(): void {
    logger.info('Starting resource monitoring', {
      maxMemoryMB: this.options.maxMemoryMB,
      monitoringIntervalMs: this.options.monitoringIntervalMs,
    });

    this.monitoringInterval = setInterval(() => {
      this.checkMemory();
    }, this.options.monitoringIntervalMs);

    // Setup graceful shutdown handlers
    this.setupShutdownHandlers();
  }

  /**
   * Stop resource monitoring
   */
  stopMonitoring(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = undefined;
      logger.info('Stopped resource monitoring');
    }
  }

  /**
   * Check memory usage
   */
  private checkMemory(): void {
    const stats = this.getMemoryStats();

    // Check if memory usage is too high
    if (stats.heapUsagePercent >= this.options.memoryWarningThresholdPercent) {
      logger.warn('High memory usage detected', {
        heapUsedMB: stats.heapUsedMB,
        heapTotalMB: stats.heapTotalMB,
        usagePercent: stats.heapUsagePercent,
      });

      // Trigger garbage collection if enabled
      if (this.options.enableGarbageCollection && global.gc) {
        logger.info('Triggering garbage collection');
        global.gc();
      }
    }

    // Check if we've exceeded the memory limit
    if (stats.heapUsedMB >= this.options.maxMemoryMB) {
      logger.error('Memory limit exceeded', {
        heapUsedMB: stats.heapUsedMB,
        maxMemoryMB: this.options.maxMemoryMB,
      });

      // Optionally trigger graceful shutdown
      // this.initiateGracefulShutdown();
    }
  }

  /**
   * Get current memory statistics
   * @returns Memory statistics
   */
  getMemoryStats(): MemoryStats {
    const memUsage = process.memoryUsage();

    return {
      heapUsed: memUsage.heapUsed,
      heapTotal: memUsage.heapTotal,
      external: memUsage.external,
      rss: memUsage.rss,
      heapUsedMB: Math.round(memUsage.heapUsed / 1024 / 1024),
      heapTotalMB: Math.round(memUsage.heapTotal / 1024 / 1024),
      externalMB: Math.round(memUsage.external / 1024 / 1024),
      rssMB: Math.round(memUsage.rss / 1024 / 1024),
      heapUsagePercent: Math.round((memUsage.heapUsed / memUsage.heapTotal) * 100),
    };
  }

  /**
   * Check if queue depth is within limits
   * @param currentDepth - Current queue depth
   * @returns True if within limits
   */
  isQueueDepthValid(currentDepth: number): boolean {
    if (currentDepth > this.options.maxQueueDepth) {
      logger.warn('Queue depth exceeds limit', {
        currentDepth,
        maxQueueDepth: this.options.maxQueueDepth,
      });
      return false;
    }
    return true;
  }

  /**
   * Register callback for graceful shutdown
   * @param callback - Async function to call during shutdown
   */
  onShutdown(callback: () => Promise<void>): void {
    this.shutdownCallbacks.push(callback);
  }

  /**
   * Setup process signal handlers for graceful shutdown
   */
  private setupShutdownHandlers(): void {
    const signals: NodeJS.Signals[] = ['SIGINT', 'SIGTERM'];

    for (const signal of signals) {
      process.on(signal, () => {
        logger.info(`Received ${signal}, initiating graceful shutdown`);
        void this.initiateGracefulShutdown();
      });
    }

    // Handle uncaught exceptions
    process.on('uncaughtException', (error) => {
      logger.error('Uncaught exception', { error: error.message, stack: error.stack });
      void this.initiateGracefulShutdown().then(() => process.exit(1));
    });

    // Handle unhandled promise rejections
    process.on('unhandledRejection', (reason) => {
      logger.error('Unhandled promise rejection', { reason });
      void this.initiateGracefulShutdown().then(() => process.exit(1));
    });
  }

  /**
   * Initiate graceful shutdown
   */
  async initiateGracefulShutdown(): Promise<void> {
    if (this.isShuttingDown) {
      logger.warn('Shutdown already in progress');
      return;
    }

    this.isShuttingDown = true;
    logger.info('Starting graceful shutdown', {
      callbackCount: this.shutdownCallbacks.length,
    });

    // Stop monitoring
    this.stopMonitoring();

    // Execute all shutdown callbacks
    for (const callback of this.shutdownCallbacks) {
      try {
        await callback();
      } catch (error) {
        logger.error('Shutdown callback failed', { error: (error as Error).message });
      }
    }

    logger.info('Graceful shutdown complete');
  }

  /**
   * Force immediate shutdown
   */
  forceShutdown(exitCode: number = 0): void {
    logger.warn('Forcing immediate shutdown', { exitCode });
    this.stopMonitoring();
    process.exit(exitCode);
  }

  /**
   * Get resource usage summary
   * @returns Formatted summary string
   */
  getResourceSummary(): string {
    const memStats = this.getMemoryStats();

    return `
=== Resource Usage ===
Heap Used: ${memStats.heapUsedMB} MB / ${memStats.heapTotalMB} MB (${memStats.heapUsagePercent}%)
RSS: ${memStats.rssMB} MB
External: ${memStats.externalMB} MB
Max Memory Limit: ${this.options.maxMemoryMB} MB
Max Queue Depth: ${this.options.maxQueueDepth}
`;
  }

  /**
   * Check if system is healthy
   * @returns True if healthy
   */
  isHealthy(): boolean {
    const memStats = this.getMemoryStats();
    return (
      memStats.heapUsedMB < this.options.maxMemoryMB &&
      memStats.heapUsagePercent < this.options.memoryWarningThresholdPercent
    );
  }
}
