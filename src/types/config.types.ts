/**
 * Configuration type definitions
 * Defines application and provider configuration types
 */

import type { AIProvider, ProviderConfig } from './provider.types';

/**
 * Log level
 */
export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

/**
 * Application configuration
 */
export interface AppConfig {
  /** Provider configurations */
  providers: {
    /** Google Gemini configuration */
    gemini?: ProviderConfig;

    /** Anthropic Claude configuration */
    claude?: ProviderConfig;

    /** OpenAI GPT-4V configuration */
    openai?: ProviderConfig;

    /** AWS Bedrock configuration */
    bedrock?: ProviderConfig;
  };

  /** Default provider to use */
  defaultProvider: AIProvider;

  /** Global concurrency limit (max parallel requests) */
  maxConcurrentRequests?: number;

  /** Enable result caching */
  enableCache?: boolean;

  /** Output directory for results */
  outputDir?: string;

  /** Log level */
  logLevel?: LogLevel;
}
