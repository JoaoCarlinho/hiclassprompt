/**
 * Provider Manager
 * Manages lifecycle and access to AI providers
 */

import type { IProvider, AIProvider, AppConfig } from '../types';
import { ProviderFactory } from '../providers/provider-factory';
import { logger } from '../utils/logger';

/**
 * Manages initialized AI providers
 */
export class ProviderManager {
  private providers: Map<AIProvider, IProvider> = new Map();
  private config: AppConfig;

  constructor(config: AppConfig) {
    this.config = config;
  }

  /**
   * Initialize all configured providers
   */
  async initialize(): Promise<void> {
    logger.info('Initializing providers...');

    const initPromises: Promise<void>[] = [];

    for (const [name, config] of Object.entries(this.config.providers)) {
      if (config) {
        initPromises.push(
          (async (): Promise<void> => {
            try {
              const provider = ProviderFactory.create(config);
              await provider.validateConfig();
              this.providers.set(config.provider, provider);
              logger.info(`Provider initialized: ${config.provider}`);
            } catch (error) {
              const err = error as Error;
              logger.warn(`Failed to initialize provider: ${name}`, { error: err.message });
            }
          })()
        );
      }
    }

    await Promise.all(initPromises);

    if (this.providers.size === 0) {
      throw new Error('No providers could be initialized');
    }

    logger.info(`Initialized ${this.providers.size} provider(s)`);
  }

  /**
   * Get a specific provider instance
   * @param provider - Provider type
   * @returns Provider instance
   * @throws Error if provider is not available
   */
  getProvider(provider: AIProvider): IProvider {
    const instance = this.providers.get(provider);

    if (!instance) {
      const available = Array.from(this.providers.keys()).join(', ');
      throw new Error(
        `Provider not available: ${provider}. Available providers: ${available || 'none'}`
      );
    }

    return instance;
  }

  /**
   * Get the default provider instance
   * @returns Default provider instance
   */
  getDefaultProvider(): IProvider {
    return this.getProvider(this.config.defaultProvider);
  }

  /**
   * Get all initialized provider instances
   * @returns Array of provider instances
   */
  getAllProviders(): IProvider[] {
    return Array.from(this.providers.values());
  }

  /**
   * Get all initialized provider types
   * @returns Array of provider types
   */
  getAvailableProviders(): AIProvider[] {
    return Array.from(this.providers.keys());
  }

  /**
   * Check if a provider is available
   * @param provider - Provider type to check
   * @returns True if provider is initialized and available
   */
  isProviderAvailable(provider: AIProvider): boolean {
    return this.providers.has(provider);
  }

  /**
   * Get number of initialized providers
   * @returns Count of providers
   */
  getProviderCount(): number {
    return this.providers.size;
  }
}
