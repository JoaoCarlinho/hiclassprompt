/**
 * Image Fingerprinting
 * Uses perceptual hashing to identify duplicate images
 */

import imghash from 'imghash';
import { logger } from '../utils/logger';

/**
 * Duplicate group containing original and duplicate images
 */
export interface DuplicateGroup {
  original: string;
  duplicates: string[];
  similarity?: number[];
}

/**
 * Fingerprint statistics
 */
export interface FingerprintStats {
  totalImages: number;
  duplicateGroups: number;
  totalDuplicates: number;
  processingTimeMs: number;
  avgProcessingTimePerImage: number;
}

/**
 * Fingerprinter configuration
 */
export interface FingerprinterConfig {
  similarityThreshold?: number;
  cacheFingerprints?: boolean;
  bits?: 8 | 16 | 32 | 64 | 128 | 256;
}

/**
 * Image fingerprinting for duplicate detection
 * Uses perceptual hashing (pHash) to detect similar images
 */
export class ImageFingerprinter {
  private fingerprintCache: Map<string, string> = new Map();
  private config: Required<FingerprinterConfig>;
  private stats = {
    totalProcessed: 0,
    cacheHits: 0,
    cacheMisses: 0,
  };

  constructor(config: FingerprinterConfig = {}) {
    this.config = {
      similarityThreshold: config.similarityThreshold ?? 5,
      cacheFingerprints: config.cacheFingerprints ?? true,
      bits: config.bits || 256,
    };

    logger.info('Image fingerprinter initialized', {
      threshold: this.config.similarityThreshold,
      cacheEnabled: this.config.cacheFingerprints,
      bits: this.config.bits,
    });
  }

