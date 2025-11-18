/**
 * Cost Comparison System
 * Side-by-side provider comparison, cost projections, savings calculations
 */

import type { AIProvider } from '../types';
import { CostTracker, ProviderCostStats } from './cost-tracker';

/**
 * Provider comparison result
 */
export interface ProviderComparison {
  provider: AIProvider;
  costUsd: number;
  costPerRequest: number;
  tokensPerRequest: number;
  latencyMs: number;
  requestCount: number;
  ranking: number;
}

/**
 * Cost projection
 */
export interface CostProjection {
  provider: AIProvider;
  current: {
    requests: number;
    costUsd: number;
  };
  projected: {
    dailyRequests: number;
    weeklyRequests: number;
    monthlyRequests: number;
    dailyCostUsd: number;
    weeklyCostUsd: number;
    monthlyCostUsd: number;
  };
}

/**
 * Savings analysis
 */
export interface SavingsAnalysis {
  currentProvider: AIProvider;
  alternativeProvider: AIProvider;
  currentCostUsd: number;
  alternativeCostUsd: number;
  savingsUsd: number;
  savingsPercent: number;
  requestCount: number;
}

/**
 * Cost comparison system
 */
export class CostComparison {
  /**
   * Compare providers side-by-side
   * @param tracker - Cost tracker instance
   * @returns Array of provider comparisons sorted by cost
   */
  static compareProviders(tracker: CostTracker): ProviderComparison[] {
    const stats = tracker.getStats();
    const comparisons: ProviderComparison[] = [];

    for (const [provider, providerStats] of stats.byProvider) {
      comparisons.push({
        provider,
        costUsd: providerStats.costUsd,
        costPerRequest: providerStats.averageCostPerRequest,
        tokensPerRequest: providerStats.totalTokens / providerStats.requests,
        latencyMs: providerStats.averageLatencyMs,
        requestCount: providerStats.requests,
        ranking: 0, // Will be set after sorting
      });
    }

    // Sort by cost per request (ascending)
    comparisons.sort((a, b) => a.costPerRequest - b.costPerRequest);

    // Assign rankings
    comparisons.forEach((comp, index) => {
      comp.ranking = index + 1;
    });

    return comparisons;
  }

  /**
   * Project costs for a provider
   * @param provider - AI provider
   * @param currentStats - Current provider statistics
   * @returns Cost projection
   */
  static projectCosts(provider: AIProvider, currentStats: ProviderCostStats): CostProjection {
    const avgCostPerRequest = currentStats.averageCostPerRequest;

    // Estimate daily requests based on current rate
    // Assume requests were made over 1 hour for estimation
    const requestsPerHour = currentStats.requests;
    const dailyRequests = requestsPerHour * 24;
    const weeklyRequests = dailyRequests * 7;
    const monthlyRequests = dailyRequests * 30;

    return {
      provider,
      current: {
        requests: currentStats.requests,
        costUsd: currentStats.costUsd,
      },
      projected: {
        dailyRequests,
        weeklyRequests,
        monthlyRequests,
        dailyCostUsd: dailyRequests * avgCostPerRequest,
        weeklyCostUsd: weeklyRequests * avgCostPerRequest,
        monthlyCostUsd: monthlyRequests * avgCostPerRequest,
      },
    };
  }

