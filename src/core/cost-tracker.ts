/**
 * Cost Tracking System
 * Per-request cost calculation, provider pricing models, token/image counting
 */

import { logger } from '../utils/logger';
import type { AIProvider, ClassificationResult } from '../types';

/**
 * Provider pricing configuration
 */
export interface ProviderPricing {
  inputTokensPerMillion: number;
  outputTokensPerMillion: number;
  currency: string;
}

/**
 * Cost record for a single request
 */
export interface CostRecord {
  requestId: string;
  provider: AIProvider;
  timestamp: Date;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  costUsd: number;
  latencyMs: number;
  model?: string;
}

/**
 * Aggregated cost statistics
 */
export interface CostStats {
  totalRequests: number;
  totalCostUsd: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  totalTokens: number;
  averageCostPerRequest: number;
  averageTokensPerRequest: number;
  byProvider: Map<AIProvider, ProviderCostStats>;
}

/**
 * Provider-specific cost statistics
 */
export interface ProviderCostStats {
  requests: number;
  costUsd: number;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  averageCostPerRequest: number;
  averageLatencyMs: number;
}

/**
 * Provider pricing models
 */
const PROVIDER_PRICING: Record<AIProvider, ProviderPricing> = {
  gemini: {
    inputTokensPerMillion: 0.075, // $0.075 per 1M input tokens (Gemini 2.0 Flash)
    outputTokensPerMillion: 0.3, // $0.30 per 1M output tokens
    currency: 'USD',
  },
  claude: {
    inputTokensPerMillion: 3.0, // $3 per 1M input tokens (Claude 3.5 Sonnet)
    outputTokensPerMillion: 15.0, // $15 per 1M output tokens
    currency: 'USD',
  },
  openai: {
    inputTokensPerMillion: 10.0, // $10 per 1M input tokens (GPT-4 Vision)
    outputTokensPerMillion: 30.0, // $30 per 1M output tokens
    currency: 'USD',
  },
  bedrock: {
    inputTokensPerMillion: 3.0, // $3 per 1M input tokens (Claude 3 Sonnet on Bedrock)
    outputTokensPerMillion: 15.0, // $15 per 1M output tokens
    currency: 'USD',
  },
};

/**
 * Cost tracking system
 */
export class CostTracker {
  private records: CostRecord[] = [];
  private startTime: Date;

  constructor() {
    this.startTime = new Date();
  }

  /**
   * Calculate cost for a classification result
   * @param result - Classification result
   * @returns Cost in USD
   */
  static calculateCost(result: ClassificationResult): number {
    const pricing = PROVIDER_PRICING[result.provider];
    const inputCost = (result.tokens.input / 1_000_000) * pricing.inputTokensPerMillion;
    const outputCost = (result.tokens.output / 1_000_000) * pricing.outputTokensPerMillion;
    return inputCost + outputCost;
  }

  /**
   * Get pricing for a provider
   * @param provider - AI provider
   * @returns Provider pricing
   */
  static getProviderPricing(provider: AIProvider): ProviderPricing {
    return PROVIDER_PRICING[provider];
  }

  /**
   * Record a classification cost
   * @param result - Classification result
   */
  recordCost(result: ClassificationResult): void {
    const record: CostRecord = {
      requestId: result.requestId,
      provider: result.provider,
      timestamp: result.timestamp,
      inputTokens: result.tokens.input,
      outputTokens: result.tokens.output,
      totalTokens: result.tokens.total,
      costUsd: result.costUsd,
      latencyMs: result.latencyMs,
      model: result.providerMetadata?.model as string | undefined,
    };

    this.records.push(record);

    logger.debug('Cost recorded', {
      provider: result.provider,
      costUsd: result.costUsd,
      tokens: result.tokens.total,
    });
  }

  /**
   * Get cost statistics
   * @returns Cost statistics
   */
  getStats(): CostStats {
    const byProvider = new Map<AIProvider, ProviderCostStats>();

    // Calculate provider-specific stats
    for (const record of this.records) {
      const existing = byProvider.get(record.provider);

      if (existing) {
        existing.requests++;
        existing.costUsd += record.costUsd;
        existing.inputTokens += record.inputTokens;
        existing.outputTokens += record.outputTokens;
        existing.totalTokens += record.totalTokens;
        existing.averageLatencyMs =
          (existing.averageLatencyMs * (existing.requests - 1) + record.latencyMs) /
          existing.requests;
      } else {
        byProvider.set(record.provider, {
          requests: 1,
          costUsd: record.costUsd,
          inputTokens: record.inputTokens,
          outputTokens: record.outputTokens,
          totalTokens: record.totalTokens,
          averageCostPerRequest: record.costUsd,
          averageLatencyMs: record.latencyMs,
        });
      }
    }

    // Update average costs
    for (const stats of byProvider.values()) {
      stats.averageCostPerRequest = stats.costUsd / stats.requests;
    }

    // Calculate overall stats
    const totalCostUsd = this.records.reduce((sum, r) => sum + r.costUsd, 0);
    const totalInputTokens = this.records.reduce((sum, r) => sum + r.inputTokens, 0);
    const totalOutputTokens = this.records.reduce((sum, r) => sum + r.outputTokens, 0);
    const totalTokens = this.records.reduce((sum, r) => sum + r.totalTokens, 0);

    return {
      totalRequests: this.records.length,
      totalCostUsd,
      totalInputTokens,
      totalOutputTokens,
      totalTokens,
      averageCostPerRequest: this.records.length > 0 ? totalCostUsd / this.records.length : 0,
      averageTokensPerRequest: this.records.length > 0 ? totalTokens / this.records.length : 0,
      byProvider,
    };
  }

  /**
   * Get all cost records
   * @returns Array of cost records
   */
  getRecords(): CostRecord[] {
    return [...this.records];
  }

  /**
   * Get records for a specific provider
   * @param provider - AI provider
   * @returns Array of cost records
   */
  getRecordsByProvider(provider: AIProvider): CostRecord[] {
    return this.records.filter((r) => r.provider === provider);
  }

  /**
   * Get records within a date range
   * @param startDate - Start date
   * @param endDate - End date
   * @returns Array of cost records
   */
  getRecordsByDateRange(startDate: Date, endDate: Date): CostRecord[] {
    return this.records.filter(
      (r) => r.timestamp >= startDate && r.timestamp <= endDate
    );
  }

  /**
   * Clear all records
   */
  clear(): void {
    this.records = [];
    this.startTime = new Date();
    logger.info('Cost tracker cleared');
  }

  /**
   * Get session duration in seconds
   * @returns Duration in seconds
   */
  getSessionDuration(): number {
    return (Date.now() - this.startTime.getTime()) / 1000;
  }
}
