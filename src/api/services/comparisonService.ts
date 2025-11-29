/**
 * Comparison Service
 * Orchestrates multi-provider classification comparisons
 */

import { v4 as uuidv4 } from 'uuid';
import { Server as SocketIOServer } from 'socket.io';
import { ProviderFactory } from '../../providers/provider-factory';
import { AIProvider } from '../../types/provider.types';
import { ClassificationRequest, ClassificationResult } from '../../types/classification.types';
import {
  ComparisonRequest,
  ComparisonResponse,
  ProviderResult,
  ConsensusAnalysis,
  ComparisonStatistics,
  ProviderError,
  ComparisonProgressUpdate,
} from '../../types/comparison.types';
import { logger } from '../../utils/logger';

export class ComparisonService {
  private io?: SocketIOServer;

  constructor(io?: SocketIOServer) {
    this.io = io;
  }

  /**
   * Execute comparison across multiple providers
   */
  async executeComparison(
    request: ComparisonRequest,
    userId?: string
  ): Promise<ComparisonResponse> {
    const comparisonId = uuidv4();

    logger.info('Starting provider comparison', {
      comparisonId,
      imageCount: request.imageUrls.length,
      providers: request.providers?.join(', ') || 'all',
      userId,
    });

    // Determine providers to use
    const providersToUse = request.providers?.length
      ? request.providers
      : [
          AIProvider.GOOGLE_GEMINI,
          AIProvider.ANTHROPIC_CLAUDE,
          AIProvider.OPENAI_GPT4V,
          AIProvider.AWS_BEDROCK,
        ];

    // Create tasks for each provider
    const tasks = providersToUse.map((provider) => ({
      provider,
      execute: () =>
        this.classifyWithProvider(
          provider,
          request.prompt,
          request.imageUrls,
          comparisonId,
          userId,
          request.options?.timeout
        ),
    }));

    // Execute in parallel with error handling
    const results = await Promise.allSettled(tasks.map((task) => task.execute()));

    // Process results - separate successful from failed
    const providerResults: ProviderResult[] = [];
    const errors: ProviderError[] = [];

    results.forEach((result, index) => {
      const provider = tasks[index].provider;

      if (result.status === 'fulfilled') {
        providerResults.push(result.value);
      } else {
        errors.push({
          provider,
          error: result.reason.message || 'Unknown error',
          timestamp: new Date(),
        });

        logger.warn('Provider failed during comparison', {
          comparisonId,
          provider,
          error: result.reason.message,
        });
      }
    });

    // Calculate statistics
    const statistics = this.calculateStatistics(providerResults);

    // Detect consensus
    const consensus = this.detectConsensus(providerResults);

    logger.info('Comparison completed', {
      comparisonId,
      successfulProviders: providerResults.length,
      failedProviders: errors.length,
      agreementLevel: consensus.agreementLevel,
    });

    return {
      comparisonId,
      request: {
        prompt: request.prompt,
        imageCount: request.imageUrls.length,
        providers: providersToUse,
        timestamp: new Date().toISOString(),
      },
      results: providerResults,
      consensus,
      statistics,
      errors,
    };
  }

  /**
   * Classify images with a specific provider
   */
  private async classifyWithProvider(
    provider: AIProvider,
    prompt: string,
    imageUrls: string[],
    comparisonId: string,
    userId?: string,
    timeout?: number
  ): Promise<ProviderResult> {
    const startTime = Date.now();

    // Emit initial progress
    this.emitProgress(comparisonId, {
      comparisonId,
      provider,
      status: 'processing',
      timestamp: new Date(),
    });

    try {
      // Get API key for provider
      const apiKey = this.getApiKeyForProvider(provider);

      if (!apiKey) {
        throw new Error(`API key not configured for provider: ${provider}`);
      }

      // Create provider instance
      const providerInstance = ProviderFactory.create({
        provider,
        apiKey,
        timeoutMs: timeout || 30000, // 30s default timeout
      });

      // Classify all images
      const results: ClassificationResult[] = await Promise.all(
        imageUrls.map((imageUrl) => {
          const classificationRequest: ClassificationRequest = {
            image: { source: imageUrl },
            provider,
            promptTemplate: prompt,
            metadata: {
              requestId: uuidv4(),
              userId,
              timestamp: new Date(),
            },
          };

          return providerInstance.classify(classificationRequest);
        })
      );

      // Calculate aggregates
      const aggregates = {
        averageLatency:
          results.reduce((sum, r) => sum + r.latencyMs, 0) / results.length,
        totalCost: results.reduce((sum, r) => sum + r.costUsd, 0),
        totalTokens: results.reduce((sum, r) => sum + r.tokens.total, 0),
        averageConfidence:
          results.reduce((sum, r) => sum + r.primaryCategory.confidence, 0) / results.length,
        successRate: results.filter((r) => !r.providerMetadata?.error).length / results.length,
      };

      // Emit completion progress
      this.emitProgress(comparisonId, {
        comparisonId,
        provider,
        status: 'completed',
        resultsCount: results.length,
        timestamp: new Date(),
      });

      logger.info('Provider classification completed', {
        comparisonId,
        provider,
        imageCount: imageUrls.length,
        latency: Date.now() - startTime,
        cost: aggregates.totalCost,
      });

      return {
        provider,
        model: results[0]?.providerMetadata?.model as string || 'default',
        results,
        aggregates,
      };
    } catch (error) {
      // Emit failure progress
      this.emitProgress(comparisonId, {
        comparisonId,
        provider,
        status: 'failed',
        error: (error as Error).message,
        timestamp: new Date(),
      });

      throw error;
    }
  }

