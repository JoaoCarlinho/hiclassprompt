'use client';

/**
 * Comparison Results Component
 * Displays provider comparison results with statistics and analysis
 */

import React from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { StatCard } from '@/components/ui/StatCard';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { exportAsJSON, exportAsCSV } from '@/lib/export-utils';

interface ComparisonResultsProps {
  data: {
    comparisonId: string;
    request: {
      prompt: string;
      imageCount: number;
      providers: string[];
      timestamp: string;
    };
    results: Array<{
      provider: string;
      model: string;
      results: any[];
      aggregates: {
        averageLatency: number;
        totalCost: number;
        totalTokens: number;
        averageConfidence: number;
        successRate: number;
      };
    }>;
    consensus: {
      agreementLevel: number;
      agreementCount: number;
      majorityCategory: string | null;
      allCategories: string[];
      disagreementCategories?: string[];
    };
    statistics: {
      fastest: { provider: string; latency: number };
      cheapest: { provider: string; cost: number };
      mostConfident: { provider: string; confidence: number };
      averageLatency: number;
      totalCost: number;
      totalTokens: number;
    };
    errors: Array<{ provider: string; error: string }>;
  };
}

export const ComparisonResults: React.FC<ComparisonResultsProps> = ({ data }) => {
  const handleExportJSON = () => {
    exportAsJSON(data, `comparison-${data.comparisonId}.json`);
  };

  const handleExportCSV = () => {
    exportAsCSV(data, `comparison-${data.comparisonId}.csv`);
  };

  return (
    <div className="space-y-6">
      {/* Summary Statistics */}
      <div>
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
          Summary Statistics
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <StatCard
            title="Fastest Provider"
            value={data.statistics.fastest.provider.toUpperCase()}
            className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20"
          />
          <StatCard
            title="Cheapest Provider"
            value={data.statistics.cheapest.provider.toUpperCase()}
            className="bg-gradient-to-br from-green-50 to-green-100 dark:from-green-900/20 dark:to-green-800/20"
          />
          <StatCard
            title="Most Confident"
            value={data.statistics.mostConfident.provider.toUpperCase()}
            className="bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-900/20 dark:to-purple-800/20"
          />
        </div>
      </div>

      {/* Consensus Analysis */}
      <Card>
        <CardHeader>
          <CardTitle>Consensus Analysis</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Agreement Level:
              </span>
              <div className="flex items-center space-x-2">
                <div className="w-48 bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                  <div
                    className={`h-2 rounded-full ${
                      data.consensus.agreementLevel > 75
                        ? 'bg-green-500'
                        : data.consensus.agreementLevel > 50
                        ? 'bg-yellow-500'
                        : 'bg-red-500'
                    }`}
                    style={{ width: `${data.consensus.agreementLevel}%` }}
                  />
                </div>
                <span className="text-sm font-bold text-gray-900 dark:text-white">
                  {data.consensus.agreementLevel}%
                </span>
              </div>
            </div>

            {data.consensus.majorityCategory && (
              <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg">
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                  Majority Classification:
                </p>
                <p className="text-lg font-semibold text-gray-900 dark:text-white">
                  {data.consensus.majorityCategory}
                </p>
                <p className="text-sm text-gray-500 dark:text-gray-500 mt-1">
                  ({data.consensus.agreementCount} out of {data.results.reduce((sum, r) => sum + r.results.length, 0)} classifications agree)
                </p>
              </div>
            )}

            {data.consensus.disagreementCategories && data.consensus.disagreementCategories.length > 0 && (
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                  Other categories detected:
                </p>
                <div className="flex flex-wrap gap-2">
                  {data.consensus.disagreementCategories.map((category) => (
                    <Badge key={category} variant="secondary">
                      {category}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Provider Comparison Table */}
      <Card>
        <CardHeader>
          <CardTitle>Provider Comparison</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-800">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Provider
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Model
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Avg Latency
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Total Cost
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Avg Confidence
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Success Rate
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-700">
                {data.results.map((result) => (
                  <tr
                    key={result.provider}
                    className={
                      result.provider === data.statistics.fastest.provider
                        ? 'bg-blue-50 dark:bg-blue-900/10'
                        : ''
                    }
                  >
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white capitalize">
                      {result.provider}
                      {result.provider === data.statistics.fastest.provider && (
                        <Badge variant="primary" className="ml-2">
                          Fastest
                        </Badge>
                      )}
                      {result.provider === data.statistics.cheapest.provider && (
                        <Badge variant="success" className="ml-2">
                          Cheapest
                        </Badge>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                      {result.model}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-900 dark:text-white">
                      {result.aggregates.averageLatency.toFixed(0)}ms
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-900 dark:text-white">
                      ${result.aggregates.totalCost.toFixed(4)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-900 dark:text-white">
                      {(result.aggregates.averageConfidence * 100).toFixed(1)}%
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-900 dark:text-white">
                      {(result.aggregates.successRate * 100).toFixed(1)}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Errors (if any) */}
      {data.errors.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-red-600 dark:text-red-400">
              Provider Errors ({data.errors.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {data.errors.map((error) => (
                <div
                  key={error.provider}
                  className="bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800 rounded-lg p-3"
                >
                  <p className="text-sm font-medium text-red-900 dark:text-red-300 capitalize">
                    {error.provider}
                  </p>
                  <p className="text-sm text-red-700 dark:text-red-400 mt-1">
                    {error.error}
                  </p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Export Options */}
      <Card>
        <CardHeader>
          <CardTitle>Export Results</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex space-x-4">
            <Button onClick={handleExportJSON} variant="secondary">
              Export as JSON
            </Button>
            <Button onClick={handleExportCSV} variant="secondary">
              Export as CSV
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