  /**
   * Calculate savings by switching providers
   * @param currentProvider - Current provider
   * @param alternativeProvider - Alternative provider
   * @param requestCount - Number of requests
   * @param avgTokensPerRequest - Average tokens per request
   * @returns Savings analysis
   */
  static calculateSavings(
    currentProvider: AIProvider,
    alternativeProvider: AIProvider,
    requestCount: number,
    avgTokensPerRequest: { input: number; output: number }
  ): SavingsAnalysis {
    const currentPricing = CostTracker.getProviderPricing(currentProvider);
    const altPricing = CostTracker.getProviderPricing(alternativeProvider);

    // Calculate costs
    const currentInputCost =
      (avgTokensPerRequest.input / 1_000_000) * currentPricing.inputTokensPerMillion;
    const currentOutputCost =
      (avgTokensPerRequest.output / 1_000_000) * currentPricing.outputTokensPerMillion;
    const currentCostPerRequest = currentInputCost + currentOutputCost;
    const currentTotalCost = currentCostPerRequest * requestCount;

    const altInputCost =
      (avgTokensPerRequest.input / 1_000_000) * altPricing.inputTokensPerMillion;
    const altOutputCost =
      (avgTokensPerRequest.output / 1_000_000) * altPricing.outputTokensPerMillion;
    const altCostPerRequest = altInputCost + altOutputCost;
    const altTotalCost = altCostPerRequest * requestCount;

    const savingsUsd = currentTotalCost - altTotalCost;
    const savingsPercent = (savingsUsd / currentTotalCost) * 100;

    return {
      currentProvider,
      alternativeProvider,
      currentCostUsd: currentTotalCost,
      alternativeCostUsd: altTotalCost,
      savingsUsd,
      savingsPercent,
      requestCount,
    };
  }

  /**
   * Find cheapest provider for given usage
   * @param avgTokensPerRequest - Average tokens per request
   * @returns Cheapest provider
   */
  static findCheapestProvider(avgTokensPerRequest: {
    input: number;
    output: number;
  }): { provider: AIProvider; costPerRequest: number } {
    const providers: AIProvider[] = ['gemini' as AIProvider, 'claude' as AIProvider, 'openai' as AIProvider, 'bedrock' as AIProvider];
    let cheapest: { provider: AIProvider; costPerRequest: number } | null = null;

    for (const provider of providers) {
      const pricing = CostTracker.getProviderPricing(provider);
      const inputCost =
        (avgTokensPerRequest.input / 1_000_000) * pricing.inputTokensPerMillion;
      const outputCost =
        (avgTokensPerRequest.output / 1_000_000) * pricing.outputTokensPerMillion;
      const costPerRequest = inputCost + outputCost;

      if (!cheapest || costPerRequest < cheapest.costPerRequest) {
        cheapest = { provider, costPerRequest };
      }
    }

    return cheapest!;
  }

  /**
   * Generate comparison table data
   * @param comparisons - Provider comparisons
   * @returns Formatted table data
   */
  static generateComparisonTable(comparisons: ProviderComparison[]): string {
    const headers = ['Rank', 'Provider', 'Total Cost', 'Cost/Request', 'Avg Latency', 'Requests'];
    const rows = comparisons.map((comp) => [
      comp.ranking.toString(),
      comp.provider.toUpperCase(),
      `$${comp.costUsd.toFixed(6)}`,
      `$${comp.costPerRequest.toFixed(6)}`,
      `${Math.round(comp.latencyMs)}ms`,
      comp.requestCount.toString(),
    ]);

    // Simple table formatting
    const table = [headers, ...rows]
      .map((row) => row.map((cell) => cell.padEnd(15)).join(' | '))
      .join('\n');

    return table;
  }

  /**
   * Generate savings report
   * @param analysis - Savings analysis
   * @returns Formatted report
   */
  static generateSavingsReport(analysis: SavingsAnalysis): string {
    const direction = analysis.savingsUsd > 0 ? 'SAVE' : 'COST';
    const absSavings = Math.abs(analysis.savingsUsd);

    return `
=== Cost Savings Analysis ===
Current Provider: ${analysis.currentProvider.toUpperCase()}
Alternative Provider: ${analysis.alternativeProvider.toUpperCase()}
Request Count: ${analysis.requestCount.toLocaleString()}

Current Cost: $${analysis.currentCostUsd.toFixed(2)}
Alternative Cost: $${analysis.alternativeCostUsd.toFixed(2)}

${direction}: $${absSavings.toFixed(2)} (${Math.abs(analysis.savingsPercent).toFixed(1)}%)

${analysis.savingsUsd > 0 ? '✅ Switching would save money' : '⚠️  Current provider is cheaper'}
`;
  }
}