  /**
   * Detect consensus across provider results
   */
  private detectConsensus(results: ProviderResult[]): ConsensusAnalysis {
    // Flatten all classifications
    const allClassifications = results.flatMap((r) =>
      r.results.map((result) => result.primaryCategory.category)
    );

    if (allClassifications.length === 0) {
      return {
        agreementLevel: 0,
        agreementCount: 0,
        majorityCategory: null,
        allCategories: [],
      };
    }

    // Count category votes
    const categoryVotes: Record<string, number> = {};
    allClassifications.forEach((category) => {
      categoryVotes[category] = (categoryVotes[category] || 0) + 1;
    });

    // Find majority
    const [majorityCategory, maxVotes] = Object.entries(categoryVotes).reduce(
      (max, [cat, votes]) => (votes > max[1] ? [cat, votes] : max),
      ['', 0]
    );

    const agreementLevel = (maxVotes / allClassifications.length) * 100;

    return {
      agreementLevel: Math.round(agreementLevel),
      agreementCount: maxVotes,
      majorityCategory,
      allCategories: Object.keys(categoryVotes),
      disagreementCategories: Object.entries(categoryVotes)
        .filter(([_, votes]) => votes < maxVotes)
        .map(([cat]) => cat),
    };
  }

  /**
   * Calculate comparison statistics
   */
  private calculateStatistics(results: ProviderResult[]): ComparisonStatistics {
    const validResults = results.filter((r) => r.results.length > 0);

    if (validResults.length === 0) {
      return {
        fastest: { provider: AIProvider.GOOGLE_GEMINI, latency: 0 },
        cheapest: { provider: AIProvider.GOOGLE_GEMINI, cost: 0 },
        mostConfident: { provider: AIProvider.GOOGLE_GEMINI, confidence: 0 },
        averageLatency: 0,
        totalCost: 0,
        totalTokens: 0,
      };
    }

    const fastest = validResults.reduce((min, r) =>
      r.aggregates.averageLatency < min.aggregates.averageLatency ? r : min
    );

    const cheapest = validResults.reduce((min, r) =>
      r.aggregates.totalCost < min.aggregates.totalCost ? r : min
    );

    const mostConfident = validResults.reduce((max, r) =>
      r.aggregates.averageConfidence > max.aggregates.averageConfidence ? r : max
    );

    return {
      fastest: {
        provider: fastest.provider,
        latency: fastest.aggregates.averageLatency,
      },
      cheapest: {
        provider: cheapest.provider,
        cost: cheapest.aggregates.totalCost,
      },
      mostConfident: {
        provider: mostConfident.provider,
        confidence: mostConfident.aggregates.averageConfidence,
      },
      averageLatency:
        validResults.reduce((sum, r) => sum + r.aggregates.averageLatency, 0) /
        validResults.length,
      totalCost: validResults.reduce((sum, r) => sum + r.aggregates.totalCost, 0),
      totalTokens: validResults.reduce((sum, r) => sum + r.aggregates.totalTokens, 0),
    };
  }

  /**
   * Get API key for a specific provider
   */
  private getApiKeyForProvider(provider: AIProvider): string | undefined {
    switch (provider) {
      case AIProvider.GOOGLE_GEMINI:
        return process.env.GEMINI_API_KEY;
      case AIProvider.ANTHROPIC_CLAUDE:
        return process.env.ANTHROPIC_API_KEY;
      case AIProvider.OPENAI_GPT4V:
        return process.env.OPENAI_API_KEY;
      case AIProvider.AWS_BEDROCK:
        return process.env.AWS_ACCESS_KEY_ID;
      default:
        return undefined;
    }
  }

  /**
   * Emit progress update via WebSocket
   */
  private emitProgress(comparisonId: string, update: ComparisonProgressUpdate): void {
    if (this.io) {
      this.io.emit(`comparison:progress:${comparisonId}`, update);
    }
  }
}
