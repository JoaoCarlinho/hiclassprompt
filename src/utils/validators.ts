/**
 * Validation utilities
 * Input validation functions for images and other data
 */

import { existsSync, statSync } from 'fs';
import { resolve } from 'path';

const SUPPORTED_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp', '.gif'];

/**
 * Validate image path exists and is a supported format
 * @param path - Path to image file
 * @returns Absolute path to validated image
 * @throws Error if path is invalid or unsupported format
 */
export function validateImagePath(path: string): string {
  // Resolve to absolute path
  const absolutePath = resolve(path);

  // Check file exists
  if (!existsSync(absolutePath)) {
    throw new Error(`Image file not found: ${path}`);
  }

  // Check it's a file (not directory)
  const stats = statSync(absolutePath);
  if (!stats.isFile()) {
    throw new Error(`Path is not a file: ${path}`);
  }

  // Check file extension
  const ext = absolutePath.toLowerCase().match(/\.[^.]+$/)?.[0];
  if (!ext || !SUPPORTED_EXTENSIONS.includes(ext)) {
    throw new Error(
      `Unsupported image format. Supported: ${SUPPORTED_EXTENSIONS.join(', ')}`
    );
  }

  return absolutePath;
}

/**
 * Get supported image extensions
 */
export function getSupportedExtensions(): string[] {
  return [...SUPPORTED_EXTENSIONS];
}
