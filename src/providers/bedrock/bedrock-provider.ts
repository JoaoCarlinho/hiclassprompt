/**
 * AWS Bedrock provider implementation
 */

import {
  BedrockRuntimeClient,
  InvokeModelCommand,
} from '@aws-sdk/client-bedrock-runtime';
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
 * AWS Bedrock provider (using Claude on Bedrock)
 */
export class BedrockProvider implements IProvider {
  readonly name: AIProvider = 'bedrock' as AIProvider;
  private client: BedrockRuntimeClient;
  private model: string;
  private rateLimiter: RateLimiter;

  constructor(apiKey: string, model = 'anthropic.claude-3-sonnet-20240229-v1:0') {
    // apiKey is actually the AWS region for Bedrock
    this.client = new BedrockRuntimeClient({ region: apiKey || 'us-east-1' });
    this.model = model;
    this.rateLimiter = new RateLimiter(100); // 100 requests/minute for Bedrock
  }

  async validateConfig(): Promise<void> {
    try {
      // Test with a minimal request
      const payload = {
        anthropic_version: 'bedrock-2023-05-31',
        max_tokens: 10,
        messages: [{ role: 'user', content: 'test' }],
      };

      const command = new InvokeModelCommand({
        modelId: this.model,
        body: JSON.stringify(payload),
        contentType: 'application/json',
        accept: 'application/json',
      });

      await this.client.send(command);
      logger.info('Bedrock provider configuration validated');
    } catch (error) {
      const err = error as Error;
      logger.error('Bedrock validation failed', { error: err.message });
      throw new Error(`Bedrock API validation failed: ${err.message}`);
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

      const payload = {
        anthropic_version: 'bedrock-2023-05-31',
        max_tokens: 1024,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'image',
                source: {
                  type: 'base64',
                  media_type: mimeType,
                  data: imageData,
                },
              },
              {
                type: 'text',
                text: prompt,
              },
            ],
          },
        ],
      };

      const command = new InvokeModelCommand({
        modelId: this.model,
        body: JSON.stringify(payload),
        contentType: 'application/json',
        accept: 'application/json',
      });

      const response = await this.client.send(command);
      const responseBody = JSON.parse(new TextDecoder().decode(response.body)) as {
        content?: Array<{ text?: string }>;
        usage?: { input_tokens?: number; output_tokens?: number };
        stop_reason?: string;
      };

      const text = responseBody.content?.[0]?.text || '';
      const categories = this.parseCategories(text);

      const inputTokens = responseBody.usage?.input_tokens || 0;
      const outputTokens = responseBody.usage?.output_tokens || 0;
      const totalTokens = inputTokens + outputTokens;

      // Bedrock pricing varies by model, using Claude 3 Sonnet as example
      // $3 per 1M input tokens, $15 per 1M output tokens
      const costUsd = (inputTokens / 1_000_000) * 3 + (outputTokens / 1_000_000) * 15;

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
          stopReason: responseBody.stop_reason,
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
