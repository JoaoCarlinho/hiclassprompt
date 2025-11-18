/**
 * Compare command handler
 * Compares classification results across multiple AI providers
 */

import { writeFileSync } from 'fs';
import type { AIProvider, ClassificationResult } from '../../types';
import { loadConfig } from '../../core/config';
import { validateImagePath } from '../../utils/validators';
import { logger } from '../../utils/logger';
import { ProviderFactory } from '../../providers/provider-factory';

/**
 * Compare command options
 */
interface CompareOptions {
  providers?: string;
  output?: string;
  verbose?: boolean;
  cache: boolean;
}

/**
 * Comparison result aggregating multiple provider results
 */
interface ComparisonResult {
  imagePath: string;
  timestamp: Date;
  results: ClassificationResult[];
  summary: {
    totalProviders: number;
    successfulProviders: number;
    failedProviders: string[];
    averageLatencyMs: number;
    totalCostUsd: number;
    consensusCategory?: string;
    categoryAgreement: number;
  };
}

/**
 * Compare command handler
 * @param imagePath - Path to image file
 * @param options - Command options
 */
export async function compareCommand(imagePath: string, options: CompareOptions): Promise<void> {
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
    logger.info(`Comparing classification across providers for: ${validatedPath}`);

    // Determine which providers to use
    let providersToCompare: AIProvider[];
    if (options.providers) {
      providersToCompare = options.providers.split(',').map((p) => p.trim() as AIProvider);
    } else {
      // Use all configured providers
      providersToCompare = Object.keys(config.providers)
        .filter((key) => config.providers[key as keyof typeof config.providers])
        .map((key) => key as AIProvider);
    }

    if (providersToCompare.length === 0) {
      throw new Error('No providers configured. Please set API keys in .env file.');
    }

    logger.info(`Comparing ${providersToCompare.length} provider(s): ${providersToCompare.join(', ')}`);

    // Run classifications in parallel
    const results: ClassificationResult[] = [];
    const errors: Array<{ provider: AIProvider; error: string }> = [];

    await Promise.all(
      providersToCompare.map(async (provider) => {
        try {
          const providerKey = provider as keyof typeof config.providers;
          const providerConfig = config.providers[providerKey];

          if (!providerConfig) {
            throw new Error(`Provider "${provider}" is not configured`);
          }

          logger.info(`Running classification with ${provider}...`);

          // Create provider instance
          const providerInstance = ProviderFactory.create(providerConfig);

          // Validate configuration
          await providerInstance.validateConfig();

          // Classify image
          const result = await providerInstance.classify({
            image: { source: validatedPath },
            provider,
          });

          results.push(result);
          logger.info(`${provider} completed in ${result.latencyMs}ms`);
        } catch (error) {
          const err = error as Error;
          logger.error(`${provider} failed`, { error: err.message });
          errors.push({ provider, error: err.message });
        }
      })
    );

    if (results.length === 0) {
      throw new Error('All providers failed to classify the image');
    }

    // Calculate summary statistics
    const summary = calculateSummary(results, errors);
    const comparison: ComparisonResult = {
      imagePath: validatedPath,
      timestamp: new Date(),
      results,
      summary,
    };

    // Display results
    displayComparisonResults(comparison, errors);

    // Save to output file if requested
    if (options.output) {
      writeFileSync(options.output, JSON.stringify(comparison, null, 2));
      logger.info(`Results saved to: ${options.output}`);
      // eslint-disable-next-line no-console
      console.log(`\nResults saved to: ${options.output}`);
    }

    process.exit(0);
  } catch (error) {
    const err = error as Error;
    logger.error('Comparison failed', { error: err.message });
    // eslint-disable-next-line no-console
    console.error(`\nError: ${err.message}`);
    process.exit(1);
  }
}

/**
 * Calculate summary statistics from results
 */
