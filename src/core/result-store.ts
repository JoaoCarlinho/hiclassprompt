/**
 * Result Store
 * In-memory storage for classification results with query capabilities
 */

import { logger } from '../utils/logger';
import type { ClassificationResult, AIProvider } from '../types';

/**
 * Search criteria
 */
export interface SearchCriteria {
  provider?: AIProvider;
  minConfidence?: number;
  maxConfidence?: number;
  category?: string;
  startDate?: Date;
  endDate?: Date;
  batchId?: string;
}

/**
 * Aggregated statistics
 */
export interface AggregatedStats {
  totalResults: number;
  totalCost: number;
  totalTokens: number;
  averageLatency: number;
  averageCost: number;
  byProvider: Map<
    AIProvider,
    {
      count: number;
      cost: number;
      avgLatency: number;
    }
  >;
  topCategories: Array<{ category: string; count: number }>;
}

/**
 * Result store for managing classification results
 */
export class ResultStore {
  private results: Map<string, ClassificationResult> = new Map();
  private batchResults: Map<string, string[]> = new Map(); // batchId -> requestIds

  /**
   * Store a classification result
   * @param result - Classification result to store
   * @param batchId - Optional batch ID
   */
  store(result: ClassificationResult, batchId?: string): void {
    this.results.set(result.requestId, result);

    if (batchId) {
      const batchRequests = this.batchResults.get(batchId) || [];
      batchRequests.push(result.requestId);
      this.batchResults.set(batchId, batchRequests);
    }

    logger.debug('Result stored', {
      requestId: result.requestId,
      batchId,
      totalResults: this.results.size,
    });
  }

  /**
   * Store multiple results
   * @param results - Array of classification results
   * @param batchId - Optional batch ID
   */
  storeMany(results: ClassificationResult[], batchId?: string): void {
    results.forEach((result) => this.store(result, batchId));
    logger.info('Multiple results stored', {
      count: results.length,
      batchId,
      totalResults: this.results.size,
    });
  }

  /**
   * Get a specific result by ID
   * @param requestId - Request ID
   * @returns Classification result or null
   */
  getResult(requestId: string): ClassificationResult | null {
    return this.results.get(requestId) || null;
  }

  /**
   * Get results with pagination
   * @param limit - Maximum number of results
   * @param offset - Offset for pagination
   * @returns Array of classification results
   */
  getResults(limit = 100, offset = 0): ClassificationResult[] {
    const allResults = Array.from(this.results.values());
    return allResults.slice(offset, offset + limit);
  }

  /**
   * Get results for a specific batch
   * @param batchId - Batch ID
   * @returns Array of classification results
   */
  getBatchResults(batchId: string): ClassificationResult[] {
    const requestIds = this.batchResults.get(batchId) || [];
    return requestIds
      .map((id) => this.results.get(id))
      .filter((result): result is ClassificationResult => result !== undefined);
  }

  /**
   * Search results by criteria
   * @param criteria - Search criteria
   * @param limit - Maximum number of results
   * @param offset - Offset for pagination
   * @returns Array of matching classification results
   */
  search(
    criteria: SearchCriteria,
    limit = 100,
    offset = 0
  ): ClassificationResult[] {
    let results = Array.from(this.results.values());

    // Apply filters
    if (criteria.provider) {
      results = results.filter((r) => r.provider === criteria.provider);
    }

    if (criteria.minConfidence !== undefined) {
      results = results.filter(
        (r) => r.primaryCategory.confidence >= criteria.minConfidence!
      );
    }

    if (criteria.maxConfidence !== undefined) {
      results = results.filter(
        (r) => r.primaryCategory.confidence <= criteria.maxConfidence!
      );
    }

    if (criteria.category) {
      results = results.filter(
        (r) => r.primaryCategory.category === criteria.category
      );
    }

    if (criteria.startDate) {
      results = results.filter((r) => r.timestamp >= criteria.startDate!);
    }

    if (criteria.endDate) {
      results = results.filter((r) => r.timestamp <= criteria.endDate!);
    }

    if (criteria.batchId) {
      const batchRequestIds = this.batchResults.get(criteria.batchId) || [];
      results = results.filter((r) => batchRequestIds.includes(r.requestId));
    }

    return results.slice(offset, offset + limit);
  }

  /**
   * Get aggregated statistics
   * @returns Aggregated statistics
   */
  getStats(): AggregatedStats {
    const allResults = Array.from(this.results.values());
    const totalResults = allResults.length;

    if (totalResults === 0) {
      return {
        totalResults: 0,
        totalCost: 0,
        totalTokens: 0,
        averageLatency: 0,
        averageCost: 0,
        byProvider: new Map(),
        topCategories: [],
      };
    }

    const totalCost = allResults.reduce((sum, r) => sum + r.costUsd, 0);
    const totalTokens = allResults.reduce((sum, r) => sum + r.tokens.total, 0);
    const totalLatency = allResults.reduce((sum, r) => sum + r.latencyMs, 0);

    // By provider stats
    const byProvider = new Map<
      AIProvider,
      { count: number; cost: number; avgLatency: number }
    >();

    allResults.forEach((result) => {
      const stats = byProvider.get(result.provider) || {
        count: 0,
        cost: 0,
        avgLatency: 0,
      };

      stats.count++;
      stats.cost += result.costUsd;
      stats.avgLatency =
        (stats.avgLatency * (stats.count - 1) + result.latencyMs) / stats.count;

      byProvider.set(result.provider, stats);
    });

    // Top categories
    const categoryCounts = new Map<string, number>();
    allResults.forEach((result) => {
      const category = result.primaryCategory.category;
      categoryCounts.set(category, (categoryCounts.get(category) || 0) + 1);
    });

    const topCategories = Array.from(categoryCounts.entries())
      .map(([category, count]) => ({ category, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    return {
      totalResults,
      totalCost,
      totalTokens,
      averageLatency: totalLatency / totalResults,
      averageCost: totalCost / totalResults,
      byProvider,
      topCategories,
    };
  }

  /**
   * Clear all results
   */
  clear(): void {
    this.results.clear();
    this.batchResults.clear();
    logger.info('Result store cleared');
  }

  /**
   * Get total count of results
   * @returns Total number of results
   */
  getCount(): number {
    return this.results.size;
  }

  /**
   * Get all batch IDs
   * @returns Array of batch IDs
   */
  getBatchIds(): string[] {
    return Array.from(this.batchResults.keys());
  }
}
