/**
 * Response Normalizer
 * Normalizes provider responses to a consistent format
 */

import type { CategoryResult, ConfidenceLevel } from '../types';

/**
 * Normalizes responses from different AI providers
 */
export class ResponseNormalizer {
  /**
   * Normalize categories from provider response
   * @param rawResponse - Raw response from provider
   * @returns Normalized category results
   */
  static normalizeCategories(rawResponse: unknown): CategoryResult[] {
    // Handle different response formats from providers
    const categories = this.extractCategories(rawResponse);

    return categories.map((cat) => ({
      category: this.normalizeCategory(cat.category),
      confidence: this.normalizeConfidence(cat.confidence),
      confidenceLevel: this.getConfidenceLevel(this.normalizeConfidence(cat.confidence)),
      reasoning: cat.reasoning || undefined,
    }));
  }

  /**
   * Extract categories from provider-specific response format
   * @param response - Provider response
   * @returns Array of raw category objects
   */
  private static extractCategories(response: unknown): Array<{
    category: string;
    confidence: number | string;
    reasoning?: string;
  }> {
    // Provider-specific extraction logic
    if (Array.isArray(response)) {
      return response as Array<{
        category: string;
        confidence: number | string;
        reasoning?: string;
      }>;
    }

    if (response && typeof response === 'object' && 'categories' in response) {
      const categories = (response as { categories: unknown }).categories;
      if (Array.isArray(categories)) {
        return categories as Array<{
          category: string;
          confidence: number | string;
          reasoning?: string;
        }>;
      }
    }

    // Fallback: try to parse from text
    return [
      {
        category: 'Unknown',
        confidence: 0.5,
        reasoning: 'Failed to parse structured response',
      },
    ];
  }

  /**
   * Normalize category name
   * @param category - Raw category string
   * @returns Normalized category name
   */
  private static normalizeCategory(category: string): string {
    // Normalize category names
    return category.trim().replace(/\s+/g, ' ');
  }

  /**
   * Normalize confidence value
   * @param confidence - Raw confidence value
   * @returns Normalized confidence (0-1)
   */
  private static normalizeConfidence(confidence: number | string): number {
    const conf = typeof confidence === 'string' ? parseFloat(confidence) : confidence;

    // Handle NaN
    if (isNaN(conf)) {
      return 0.5;
    }

    // Clamp between 0 and 1
    return Math.max(0, Math.min(1, conf));
  }

  /**
   * Get confidence level from numeric confidence
   * @param confidence - Numeric confidence (0-1)
   * @returns Confidence level
   */
  private static getConfidenceLevel(confidence: number): ConfidenceLevel {
    if (confidence > 0.8) return 'high' as ConfidenceLevel;
    if (confidence >= 0.5) return 'medium' as ConfidenceLevel;
    return 'low' as ConfidenceLevel;
  }
}