function calculateSummary(
  results: ClassificationResult[],
  errors: Array<{ provider: AIProvider; error: string }>
): ComparisonResult['summary'] {
  const totalProviders = results.length + errors.length;
  const averageLatencyMs =
    results.reduce((sum, r) => sum + r.latencyMs, 0) / results.length || 0;
  const totalCostUsd = results.reduce((sum, r) => sum + r.costUsd, 0);

  // Find consensus category (most common primary category)
  const categoryCounts = new Map<string, number>();
  results.forEach((r) => {
    const category = r.primaryCategory?.category;
    if (category) {
      categoryCounts.set(category, (categoryCounts.get(category) || 0) + 1);
    }
  });

  let consensusCategory: string | undefined;
  let maxCount = 0;
  categoryCounts.forEach((count, category) => {
    if (count > maxCount) {
      maxCount = count;
      consensusCategory = category;
    }
  });

  const categoryAgreement = consensusCategory ? (maxCount / results.length) * 100 : 0;

  return {
    totalProviders,
    successfulProviders: results.length,
    failedProviders: errors.map((e) => e.provider),
    averageLatencyMs: Math.round(averageLatencyMs),
    totalCostUsd,
    consensusCategory,
    categoryAgreement: Math.round(categoryAgreement),
  };
}

/**
 * Display comparison results in formatted output
 */
function displayComparisonResults(
  comparison: ComparisonResult,
  errors: Array<{ provider: AIProvider; error: string }>
): void {
  // eslint-disable-next-line no-console
  console.log('\n=== Provider Comparison Results ===');
  // eslint-disable-next-line no-console
  console.log(`Image: ${comparison.imagePath}`);
  // eslint-disable-next-line no-console
  console.log(`Timestamp: ${comparison.timestamp.toISOString()}`);

  // Summary
  // eslint-disable-next-line no-console
  console.log('\n--- Summary ---');
  // eslint-disable-next-line no-console
  console.log(`Providers tested: ${comparison.summary.totalProviders}`);
  // eslint-disable-next-line no-console
  console.log(`Successful: ${comparison.summary.successfulProviders}`);
  if (comparison.summary.failedProviders.length > 0) {
    // eslint-disable-next-line no-console
    console.log(`Failed: ${comparison.summary.failedProviders.join(', ')}`);
  }
  // eslint-disable-next-line no-console
  console.log(`Average latency: ${comparison.summary.averageLatencyMs}ms`);
  // eslint-disable-next-line no-console
  console.log(`Total cost: $${comparison.summary.totalCostUsd.toFixed(6)}`);

  if (comparison.summary.consensusCategory) {
    // eslint-disable-next-line no-console
    console.log(`\nConsensus category: ${comparison.summary.consensusCategory}`);
    // eslint-disable-next-line no-console
    console.log(`Agreement: ${comparison.summary.categoryAgreement}%`);
  }

  // Individual results
  // eslint-disable-next-line no-console
  console.log('\n--- Individual Results ---');
  comparison.results.forEach((result) => {
    // eslint-disable-next-line no-console
    console.log(`\n${result.provider.toUpperCase()}:`);
    // eslint-disable-next-line no-console
    console.log(`  Model: ${String(result.providerMetadata?.model) || 'unknown'}`);
    // eslint-disable-next-line no-console
    console.log(
      `  Category: ${result.primaryCategory?.category || 'Unknown'} (${((result.primaryCategory?.confidence || 0) * 100).toFixed(1)}%)`
    );
    if (result.primaryCategory?.reasoning) {
      // eslint-disable-next-line no-console
      console.log(`  Reasoning: ${result.primaryCategory.reasoning}`);
    }
    // eslint-disable-next-line no-console
    console.log(`  Latency: ${result.latencyMs}ms`);
    // eslint-disable-next-line no-console
    console.log(`  Cost: $${result.costUsd.toFixed(6)}`);
    // eslint-disable-next-line no-console
    console.log(
      `  Tokens: ${result.tokens.total} (in: ${result.tokens.input}, out: ${result.tokens.output})`
    );
  });

  // Errors
  if (errors.length > 0) {
    // eslint-disable-next-line no-console
    console.log('\n--- Errors ---');
    errors.forEach((err) => {
      // eslint-disable-next-line no-console
      console.log(`${err.provider}: ${err.error}`);
    });
  }
}
