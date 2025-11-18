/**
 * Batch Result Manager
 * JSONL streaming output, partial result persistence, and resume capability
 */

import { createWriteStream, existsSync, readFileSync, WriteStream } from 'fs';
import { logger } from '../utils/logger';
import type { ClassificationResult } from '../types';

/**
 * Batch result item
 */
export interface BatchResultItem {
  id: string;
  imagePath: string;
  result?: ClassificationResult;
  error?: {
    message: string;
    code?: string;
    timestamp: Date;
  };
  attempts: number;
  status: 'pending' | 'success' | 'failed' | 'skipped';
  timestamp: Date;
}

/**
 * Batch session metadata
 */
export interface BatchSession {
  sessionId: string;
  startTime: Date;
  endTime?: Date;
  totalItems: number;
  completedItems: number;
  successfulItems: number;
  failedItems: number;
  skippedItems: number;
}

/**
 * Batch result manager
 */
export class BatchResultManager {
  private outputPath: string;
  private sessionPath: string;
  private outputStream?: WriteStream;
  private session: BatchSession;
  private results: Map<string, BatchResultItem>;

  constructor(outputPath: string, sessionId?: string) {
    this.outputPath = outputPath;
    this.sessionPath = outputPath.replace(/\.jsonl?$/, '.session.json');
    this.results = new Map();

    this.session = {
      sessionId: sessionId || this.generateSessionId(),
      startTime: new Date(),
      totalItems: 0,
      completedItems: 0,
      successfulItems: 0,
      failedItems: 0,
      skippedItems: 0,
    };
  }

  /**
   * Initialize result manager
   * @param totalItems - Total number of items to process
   */
  initialize(totalItems: number): void {
    this.session.totalItems = totalItems;

    // Open output stream for JSONL
    this.outputStream = createWriteStream(this.outputPath, { flags: 'a' });

    // Write session metadata
    this.saveSession();

    logger.info('Batch result manager initialized', {
      sessionId: this.session.sessionId,
      outputPath: this.outputPath,
      totalItems,
    });
  }

  /**
   * Save a successful result
   * @param id - Item ID
   * @param imagePath - Image path
   * @param result - Classification result
   */
  saveSuccess(id: string, imagePath: string, result: ClassificationResult): void {
    const item: BatchResultItem = {
      id,
      imagePath,
      result,
      attempts: 1,
      status: 'success',
      timestamp: new Date(),
    };

    this.results.set(id, item);
    this.session.successfulItems++;
    this.session.completedItems++;

    // Write to JSONL stream
    this.writeToStream(item);

    // Update session
    this.saveSession();
  }

  /**
   * Save a failed result
   * @param id - Item ID
   * @param imagePath - Image path
   * @param error - Error information
   * @param attempts - Number of attempts made
   */
  saveFailure(
    id: string,
    imagePath: string,
    error: { message: string; code?: string },
    attempts: number = 1
  ): void {
    const item: BatchResultItem = {
      id,
      imagePath,
      error: {
        ...error,
        timestamp: new Date(),
      },
      attempts,
      status: 'failed',
      timestamp: new Date(),
    };

    this.results.set(id, item);
    this.session.failedItems++;
    this.session.completedItems++;

    // Write to JSONL stream
    this.writeToStream(item);

    // Update session
    this.saveSession();
  }

  /**
   * Save a skipped result
   * @param id - Item ID
   * @param imagePath - Image path
   * @param reason - Skip reason
   */
  saveSkipped(id: string, imagePath: string, reason: string): void {
    const item: BatchResultItem = {
      id,
      imagePath,
      error: {
        message: reason,
        code: 'SKIPPED',
        timestamp: new Date(),
      },
      attempts: 0,
      status: 'skipped',
      timestamp: new Date(),
    };

    this.results.set(id, item);
    this.session.skippedItems++;
    this.session.completedItems++;

    // Write to JSONL stream
    this.writeToStream(item);

    // Update session
    this.saveSession();
  }

  /**
   * Write item to JSONL stream
   * @param item - Batch result item
   */
  private writeToStream(item: BatchResultItem): void {
    if (this.outputStream) {
      this.outputStream.write(JSON.stringify(item) + '\n');
    }
  }

  /**
   * Save session metadata to file
   */
  private saveSession(): void {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { writeFileSync } = require('fs') as typeof import('fs');
    writeFileSync(this.sessionPath, JSON.stringify(this.session, null, 2));
  }

  /**
   * Get items that need to be processed (for resume capability)
   * @param allItems - All batch items
   * @returns Items that haven't been processed yet
   */
  getUnprocessedItems(allItems: Array<{ id: string; imagePath: string }>): Array<{ id: string; imagePath: string }> {
    const processed = new Set(this.results.keys());
    return allItems.filter((item) => !processed.has(item.id));
  }

  /**
   * Load previous session from file
   * @param outputPath - Path to output file
   * @returns Batch session or null if not found
   */
  static loadSession(outputPath: string): BatchSession | null {
    const sessionPath = outputPath.replace(/\.jsonl?$/, '.session.json');

    if (!existsSync(sessionPath)) {
      return null;
    }

    try {
      const content = readFileSync(sessionPath, 'utf-8');
      return JSON.parse(content) as BatchSession;
    } catch (error) {
      logger.error('Failed to load session', { error: (error as Error).message });
      return null;
    }
  }

  /**
   * Load results from JSONL file
   * @param outputPath - Path to JSONL file
   * @returns Map of results by ID
   */
  static loadResults(outputPath: string): Map<string, BatchResultItem> {
    const results = new Map<string, BatchResultItem>();

    if (!existsSync(outputPath)) {
      return results;
    }

    try {
      const content = readFileSync(outputPath, 'utf-8');
      const lines = content.trim().split('\n');

      for (const line of lines) {
        if (line.trim()) {
          const item = JSON.parse(line) as BatchResultItem;
          results.set(item.id, item);
        }
      }

      logger.info('Loaded previous results', { count: results.size });
    } catch (error) {
      logger.error('Failed to load results', { error: (error as Error).message });
    }

    return results;
  }

  /**
   * Finalize batch processing
   */
  finalize(): void {
    this.session.endTime = new Date();

    if (this.outputStream) {
      this.outputStream.end();
    }

    this.saveSession();

    logger.info('Batch result manager finalized', {
      sessionId: this.session.sessionId,
      totalItems: this.session.totalItems,
      completedItems: this.session.completedItems,
      successfulItems: this.session.successfulItems,
      failedItems: this.session.failedItems,
      skippedItems: this.session.skippedItems,
    });
  }

  /**
   * Get session metadata
   * @returns Batch session
   */
  getSession(): BatchSession {
    return { ...this.session };
  }

  /**
   * Get all results
   * @returns Map of results
   */
  getResults(): Map<string, BatchResultItem> {
    return new Map(this.results);
  }

  /**
   * Generate unique session ID
   * @returns Session ID
   */
  private generateSessionId(): string {
    return `batch-${Date.now()}-${Math.random().toString(36).substring(7)}`;
  }
}
