/**
 * Provider Factory
 * Creates provider instances based on configuration
 */

import type { IProvider, AIProvider, ProviderConfig } from '../types';
import { GeminiProvider } from './gemini/gemini-provider';
import { ClaudeProvider } from './anthropic/claude-provider';
import { OpenAIProvider } from './openai/openai-provider';
import { BedrockProvider } from './bedrock/bedrock-provider';

/**
 * Factory for creating AI provider instances
 */
export class ProviderFactory {
  private static providers: Map<AIProvider, new (apiKey: string, model?: string) => IProvider> =
    new Map<AIProvider, new (apiKey: string, model?: string) => IProvider>([
      ['gemini' as AIProvider, GeminiProvider as new (apiKey: string, model?: string) => IProvider],
      ['claude' as AIProvider, ClaudeProvider as new (apiKey: string, model?: string) => IProvider],
      ['openai' as AIProvider, OpenAIProvider as new (apiKey: string, model?: string) => IProvider],
      ['bedrock' as AIProvider, BedrockProvider as new (apiKey: string, model?: string) => IProvider],
    ]);

  /**
   * Create a provider instance from configuration
   * @param config - Provider configuration
   * @returns Provider instance
   */
  static create(config: ProviderConfig): IProvider {
    const ProviderClass = this.providers.get(config.provider);

    if (!ProviderClass) {
      throw new Error(`Unknown provider: ${config.provider}`);
    }

    return new ProviderClass(config.apiKey, config.model);
  }

  /**
   * Register a new provider implementation
   * @param provider - Provider type
   * @param implementation - Provider class constructor
   */
  static register(
    provider: AIProvider,
    implementation: new (apiKey: string, model?: string) => IProvider
  ): void {
    this.providers.set(provider, implementation);
  }

  /**
   * Get list of supported providers
   * @returns Array of supported provider types
   */
  static getSupportedProviders(): AIProvider[] {
    return Array.from(this.providers.keys());
  }

  /**
   * Check if a provider is registered
   * @param provider - Provider type to check
   * @returns True if provider is registered
   */
  static isProviderRegistered(provider: AIProvider): boolean {
    return this.providers.has(provider);
  }
}
