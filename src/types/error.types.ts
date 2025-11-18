/**
 * Error type definitions
 * Defines structured error types for the application
 */

import type { AIProvider } from './provider.types';

/**
 * Error types
 */
export enum ErrorType {
  /** Provider-specific error (API error, model error, etc.) */
  PROVIDER_ERROR = 'provider_error',

  /** Authentication/authorization error */
  AUTHENTICATION_ERROR = 'authentication_error',

  /** Rate limit exceeded */
  RATE_LIMIT_ERROR = 'rate_limit_error',

  /** Image processing error (invalid format, corrupt file, etc.) */
  IMAGE_ERROR = 'image_error',

  /** Input validation error */
  VALIDATION_ERROR = 'validation_error',

  /** Network/connectivity error */
  NETWORK_ERROR = 'network_error',

  /** Request timeout */
  TIMEOUT_ERROR = 'timeout_error',

  /** Unknown/unexpected error */
  UNKNOWN_ERROR = 'unknown_error',
}

/**
 * Structured error response
 */
export interface ClassificationError {
  /** Error type */
  type: ErrorType;

  /** Human-readable error message */
  message: string;

  /** Provider that generated the error (if applicable) */
  provider?: AIProvider;

  /** Request ID associated with error (if applicable) */
  requestId?: string;

  /** Whether the operation can be retried */
  retryable: boolean;

  /** Original error object (if available) */
  originalError?: Error;

  /** Timestamp when error occurred */
  timestamp: Date;
}

/**
 * Result type that can be success or error
 * Discriminated union for type-safe error handling
 */
export type ClassificationResponse =
  | { success: true; data: ClassificationResult }
  | { success: false; error: ClassificationError };

// Import ClassificationResult type (forward reference)
import type { ClassificationResult } from './classification.types';
