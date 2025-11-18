/**
 * Progress Tracker
 * Real-time progress bars, ETA calculation, and success/failure counters
 */

import cliProgress from 'cli-progress';
import { logger } from '../utils/logger';

/**
 * Progress statistics
 */
export interface ProgressStats {
  total: number;
  completed: number;
  successful: number;
  failed: number;
  skipped: number;
  percentage: number;
  eta: number; // seconds remaining
  elapsedTime: number; // seconds elapsed
  itemsPerSecond: number;
}

/**
 * Progress tracker for batch operations
 */
export class ProgressTracker {
  private progressBar?: cliProgress.SingleBar;
  private total: number = 0;
  private completed: number = 0;
  private successful: number = 0;
  private failed: number = 0;
  private skipped: number = 0;
  private startTime: number = 0;
  private enabled: boolean = true;

  /**
   * Initialize progress tracker
   * @param total - Total number of items
   * @param enabled - Whether to show progress bar
   */
  initialize(total: number, enabled: boolean = true): void {
    this.total = total;
    this.completed = 0;
    this.successful = 0;
    this.failed = 0;
    this.skipped = 0;
    this.startTime = Date.now();
    this.enabled = enabled;

    if (this.enabled) {
      this.progressBar = new cliProgress.SingleBar(
        {
          format:
            'Progress |{bar}| {percentage}% | {value}/{total} | ETA: {eta}s | Success: {successful} | Failed: {failed}',
          barCompleteChar: '\u2588',
          barIncompleteChar: '\u2591',
          hideCursor: true,
        },
        cliProgress.Presets.shades_classic
      );

      this.progressBar.start(total, 0, {
        successful: 0,
        failed: 0,
      });
    }

    logger.info('Progress tracker initialized', { total });
  }

  /**
   * Increment success counter
   */
  incrementSuccess(): void {
    this.successful++;
    this.completed++;
    this.update();
  }

  /**
   * Increment failure counter
   */
  incrementFailure(): void {
    this.failed++;
    this.completed++;
    this.update();
  }

  /**
   * Increment skipped counter
   */
  incrementSkipped(): void {
    this.skipped++;
    this.completed++;
    this.update();
  }

  /**
   * Update progress bar
   */
  private update(): void {
    if (this.progressBar && this.enabled) {
      this.progressBar.update(this.completed, {
        successful: this.successful,
        failed: this.failed,
      });
    }
  }

  /**
   * Get current statistics
   * @returns Progress statistics
   */
  getStats(): ProgressStats {
    const elapsedMs = Date.now() - this.startTime;
    const elapsedTime = elapsedMs / 1000;
    const itemsPerSecond = this.completed / elapsedTime || 0;
    const remaining = this.total - this.completed;
    const eta = remaining / itemsPerSecond || 0;
    const percentage = this.total > 0 ? (this.completed / this.total) * 100 : 0;

    return {
      total: this.total,
      completed: this.completed,
      successful: this.successful,
      failed: this.failed,
      skipped: this.skipped,
      percentage: Math.round(percentage * 10) / 10,
      eta: Math.round(eta),
      elapsedTime: Math.round(elapsedTime),
      itemsPerSecond: Math.round(itemsPerSecond * 10) / 10,
    };
  }

  /**
   * Stop and finalize progress bar
   */
  stop(): void {
    if (this.progressBar && this.enabled) {
      this.progressBar.stop();
    }

    const stats = this.getStats();
    logger.info('Progress tracking complete', stats);
  }

  /**
   * Get formatted summary
   * @returns Summary string
   */
  getSummary(): string {
    const stats = this.getStats();
    return `
=== Batch Processing Summary ===
Total items: ${stats.total}
Completed: ${stats.completed} (${stats.percentage}%)
Successful: ${stats.successful}
Failed: ${stats.failed}
Skipped: ${stats.skipped}
Elapsed time: ${stats.elapsedTime}s
Processing rate: ${stats.itemsPerSecond} items/s
`;
  }
}
