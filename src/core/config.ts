/**
 * Configuration loader
 * Loads application configuration from environment variables and config files
 */

import { config as loadEnv } from 'dotenv';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { AppConfig, AIProvider } from '../types';

/**
 * Load application configuration from environment and config file
 * Priority: Environment variables > config.json > defaults
 */
export function loadConfig(): AppConfig {
  // Load .env file
  loadEnv();

  // Default configuration
  let config: AppConfig = {
    providers: {},
    defaultProvider: AIProvider.GOOGLE_GEMINI,
    maxConcurrentRequests: 10,
    enableCache: true,
    outputDir: './output',
    logLevel: 'info',
  };

  // Try to load config.json
  const configPath = join(process.cwd(), 'config.json');
  if (existsSync(configPath)) {
    const fileConfig = JSON.parse(readFileSync(configPath, 'utf-8')) as Partial<AppConfig>;
    config = { ...config, ...fileConfig };
  }

  // Environment variables override file config
  if (process.env.GEMINI_API_KEY) {
    config.providers.gemini = {
      provider: AIProvider.GOOGLE_GEMINI,
      apiKey: process.env.GEMINI_API_KEY,
      model: process.env.GEMINI_MODEL || 'gemini-2.0-flash-exp',
      rateLimitPerMinute: 360,
    };
  }

  if (process.env.ANTHROPIC_API_KEY) {
    config.providers.claude = {
      provider: AIProvider.ANTHROPIC_CLAUDE,
      apiKey: process.env.ANTHROPIC_API_KEY,
      model: process.env.CLAUDE_MODEL || 'claude-3-5-sonnet-20241022',
    };
  }

  if (process.env.OPENAI_API_KEY) {
    config.providers.openai = {
      provider: AIProvider.OPENAI_GPT4V,
      apiKey: process.env.OPENAI_API_KEY,
      model: process.env.OPENAI_MODEL || 'gpt-4-vision-preview',
    };
  }

  if (process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY) {
    config.providers.bedrock = {
      provider: AIProvider.AWS_BEDROCK,
      apiKey: process.env.AWS_ACCESS_KEY_ID,
      model: process.env.AWS_BEDROCK_MODEL || 'anthropic.claude-3-sonnet-20240229-v1:0',
    };
  }

  if (process.env.DEFAULT_PROVIDER) {
    config.defaultProvider = process.env.DEFAULT_PROVIDER as AIProvider;
  }

  if (process.env.MAX_CONCURRENT_REQUESTS) {
    config.maxConcurrentRequests = parseInt(process.env.MAX_CONCURRENT_REQUESTS, 10);
  }

  if (process.env.ENABLE_CACHE) {
    config.enableCache = process.env.ENABLE_CACHE === 'true';
  }

  if (process.env.OUTPUT_DIR) {
    config.outputDir = process.env.OUTPUT_DIR;
  }

  if (process.env.LOG_LEVEL) {
    config.logLevel = process.env.LOG_LEVEL as AppConfig['logLevel'];
  }

  return config;
}
