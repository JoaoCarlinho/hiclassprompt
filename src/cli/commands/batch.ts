/**
 * Batch command handler
 * Process multiple images in batch with concurrency control
 */

import { existsSync } from 'fs';
import { extname } from 'path';
import type { AIProvider } from '../../types';
import { loadConfig } from '../../core/config';
import { logger } from '../../utils/logger';
import { ProviderFactory } from '../../providers/provider-factory';
import { BatchInput } from '../../core/batch-input';
import { ConcurrencyController } from '../../core/concurrency-controller';
import { ProgressTracker } from '../../core/progress-tracker';
import { BatchResultManager } from '../../core/batch-result-manager';
import { RetryLogic, CircuitBreakerManager } from '../../core/retry-logic';
import { ResourceManager } from '../../core/resource-manager';

/**
 * Batch command options
 */
interface BatchOptions {
  provider: string;
  input?: string;
  output: string;
  concurrency?: string;
  resume?: boolean;
  verbose?: boolean;
  recursive?: boolean;
  cache: boolean;
}

/**
 * Batch command handler
 * @param source - Directory path or input file (CSV/JSON)
 * @param options - Command options
 */
export async function batchCommand(source: string, options: BatchOptions): Promise<void> {
  const resourceManager = new ResourceManager({
    maxMemoryMB: 2048,
    maxQueueDepth: 10000,
  });

  const concurrencyController = new ConcurrencyController();
  const progressTracker = new ProgressTracker();
  const retryLogic = new RetryLogic();
  const circuitBreakerManager = new CircuitBreakerManager();

  try {
    // Set log level
    if (options.verbose) {
      logger.setLevel('debug');
    }

    // Start resource monitoring
    resourceManager.startMonitoring();

    // Load configuration
    const config = loadConfig();
    logger.debug('Configuration loaded', { providers: Object.keys(config.providers) });

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

    // Create provider instance
    const providerInstance = ProviderFactory.create(providerConfig);
    await providerInstance.validateConfig();
    logger.info(`Using provider: ${provider}`);

    // Load batch input
    logger.info(`Loading batch input from: ${source}`);
    let batchResult;

    if (!existsSync(source)) {
      throw new Error(`Source not found: ${source}`);
    }

    const ext = extname(source).toLowerCase();
    if (ext === '.csv') {
      batchResult = BatchInput.loadFromCSV(source, {
        validatePaths: true,
        deduplicate: true,
      });
    } else if (ext === '.json' || ext === '.jsonl') {
      batchResult = BatchInput.loadFromJSON(source, {
        validatePaths: true,
        deduplicate: true,
      });
    } else {
      // Assume directory
      batchResult = BatchInput.scanDirectory(source, {
        recursive: options.recursive ?? false,
        validatePaths: true,
        deduplicate: true,
      });
    }

    if (batchResult.validItems === 0) {
      throw new Error('No valid images found in batch input');
    }

    logger.info('Batch input loaded', {
      total: batchResult.totalFound,
      valid: batchResult.validItems,
      invalid: batchResult.invalidItems,
      duplicates: batchResult.duplicatesRemoved,
    });

    // Initialize result manager
    const resultManager = new BatchResultManager(options.output);
    resultManager.initialize(batchResult.validItems);

    // Setup graceful shutdown
    resourceManager.onShutdown(async () => {
      logger.info('Shutting down batch processing...');
      concurrencyController.pauseAll();
      await concurrencyController.waitForAllIdle();
      resultManager.finalize();
      progressTracker.stop();
    });

    // Initialize progress tracker
    progressTracker.initialize(batchResult.validItems, !options.verbose);

    // Process items with concurrency control
    const maxConcurrency = options.concurrency ? parseInt(options.concurrency, 10) : undefined;
    const queue = concurrencyController.getQueue(provider, {
      maxConcurrent: maxConcurrency,
    });

    logger.info('Starting batch processing', {
      items: batchResult.validItems,
      provider,
      concurrency: queue.concurrency,
    });

    // Process all items
    const promises = batchResult.items.map((item) =>
      queue.add(async () => {
        try {
          // Execute with retry logic and circuit breaker
          const result = await retryLogic.execute(
            async () => {
              return await circuitBreakerManager.execute(provider, async () => {
                return await providerInstance.classify({
                  image: {
                    source: item.imagePath,
                    hints: item.metadata as { title?: string; description?: string },
                  },
                  provider,
                });
              });
            },
            {
              maxAttempts: 3,
              initialDelayMs: 1000,
              maxDelayMs: 10000,
            }
          );

          resultManager.saveSuccess(item.id, item.imagePath, result);
          progressTracker.incrementSuccess();
        } catch (error) {
          const err = error as Error;
          resultManager.saveFailure(item.id, item.imagePath, {
            message: err.message,
            code: (err as Error & { code?: string }).code,
          });
          progressTracker.incrementFailure();
          logger.error('Classification failed', {
            imagePath: item.imagePath,
            error: err.message,
          });
        }
      })
    );

    // Wait for all items to complete
    await Promise.all(promises);

    // Finalize
    progressTracker.stop();
    resultManager.finalize();
    resourceManager.stopMonitoring();

    // Display summary
    // eslint-disable-next-line no-console
    console.log(progressTracker.getSummary());
    // eslint-disable-next-line no-console
    console.log(resourceManager.getResourceSummary());

    const session = resultManager.getSession();
    // eslint-disable-next-line no-console
    console.log('\n=== Batch Processing Complete ===');
    // eslint-disable-next-line no-console
    console.log(`Session ID: ${session.sessionId}`);
    // eslint-disable-next-line no-console
    console.log(`Results saved to: ${options.output}`);
    // eslint-disable-next-line no-console
    console.log(`Session file: ${options.output.replace(/\.jsonl?$/, '.session.json')}`);

    process.exit(0);
  } catch (error) {
    const err = error as Error;
    logger.error('Batch processing failed', { error: err.message });
    // eslint-disable-next-line no-console
    console.error(`\nError: ${err.message}`);

    resourceManager.stopMonitoring();
    process.exit(1);
  }
}
