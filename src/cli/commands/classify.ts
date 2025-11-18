/**
 * Classify command handler
 * Handles single image classification via CLI
 */

import { writeFileSync } from 'fs';
import type { AIProvider } from '../../types';
import { loadConfig } from '../../core/config';
import { validateImagePath } from '../../utils/validators';
import { logger } from '../../utils/logger';
import { ProviderFactory } from '../../providers/provider-factory';

/**
 * Classify command options
 */
interface ClassifyOptions {
  provider: string;
  output?: string;
  verbose?: boolean;
  cache: boolean;
}

/**
 * Classify command handler
 * @param imagePath - Path to image file
 * @param options - Command options
 */
export async function classifyCommand(imagePath: string, options: ClassifyOptions): Promise<void> {
  try {
    // Set log level
    if (options.verbose) {
      logger.setLevel('debug');
    }

    // Load configuration
    const config = loadConfig();
    logger.debug('Configuration loaded', { providers: Object.keys(config.providers) });

    // Validate image path
    const validatedPath = validateImagePath(imagePath);
    logger.info(`Classifying image: ${validatedPath}`);

    // Validate provider
    const providerValues = ['gemini', 'claude', 'openai', 'bedrock'];
    if (!providerValues.includes(options.provider)) {
      throw new Error(
        `Invalid provider: ${options.provider}. Must be one of: ${providerValues.join(', ')}`
      );
    }

    const provider = options.provider as AIProvider;

    // Check if provider is configured
    const providerKey = provider as keyof typeof config.providers;
    const providerConfig = config.providers[providerKey];
    if (!providerConfig) {
      throw new Error(
        `Provider "${provider}" is not configured. Please set the API key in .env file.`
      );
    }

    // Create provider instance using factory
    const providerInstance = ProviderFactory.create(providerConfig);

    // Validate provider configuration
    logger.info('Validating provider configuration...');
    await providerInstance.validateConfig();

    // Classify image
    logger.info('Classifying image...');
    const result = await providerInstance.classify({
      image: { source: validatedPath },
      provider,
    });

    // Display results
    // eslint-disable-next-line no-console
    console.log('\n=== Classification Results ===');
    // eslint-disable-next-line no-console
    console.log(`Request ID: ${result.requestId}`);
    // eslint-disable-next-line no-console
    console.log(`Provider: ${result.provider} (${String(result.providerMetadata?.model) || 'unknown'})`);
    // eslint-disable-next-line no-console
    console.log(`\nPrimary Category: ${result.primaryCategory?.category || 'Unknown'}`);
    // eslint-disable-next-line no-console
    console.log(`Confidence: ${((result.primaryCategory?.confidence || 0) * 100).toFixed(1)}% (${result.primaryCategory?.confidenceLevel || 'unknown'})`);
    if (result.primaryCategory?.reasoning) {
      // eslint-disable-next-line no-console
      console.log(`Reasoning: ${result.primaryCategory.reasoning}`);
    }

    if (result.categories.length > 1) {
      // eslint-disable-next-line no-console
      console.log('\nAlternative Categories:');
      result.categories.slice(1).forEach((cat, idx) => {
        // eslint-disable-next-line no-console
        console.log(`  ${idx + 2}. ${cat.category} - ${(cat.confidence * 100).toFixed(1)}% (${cat.confidenceLevel})`);
        if (cat.reasoning) {
          // eslint-disable-next-line no-console
          console.log(`     ${cat.reasoning}`);
        }
      });
    }

    // eslint-disable-next-line no-console
    console.log('\n=== Performance Metrics ===');
    // eslint-disable-next-line no-console
    console.log(`Latency: ${result.latencyMs}ms`);
    // eslint-disable-next-line no-console
    console.log(`Tokens: ${result.tokens.total} (input: ${result.tokens.input}, output: ${result.tokens.output})`);
    // eslint-disable-next-line no-console
    console.log(`Cost: $${result.costUsd.toFixed(6)}`);

    // Save to output file if requested
    if (options.output) {
      writeFileSync(options.output, JSON.stringify(result, null, 2));
      logger.info(`Results saved to: ${options.output}`);
      // eslint-disable-next-line no-console
      console.log(`\nResults saved to: ${options.output}`);
    }

    process.exit(0);
  } catch (error) {
    const err = error as Error;
    logger.error('Classification failed', { error: err.message });
    // eslint-disable-next-line no-console
    console.error(`\nError: ${err.message}`);
    process.exit(1);
  }
}
