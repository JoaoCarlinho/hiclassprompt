'use client';

/**
 * Provider Comparison Component
 * Main interface for comparing multiple AI providers
 */

import React, { useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { ErrorMessage } from '@/components/ui/ErrorMessage';
import { ComparisonResults } from './ComparisonResults';
import { useComparisonProgress } from '@/hooks/useComparisonProgress';

interface ComparisonResponse {
  comparisonId: string;
  request: {
    prompt: string;
    imageCount: number;
    providers: string[];
    timestamp: string;
  };
  results: any[];
  consensus: any;
  statistics: any;
  errors: any[];
}

export const ProviderComparison: React.FC = () => {
  const [prompt, setPrompt] = useState('');
  const [imageUrls, setImageUrls] = useState<string[]>([]);
  const [comparisonResult, setComparisonResult] = useState<ComparisonResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [comparisonId, setComparisonId] = useState<string | null>(null);

  const { progress, isConnected } = useComparisonProgress(comparisonId);

  const handleImageUrlChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const urls = e.target.value
      .split('\n')
      .map((url) => url.trim())
      .filter((url) => url.length > 0);
    setImageUrls(urls);
  };

  const handleCompare = async () => {
    if (!prompt || imageUrls.length === 0) {
      setError('Please provide both a prompt and at least one image URL');
      return;
    }

    setLoading(true);
    setError(null);
    setComparisonResult(null);

    try {
      const response = await fetch('/api/v1/prompts/compare', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          prompt,
          imageUrls,
          options: {
            includeStatistics: true,
            includeCostAnalysis: true,
          },
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Comparison failed');
      }

      const data: ComparisonResponse = await response.json();
      setComparisonResult(data);
      setComparisonId(data.comparisonId);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Input Section */}
      <Card>
        <CardHeader>
          <CardTitle>Configure Comparison</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {/* Prompt Input */}
            <div>
              <label
                htmlFor="prompt"
                className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
              >
                Prompt
              </label>
              <textarea
                id="prompt"
                rows={4}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                placeholder="Enter your classification prompt..."
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
              />
            </div>

            {/* Image URLs Input */}
            <div>
              <label
                htmlFor="imageUrls"
                className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
              >
                Image URLs (one per line)
              </label>
              <textarea
                id="imageUrls"
                rows={6}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-white font-mono text-sm"
                placeholder="https://example.com/image1.jpg&#10;https://example.com/image2.jpg"
                onChange={handleImageUrlChange}
              />
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                {imageUrls.length} image{imageUrls.length !== 1 ? 's' : ''} added
              </p>
            </div>

            {/* WebSocket Status */}
            {isConnected ? (
              <div className="flex items-center text-sm text-green-600 dark:text-green-400">
                <span className="mr-2">●</span>
                Real-time updates connected
              </div>
            ) : (
              <div className="flex items-center text-sm text-yellow-600 dark:text-yellow-400">
                <span className="mr-2">○</span>
                Real-time updates disconnected
              </div>
            )}

            {/* Compare Button */}
            <div className="flex justify-end">
              <Button
                onClick={handleCompare}
                disabled={loading || !prompt || imageUrls.length === 0}
                className="min-w-[200px]"
              >
                {loading ? (
                  <div className="flex items-center">
                    <LoadingSpinner size="sm" className="mr-2" />
                    Comparing...
                  </div>
                ) : (
                  'Compare All Providers'
                )}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Progress Indicators */}
      {loading && Object.keys(progress).length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Provider Progress</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {Object.entries(progress).map(([provider, status]) => (
                <div key={provider} className="flex items-center justify-between">
                  <span className="font-medium capitalize">{provider}</span>
                  <span
                    className={`text-sm ${
                      status.status === 'completed'
                        ? 'text-green-600 dark:text-green-400'
                        : status.status === 'failed'
                        ? 'text-red-600 dark:text-red-400'
                        : 'text-blue-600 dark:text-blue-400'
                    }`}
                  >
                    {status.status === 'completed' && `✓ Completed (${status.resultsCount} results)`}
                    {status.status === 'processing' && '⏳ Processing...'}
                    {status.status === 'failed' && `✗ Failed: ${status.error}`}
                    {status.status === 'pending' && '⏸ Pending...'}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Error Display */}
      {error && <ErrorMessage message={error} />}

      {/* Results Display */}
      {comparisonResult && <ComparisonResults data={comparisonResult} />}
    </div>
  );
};
