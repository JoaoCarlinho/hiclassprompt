/**
 * Prompt Template Engine
 * Manages prompt generation and provider-specific optimizations
 */

import type { ClassificationRequest, AIProvider } from '../types';

/**
 * Structured prompt template
 */
export interface PromptTemplate {
  systemPrompt: string;
  userPrompt: string;
  responseFormat?: 'json' | 'text';
}

/**
 * Engine for building and optimizing prompts for different providers
 */
export class PromptTemplateEngine {
  private static readonly DEFAULT_TEMPLATE = `You are an expert at classifying auction items. Analyze this image and classify it into appropriate categories.

Return your response as a JSON array of category objects with the following structure:
[
  {
    "category": "Category Name",
    "confidence": 0.95,
    "reasoning": "Brief explanation"
  }
]

Provide 1-3 categories, ordered by confidence (highest first).
Confidence should be a number between 0 and 1.

Categories should be specific and relevant for auction items (e.g., "Antique Furniture", "Electronics", "Collectibles", "Jewelry", "Art", "Tools", "Clothing", etc.).`;

  /**
   * Build a prompt template for a classification request
   * @param request - Classification request
   * @returns Structured prompt template
   */
  static buildPrompt(request: ClassificationRequest): PromptTemplate {
    const basePrompt = request.promptTemplate || this.DEFAULT_TEMPLATE;

    // Add context hints if provided
    let userPrompt = basePrompt;
    if (request.image.hints) {
      const context = [request.image.hints.title, request.image.hints.description]
        .filter(Boolean)
        .join(' - ');

      if (context) {
        userPrompt += `\n\nContext: ${context}`;
      }
    }

    // Provider-specific optimizations
    const optimizedPrompt = this.optimizeForProvider(
      { systemPrompt: '', userPrompt, responseFormat: 'json' },
      request.provider
    );

    return optimizedPrompt;
  }

  /**
   * Optimize prompt for specific provider
   * @param template - Base prompt template
   * @param provider - Target provider
   * @returns Optimized prompt template
   */
  private static optimizeForProvider(
    template: PromptTemplate,
    provider: AIProvider
  ): PromptTemplate {
    switch (provider) {
      case 'claude' as AIProvider:
        // Claude prefers clear system prompts
        template.systemPrompt = 'You are an expert auction item classifier.';
        break;

      case 'openai' as AIProvider:
        // GPT-4V works well with explicit JSON instructions
        template.systemPrompt = 'You are a helpful assistant that classifies auction items.';
        break;

      case 'gemini' as AIProvider:
        // Gemini handles JSON well in user prompt
        template.systemPrompt = '';
        break;

      case 'bedrock' as AIProvider:
        // Depends on underlying model
        template.systemPrompt = 'You are an AI assistant specialized in image classification.';
        break;

      default:
        // Generic fallback
        template.systemPrompt = 'You are an expert image classifier.';
    }

    return template;
  }

  /**
   * Get default prompt template
   * @returns Default template string
   */
  static getDefaultTemplate(): string {
    return this.DEFAULT_TEMPLATE;
  }
}
