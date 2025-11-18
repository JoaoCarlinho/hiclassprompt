/**
 * Batch Input System
 * Handles directory scanning, CSV/JSON parsing, and input validation
 */

import { readdirSync, statSync, readFileSync } from 'fs';
import { join, extname } from 'path';
import { parse } from 'csv-parse/sync';
import { validateImagePath } from '../utils/validators';
import { logger } from '../utils/logger';

/**
 * Batch input item
 */
export interface BatchInputItem {
  id: string;
  imagePath: string;
  metadata?: {
    title?: string;
    description?: string;
    [key: string]: unknown;
  };
}

/**
 * Batch input options
 */
export interface BatchInputOptions {
  recursive?: boolean;
  deduplicate?: boolean;
  validatePaths?: boolean;
}

/**
 * Batch input result
 */
export interface BatchInputResult {
  items: BatchInputItem[];
  totalFound: number;
  validItems: number;
  invalidItems: number;
  duplicatesRemoved: number;
}

/**
 * Batch input system
 */
export class BatchInput {
  /**
   * Scan directory for images
   * @param directory - Directory path to scan
   * @param options - Scanning options
   * @returns Batch input result
   */
  static scanDirectory(directory: string, options: BatchInputOptions = {}): BatchInputResult {
    const { recursive = false, deduplicate = true, validatePaths = true } = options;

    logger.info('Scanning directory for images', { directory, recursive });

    const items: BatchInputItem[] = [];
    const seenPaths = new Set<string>();
    let duplicatesRemoved = 0;
    let invalidItems = 0;

    const scanDir = (dir: string): void => {
      const entries = readdirSync(dir);

      for (const entry of entries) {
        const fullPath = join(dir, entry);
        const stat = statSync(fullPath);

        if (stat.isDirectory()) {
          if (recursive) {
            scanDir(fullPath);
          }
        } else if (stat.isFile()) {
          const ext = extname(entry).toLowerCase();
          if (['.jpg', '.jpeg', '.png', '.webp', '.gif'].includes(ext)) {
            // Check for duplicates
            if (deduplicate && seenPaths.has(fullPath)) {
              duplicatesRemoved++;
              continue;
            }

            // Validate path if requested
            if (validatePaths) {
              try {
                validateImagePath(fullPath);
              } catch {
                logger.warn('Invalid image path', { path: fullPath });
                invalidItems++;
                continue;
              }
            }

            seenPaths.add(fullPath);
            items.push({
              id: this.generateId(fullPath),
              imagePath: fullPath,
            });
          }
        }
      }
    };

    scanDir(directory);

    logger.info('Directory scan complete', {
      totalFound: items.length + duplicatesRemoved + invalidItems,
      validItems: items.length,
      invalidItems,
      duplicatesRemoved,
    });

    return {
      items,
      totalFound: items.length + duplicatesRemoved + invalidItems,
      validItems: items.length,
      invalidItems,
      duplicatesRemoved,
    };
  }

  /**
   * Load batch from CSV file
   * @param csvPath - Path to CSV file
   * @param options - Loading options
   * @returns Batch input result
   */
  static loadFromCSV(csvPath: string, options: BatchInputOptions = {}): BatchInputResult {
    const { deduplicate = true, validatePaths = true } = options;

    logger.info('Loading batch from CSV', { csvPath });

    const content = readFileSync(csvPath, 'utf-8');
    const records = parse(content, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
    });

    const items: BatchInputItem[] = [];
    const seenPaths = new Set<string>();
    let duplicatesRemoved = 0;
    let invalidItems = 0;

    for (const record of records) {
      const typedRecord = record as Record<string, string>;
      const imagePath = typedRecord.path || typedRecord.image;
      if (!imagePath) {
        invalidItems++;
        continue;
      }

      // Check for duplicates
      if (deduplicate && seenPaths.has(imagePath)) {
        duplicatesRemoved++;
        continue;
      }

      // Validate path if requested
      if (validatePaths) {
        try {
          validateImagePath(imagePath);
        } catch {
          logger.warn('Invalid image path in CSV', { path: imagePath });
          invalidItems++;
          continue;
        }
      }

      seenPaths.add(imagePath);

      // Extract metadata
      const metadata: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(typedRecord)) {
        if (key !== 'path' && key !== 'image') {
          metadata[key] = value;
        }
      }

      items.push({
        id: this.generateId(imagePath),
        imagePath,
        metadata: Object.keys(metadata).length > 0 ? metadata : undefined,
      });
    }

    logger.info('CSV load complete', {
      totalFound: records.length,
      validItems: items.length,
      invalidItems,
      duplicatesRemoved,
    });

    return {
      items,
      totalFound: records.length,
      validItems: items.length,
      invalidItems,
      duplicatesRemoved,
    };
  }

  /**
   * Load batch from JSON/JSONL file
   * @param jsonPath - Path to JSON/JSONL file
   * @param options - Loading options
   * @returns Batch input result
   */
  static loadFromJSON(jsonPath: string, options: BatchInputOptions = {}): BatchInputResult {
    const { deduplicate = true, validatePaths = true } = options;

    logger.info('Loading batch from JSON', { jsonPath });

    const content = readFileSync(jsonPath, 'utf-8');
    let records: Array<{ path?: string; image?: string; imagePath?: string; [key: string]: unknown }>;

    // Try JSONL format first (one JSON object per line)
    if (content.includes('\n')) {
      const lines = content.trim().split('\n');
      if (lines.every((line) => line.trim().startsWith('{'))) {
        records = lines.map((line) => JSON.parse(line) as Record<string, unknown>);
      } else {
        records = JSON.parse(content) as Record<string, unknown>[];
      }
    } else {
      records = JSON.parse(content) as Record<string, unknown>[];
    }

    if (!Array.isArray(records)) {
      throw new Error('JSON file must contain an array of objects');
    }

    const items: BatchInputItem[] = [];
    const seenPaths = new Set<string>();
    let duplicatesRemoved = 0;
    let invalidItems = 0;

    for (const record of records) {
      const imagePath = record.path || record.image || record.imagePath;
      if (!imagePath || typeof imagePath !== 'string') {
        invalidItems++;
        continue;
      }

      // Check for duplicates
      if (deduplicate && seenPaths.has(imagePath)) {
        duplicatesRemoved++;
        continue;
      }

      // Validate path if requested
      if (validatePaths) {
        try {
          validateImagePath(imagePath);
        } catch {
          logger.warn('Invalid image path in JSON', { path: imagePath });
          invalidItems++;
          continue;
        }
      }

      seenPaths.add(imagePath);

      // Extract metadata
      const metadata: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(record)) {
        if (key !== 'path' && key !== 'image' && key !== 'imagePath') {
          metadata[key] = value;
        }
      }

      items.push({
        id: this.generateId(imagePath),
        imagePath,
        metadata: Object.keys(metadata).length > 0 ? metadata : undefined,
      });
    }

    logger.info('JSON load complete', {
      totalFound: records.length,
      validItems: items.length,
      invalidItems,
      duplicatesRemoved,
    });

    return {
      items,
      totalFound: records.length,
      validItems: items.length,
      invalidItems,
      duplicatesRemoved,
    };
  }

  /**
   * Generate unique ID for an image path
   * @param imagePath - Image file path
   * @returns Unique identifier
   */
  private static generateId(imagePath: string): string {
    // Use path + timestamp + random for uniqueness
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 8);
    const pathHash = Buffer.from(imagePath).toString('base64').substring(0, 12);
    return `${pathHash}-${timestamp}-${random}`;
  }
}
