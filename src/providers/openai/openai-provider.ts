/**
 * OpenAI GPT-4V provider implementation
 */

import OpenAI from 'openai';
import { readFileSync } from 'fs';
import { v4 as uuidv4 } from 'uuid';
import type {
  IProvider,
  AIProvider,
  ClassificationRequest,
  ClassificationResult,
  RateLimitStatus,
  ConfidenceLevel,
  CategoryResult,
} from '../../types';
import { logger } from '../../utils/logger';
import { RateLimiter } from '../../utils/rate-limiter';

/**
 * OpenAI GPT-4V provider
 */
export class OpenAIProvider implements IProvider {
  readonly name: AIProvider = 'openai' as AIProvider;
  private client: OpenAI;
  private model: string;
  private rateLimiter: RateLimiter;

  constructor(apiKey: string, model = 'gpt-4-vision-preview') {
    this.client = new OpenAI({ apiKey });
    this.model = model;
    this.rateLimiter = new RateLimiter(60); // 60 requests/minute for GPT-4V
  }

  async validateConfig(): Promise<void> {
    try {
      // Test API access
      await this.client.chat.completions.create({
        model: this.model,
        max_tokens: 10,
        messages: [{ role: 'user', content: 'test' }],
      });
      logger.info('OpenAI provider configuration validated');
    } catch (error) {
      const err = error as Error;
      logger.error('OpenAI validation failed', { error: err.message });
      throw new Error(`OpenAI API validation failed: ${err.message}`);
    }
  }

  getRateLimitStatus(): Promise<RateLimitStatus> {
    return Promise.resolve(this.rateLimiter.getStatus(this.name));
  }

  async classify(request: ClassificationRequest): Promise<ClassificationResult> {
    const startTime = Date.now();
    const requestId = request.metadata?.requestId || uuidv4();

    try {
      await this.rateLimiter.acquire();

      const imageData = this.loadImage(request.image.source);
      const mimeType = this.getMimeType(request.image.source);
      const prompt = this.buildPrompt(request);

      const response = await this.client.chat.completions.create({
        model: this.model,
        max_tokens: 1024,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'image_url',
                image_url: {
                  url: `data:${mimeType};base64,${imageData}`,
                  detail: 'auto',
                },
              },
              {
                type: 'text',
                text: prompt,
              },
            ],
          },
        ],
      });

      const text = response.choices[0]?.message?.content || '';
      const categories = this.parseCategories(text);

      const inputTokens = response.usage?.prompt_tokens || 0;
      const outputTokens = response.usage?.completion_tokens || 0;
      const totalTokens = inputTokens + outputTokens;

      // Pricing: $10 per 1M input tokens, $30 per 1M output tokens
      const costUsd = (inputTokens / 1_000_000) * 10 + (outputTokens / 1_000_000) * 30;

      const latencyMs = Date.now() - startTime;

      logger.info('Classification completed', {
        requestId,
        provider: this.name,
        latencyMs,
        tokens: totalTokens,
        costUsd,
      });

      if (categories.length === 0) {
        throw new Error('No categories returned from classification');
      }

      return {
        requestId,
        provider: this.name,
        categories,
        primaryCategory: categories[0]!,
        tokens: { input: inputTokens, output: outputTokens, total: totalTokens },
        costUsd,
        latencyMs,
        timestamp: new Date(),
        providerMetadata: {
          model: this.model,
          finishReason: response.choices[0]?.finish_reason,
        },
      };
    } catch (error) {
      const err = error as Error;
      logger.error('Classification failed', { requestId, error: err.message });
      throw error;
    }
  }

  private loadImage(source: string): string {
    const buffer = readFileSync(source);
    return buffer.toString('base64');
  }

  private getMimeType(filename: string): string {
    const ext = filename.toLowerCase().split('.').pop();
    const mimeTypes: Record<string, string> = {
      jpg: 'image/jpeg',
      jpeg: 'image/jpeg',
      png: 'image/png',
      webp: 'image/webp',
      gif: 'image/gif',
    };
    return mimeTypes[ext || 'jpeg'] || 'image/jpeg';
  }

  private buildPrompt(request: ClassificationRequest): string {
    if (request.promptTemplate) {
      return request.promptTemplate;
    }

    const hints = request.image.hints;
    const contextHint =
      hints?.title || hints?.description
        ? `\n\nContext: ${hints.title || ''} ${hints.description || ''}`
        : '';

    return `You are an expert at classifying auction items. Analyze this image and classify it into appropriate categories.

Return your response as a JSON array of category objects with the following structure:
[
  {
    "category": "Category Name",
    "confidence": 0.95,
    "reasoning": "Brief explanation"
  }
]

Provide 1-3 categories, ordered by confidence (highest first).
Confidence should be a number between 0 and 1.${contextHint}

Categories should be specific and relevant for auction items (e.g., "Antique Furniture", "Electronics", "Collectibles", "Jewelry", "Art", "Tools", "Clothing", etc.).`;
  }

  private parseCategories(responseText: string): CategoryResult[] {
    try {
      let jsonText: string;

      const markdownMatch = responseText.match(/```json\n([\s\S]*?)\n```/);
      if (markdownMatch?.[1]) {
        jsonText = markdownMatch[1];
      } else {
        const arrayMatch = responseText.match(/\[[\s\S]*?\]/);
        if (arrayMatch) {
          jsonText = arrayMatch[0];
        } else {
          throw new Error('Could not parse JSON from response');
        }
      }

      const parsed = JSON.parse(jsonText) as Array<{
        category: string;
        confidence: number;
        reasoning?: string;
      }>;

      return parsed.map((cat) => ({
        category: cat.category,
        confidence: cat.confidence,
        confidenceLevel: this.getConfidenceLevel(cat.confidence),
        reasoning: cat.reasoning,
      }));
    } catch (error) {
      logger.warn('Failed to parse structured response, using fallback', { error });
      return [
        {
          category: 'General Item',
          confidence: 0.5,
          confidenceLevel: 'medium' as ConfidenceLevel,
          reasoning: 'Failed to parse structured response',
        },
      ];
    }
  }

  private getConfidenceLevel(confidence: number): ConfidenceLevel {
    if (confidence > 0.8) return 'high' as ConfidenceLevel;
    if (confidence >= 0.5) return 'medium' as ConfidenceLevel;
    return 'low' as ConfidenceLevel;
  }
}