  /**
   * Generate perceptual hash fingerprint for an image
   * @param imagePath - Path to image file
   * @returns Hexadecimal hash string
   */
  async generateFingerprint(imagePath: string): Promise<string> {
    // Check cache first
    if (this.config.cacheFingerprints) {
      const cached = this.fingerprintCache.get(imagePath);
      if (cached) {
        this.stats.cacheHits++;
        logger.debug('Fingerprint cache hit', { path: imagePath });
        return cached;
      }
      this.stats.cacheMisses++;
    }

    try {
      const startTime = Date.now();

      // Generate perceptual hash using imghash
      const fingerprint = await imghash.hash(imagePath, this.config.bits);

      const duration = Date.now() - startTime;
      this.stats.totalProcessed++;

      // Cache result
      if (this.config.cacheFingerprints) {
        this.fingerprintCache.set(imagePath, fingerprint);
      }

      logger.debug('Fingerprint generated', {
        path: imagePath,
        durationMs: duration,
        fingerprint: fingerprint.substring(0, 16) + '...',
      });

      return fingerprint;
    } catch (error) {
      logger.error('Failed to fingerprint image', {
        path: imagePath,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw new Error(`Failed to fingerprint image: ${imagePath}`);
    }
  }

  /**
   * Generate fingerprints for multiple images in parallel
   * @param imagePaths - Array of image paths
   * @returns Map of image path to fingerprint
   */
  async batchFingerprint(
    imagePaths: string[]
  ): Promise<Map<string, string>> {
    logger.info('Batch fingerprinting', { count: imagePaths.length });

    const startTime = Date.now();
    const results = new Map<string, string>();

    // Process in parallel
    const promises = imagePaths.map(async (path) => {
      try {
        const fingerprint = await this.generateFingerprint(path);
        results.set(path, fingerprint);
      } catch (error) {
        logger.warn('Skipping failed fingerprint', {
          path,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    });

    await Promise.all(promises);

    const duration = Date.now() - startTime;
    logger.info('Batch fingerprinting complete', {
      count: results.size,
      durationMs: duration,
      avgMs: duration / results.size,
    });

    return results;
  }

  /**
   * Calculate Hamming distance between two hash strings
   * @param hash1 - First hash
   * @param hash2 - Second hash
   * @returns Hamming distance (0 = identical)
   */
  hammingDistance(hash1: string, hash2: string): number {
    if (hash1.length !== hash2.length) {
      throw new Error('Hash lengths must match for comparison');
    }

    let distance = 0;

    for (let i = 0; i < hash1.length; i++) {
      if (hash1[i] !== hash2[i]) {
        distance++;
      }
    }

    return distance;
  }

  /**
   * Check if two hashes represent duplicate images
   * @param hash1 - First hash
   * @param hash2 - Second hash
   * @param threshold - Optional threshold override
   * @returns True if images are considered duplicates
   */
  isDuplicate(hash1: string, hash2: string, threshold?: number): boolean {
    const distance = this.hammingDistance(hash1, hash2);
    const maxDistance = threshold ?? this.config.similarityThreshold;
    return distance <= maxDistance;
  }

  /**
   * Calculate similarity percentage between two images
   * @param hash1 - First hash
   * @param hash2 - Second hash
   * @returns Similarity percentage (0-100)
   */
  calculateSimilarity(hash1: string, hash2: string): number {
    const distance = this.hammingDistance(hash1, hash2);
    const maxDistance = hash1.length;
    const similarity = ((maxDistance - distance) / maxDistance) * 100;
    return Math.round(similarity * 100) / 100;
  }

  /**
   * Find duplicate images in a set
   * @param imagePaths - Array of image paths to analyze
   * @param threshold - Optional similarity threshold override
   * @returns Array of duplicate groups
   */
  async findDuplicates(
    imagePaths: string[],
    threshold?: number
  ): Promise<DuplicateGroup[]> {
    logger.info('Finding duplicates', {
      count: imagePaths.length,
      threshold: threshold ?? this.config.similarityThreshold,
    });

    const startTime = Date.now();

    // Generate fingerprints for all images
    const fingerprints = await this.batchFingerprint(imagePaths);

    // Convert to array for easier processing
    const hashes = Array.from(fingerprints.entries()).map(([path, hash]) => ({
      path,
      hash,
    }));

    const groups: DuplicateGroup[] = [];
    const seen = new Set<number>();

    // Find duplicate groups
    for (let i = 0; i < hashes.length; i++) {
      if (seen.has(i)) continue;

      const currentHash = hashes[i];
      if (!currentHash) continue;

      const group: DuplicateGroup = {
        original: currentHash.path,
        duplicates: [],
        similarity: [],
      };

      for (let j = i + 1; j < hashes.length; j++) {
        if (seen.has(j)) continue;

        const compareHash = hashes[j];
        if (!compareHash) continue;

        if (this.isDuplicate(currentHash.hash, compareHash.hash, threshold)) {
          group.duplicates.push(compareHash.path);
          const similarity = this.calculateSimilarity(currentHash.hash, compareHash.hash);
          group.similarity!.push(similarity);
          seen.add(j);
        }
      }

      if (group.duplicates.length > 0) {
        groups.push(group);
      }
    }

    const duration = Date.now() - startTime;

    const stats: FingerprintStats = {
      totalImages: imagePaths.length,
      duplicateGroups: groups.length,
      totalDuplicates: groups.reduce((sum, g) => sum + g.duplicates.length, 0),
      processingTimeMs: duration,
      avgProcessingTimePerImage: duration / imagePaths.length,
    };

    logger.info('Duplicate detection complete', stats);

    return groups;
  }

  /**
   * Compare two images for similarity
   * @param imagePath1 - First image path
   * @param imagePath2 - Second image path
   * @returns Object with similarity percentage and isDuplicate flag
   */
  async compareImages(
    imagePath1: string,
    imagePath2: string
  ): Promise<{ similarity: number; isDuplicate: boolean }> {
    const hash1 = await this.generateFingerprint(imagePath1);
    const hash2 = await this.generateFingerprint(imagePath2);

    const similarity = this.calculateSimilarity(hash1, hash2);
    const isDuplicate = this.isDuplicate(hash1, hash2);

    return { similarity, isDuplicate };
  }

  /**
   * Get fingerprinting statistics
   * @returns Statistics about fingerprinting operations
   */
  getStats() {
    return {
      ...this.stats,
      cacheSize: this.fingerprintCache.size,
      cacheHitRate:
        this.stats.cacheHits + this.stats.cacheMisses > 0
          ? (this.stats.cacheHits / (this.stats.cacheHits + this.stats.cacheMisses)) * 100
          : 0,
    };
  }

  /**
   * Clear fingerprint cache
   */
  clearCache(): void {
    const previousSize = this.fingerprintCache.size;
    this.fingerprintCache.clear();
    logger.info('Fingerprint cache cleared', { previousSize });
  }

  /**
   * Reset statistics
   */
  resetStats(): void {
    this.stats = {
      totalProcessed: 0,
      cacheHits: 0,
      cacheMisses: 0,
    };
    logger.info('Fingerprint statistics reset');
  }
}
