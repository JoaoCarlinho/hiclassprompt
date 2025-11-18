/**
 * Image type definitions
 * Defines types for image inputs, metadata, and formats
 */

/**
 * Supported image formats
 */
export enum ImageFormat {
  JPEG = 'jpeg',
  PNG = 'png',
  WEBP = 'webp',
  GIF = 'gif',
}

/**
 * Image metadata
 */
export interface ImageMetadata {
  /** File path or URL */
  path: string;

  /** Image format */
  format: ImageFormat;

  /** File size in bytes */
  sizeBytes: number;

  /** Image width in pixels */
  width?: number;

  /** Image height in pixels */
  height?: number;

  /** Last modification date */
  lastModified?: Date;
}

/**
 * Image input for classification
 */
export interface ImageInput {
  /** File path or URL to image */
  source: string;

  /** Optional base64-encoded image data */
  base64Data?: string;

  /** Image metadata */
  metadata?: ImageMetadata;

  /** Optional context hints for better classification */
  hints?: {
    /** Image title */
    title?: string;

    /** Image description */
    description?: string;
  };
}
