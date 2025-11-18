/**
 * Image Optimizer
 * Sharp-based image optimization for size reduction and token savings
 */

import sharp from 'sharp';
import { readFile } from 'fs/promises';
import { logger } from '../utils/logger';

/**
 * Optimization statistics
 */
export interface OptimizationStats {
  originalSize: number;
  optimizedSize: number;
  reduction: number; // percentage
  originalDimensions: string;
  optimizedDimensions: string;
  originalFormat?: string;
  optimizedFormat: string;
  quality: number;
}

/**
 * Optimization options
 */
export interface OptimizationOptions {
  maxWidth?: number;
  maxHeight?: number;
  quality?: number;
  targetSizeKB?: number;
  minQuality?: number;
  progressive?: boolean;
}

/**
 * Image optimizer using Sharp
 */
export class ImageOptimizer {
  private defaultOptions: Required<OptimizationOptions> = {
    maxWidth: 2048,
    maxHeight: 2048,
    quality: 85,
    targetSizeKB: 500,
    minQuality: 60,
    progressive: true,
  };

  /**
   * Optimize an image from file path
   * @param imagePath - Path to image file
   * @param options - Optimization options
   * @returns Optimized image buffer
   */
  async optimize(imagePath: string, options: OptimizationOptions = {}): Promise<Buffer> {
    const opts = { ...this.defaultOptions, ...options };

    try {
      // Read original image
      const buffer = await readFile(imagePath);

      // Get metadata
      const metadata = await sharp(buffer).metadata();

      logger.debug('Optimizing image', {
        path: imagePath,
        originalSize: buffer.length,
        originalFormat: metadata.format,
        originalDimensions: `${metadata.width}x${metadata.height}`,
      });

      // Resize to max dimensions (maintains aspect ratio, doesn't enlarge)
      const optimized = sharp(buffer).resize(opts.maxWidth, opts.maxHeight, {
        fit: 'inside',
        withoutEnlargement: true,
      });

      // Convert to JPEG with initial quality
      let jpegBuffer = await optimized
        .jpeg({
          quality: opts.quality,
          progressive: opts.progressive,
        })
        .toBuffer();

      // If still too large, reduce quality iteratively
      const targetSize = opts.targetSizeKB * 1024;
      let finalQuality = opts.quality;

      if (jpegBuffer.length > targetSize) {
        for (let quality = opts.quality - 5; quality >= opts.minQuality; quality -= 5) {
          jpegBuffer = await sharp(buffer)
            .resize(opts.maxWidth, opts.maxHeight, {
              fit: 'inside',
              withoutEnlargement: true,
            })
            .jpeg({
              quality,
              progressive: opts.progressive,
            })
            .toBuffer();

          finalQuality = quality;

          if (jpegBuffer.length <= targetSize) {
            break;
          }
        }
      }

      logger.debug('Image optimization complete', {
        path: imagePath,
        originalSize: buffer.length,
        optimizedSize: jpegBuffer.length,
        reduction: ((1 - jpegBuffer.length / buffer.length) * 100).toFixed(2) + '%',
        finalQuality,
      });

      return jpegBuffer;
    } catch (error) {
      logger.error('Image optimization failed', {
        path: imagePath,
        error: (error as Error).message,
      });
      throw error;
    }
  }

  /**
   * Optimize image from buffer
   * @param buffer - Image buffer
   * @param options - Optimization options
   * @returns Optimized image buffer
   */
  async optimizeBuffer(buffer: Buffer, options: OptimizationOptions = {}): Promise<Buffer> {
    const opts = { ...this.defaultOptions, ...options };

    try {
      // Resize to max dimensions
      const optimized = sharp(buffer).resize(opts.maxWidth, opts.maxHeight, {
        fit: 'inside',
        withoutEnlargement: true,
      });

      // Convert to JPEG with initial quality
      let jpegBuffer = await optimized
        .jpeg({
          quality: opts.quality,
          progressive: opts.progressive,
        })
        .toBuffer();

      // If still too large, reduce quality iteratively
      const targetSize = opts.targetSizeKB * 1024;

      if (jpegBuffer.length > targetSize) {
        for (let quality = opts.quality - 5; quality >= opts.minQuality; quality -= 5) {
          jpegBuffer = await sharp(buffer)
            .resize(opts.maxWidth, opts.maxHeight, {
              fit: 'inside',
              withoutEnlargement: true,
            })
            .jpeg({
              quality,
              progressive: opts.progressive,
            })
            .toBuffer();

          if (jpegBuffer.length <= targetSize) {
            break;
          }
        }
      }

      logger.debug('Buffer optimization complete', {
        originalSize: buffer.length,
        optimizedSize: jpegBuffer.length,
        reduction: ((1 - jpegBuffer.length / buffer.length) * 100).toFixed(2) + '%',
      });

      return jpegBuffer;
    } catch (error) {
      logger.error('Buffer optimization failed', {
        error: (error as Error).message,
      });
      throw error;
    }
  }

  /**
   * Get optimization statistics
   * @param original - Original image buffer
   * @param optimized - Optimized image buffer
   * @returns Optimization statistics
   */
  async getOptimizationStats(
    original: Buffer,
    optimized: Buffer
  ): Promise<OptimizationStats> {
    const originalMeta = await sharp(original).metadata();
    const optimizedMeta = await sharp(optimized).metadata();

    return {
      originalSize: original.length,
      optimizedSize: optimized.length,
      reduction: ((1 - optimized.length / original.length) * 100),
      originalDimensions: `${originalMeta.width}x${originalMeta.height}`,
      optimizedDimensions: `${optimizedMeta.width}x${optimizedMeta.height}`,
      originalFormat: originalMeta.format,
      optimizedFormat: optimizedMeta.format || 'jpeg',
      quality: 85, // Default quality since Sharp doesn't expose it in metadata
    };
  }

  /**
   * Batch optimize multiple images
   * @param imagePaths - Array of image paths
   * @param options - Optimization options
   * @returns Array of optimized buffers
   */
  async batchOptimize(
    imagePaths: string[],
    options: OptimizationOptions = {}
  ): Promise<Buffer[]> {
    const startTime = Date.now();
    logger.info('Starting batch optimization', { count: imagePaths.length });

    const promises = imagePaths.map((path) => this.optimize(path, options));
    const results = await Promise.all(promises);

    const duration = Date.now() - startTime;
    const throughput = (imagePaths.length / duration) * 1000 * 60; // images per minute

    logger.info('Batch optimization complete', {
      count: imagePaths.length,
      durationMs: duration,
      imagesPerMinute: Math.round(throughput),
    });

    return results;
  }

  /**
   * Check if optimization would be beneficial
   * @param imagePath - Path to image file
   * @returns True if optimization is recommended
   */
  async shouldOptimize(imagePath: string): Promise<boolean> {
    try {
      const buffer = await readFile(imagePath);
      const metadata = await sharp(buffer).metadata();

      // Check if image exceeds size threshold
      const sizeThreshold = this.defaultOptions.targetSizeKB * 1024;
      if (buffer.length > sizeThreshold) {
        return true;
      }

      // Check if image exceeds dimension threshold
      const width = metadata.width || 0;
      const height = metadata.height || 0;
      if (width > this.defaultOptions.maxWidth || height > this.defaultOptions.maxHeight) {
        return true;
      }

      // Check if format is not JPEG
      if (metadata.format !== 'jpeg') {
        return true;
      }

      return false;
    } catch (error) {
      logger.error('Failed to check optimization need', {
        path: imagePath,
        error: (error as Error).message,
      });
      return false;
    }
  }

  /**
   * Get image metadata
   * @param imagePath - Path to image file
   * @returns Image metadata
   */
  async getMetadata(imagePath: string): Promise<sharp.Metadata> {
    const buffer = await readFile(imagePath);
    return sharp(buffer).metadata();
  }
}
