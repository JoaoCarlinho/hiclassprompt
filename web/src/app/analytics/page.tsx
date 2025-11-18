'use client';

import React, { useState } from 'react';
import dynamic from 'next/dynamic';
import { Layout } from '@/components/layout/Layout';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import {
  useTimeSeriesData,
  useCohortAnalysis,
  useProviderComparison
} from '@/hooks/useAnalytics';

// Dynamically import Plot to avoid SSR issues
const Plot = dynamic(() => import('react-plotly.js'), { ssr: false });

export default function AnalyticsPage() {
  const [dateRange, setDateRange] = useState({
    start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
    end: new Date()
  });
  const [selectedMetric, setSelectedMetric] = useState<'cost' | 'latency' | 'confidence'>('cost');

  const { data: timeSeriesData, loading: timeSeriesLoading } = useTimeSeriesData(
    selectedMetric,
    dateRange
  );

  const { data: cohortData, loading: cohortLoading } = useCohortAnalysis(dateRange);
  const { data: providerData, loading: providerLoading } = useProviderComparison(dateRange);

  const isLoading = timeSeriesLoading || cohortLoading || providerLoading;

  if (isLoading) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <LoadingSpinner size="lg" />
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="max-w-7xl mx-auto space-y-6 p-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            Advanced Analytics
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Deep insights into classification performance and costs
          </p>
        </div>

        {/* Metric Selector */}
        <div className="flex gap-2">
          {(['cost', 'latency', 'confidence'] as const).map((metric) => (
            <button
              key={metric}
              onClick={() => setSelectedMetric(metric)}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                selectedMetric === metric
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300'
              }`}
            >
              {metric.charAt(0).toUpperCase() + metric.slice(1)}
            </button>
          ))}
        </div>

        {/* Time Series Chart */}
        <Card className="p-6">
          <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-white">
            Trend Analysis - {selectedMetric}
          </h2>
          {timeSeriesData && timeSeriesData.length > 0 ? (
            <Plot
              data={[
                {
                  x: timeSeriesData.map(d => d.timestamp),
                  y: timeSeriesData.map(d => d.value),
                  type: 'scatter',
                  mode: 'lines+markers',
                  marker: { color: '#3b82f6' },
                  line: { width: 2 }
                }
              ]}
              layout={{
                autosize: true,
                xaxis: { title: { text: 'Date' } },
                yaxis: { title: { text: selectedMetric } },
                margin: { l: 50, r: 50, t: 20, b: 50 },
                paper_bgcolor: 'transparent',
                plot_bgcolor: 'transparent'
              } as any}
              config={{ responsive: true }}
              style={{ width: '100%', height: '400px' }}
            />
          ) : (
            <div className="text-center text-gray-500 py-8">No data available</div>
          )}
        </Card>

        {/* Provider Comparison */}
        <Card className="p-6">
          <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-white">
            Provider Performance Comparison
          </h2>
          {providerData && providerData.length > 0 ? (
            <Plot
              data={[
                {
                  x: providerData.map(p => p.provider),
                  y: providerData.map(p => p.avg_cost_per_image),
                  type: 'bar',
                  marker: {
                    color: providerData.map((_, i) =>
                      ['#3b82f6', '#10b981', '#f59e0b', '#ef4444'][i]
                    )
                  },
                  text: providerData.map(p => `$${p.avg_cost_per_image.toFixed(6)}`),
                  textposition: 'auto'
                }
              ]}
              layout={{
                autosize: true,
                xaxis: { title: { text: 'Provider' } },
                yaxis: { title: { text: 'Average Cost per Image ($)' } },
                margin: { l: 50, r: 50, t: 20, b: 50 },
                paper_bgcolor: 'transparent',
                plot_bgcolor: 'transparent'
              } as any}
              config={{ responsive: true }}
              style={{ width: '100%', height: '400px' }}
            />
          ) : (
            <div className="text-center text-gray-500 py-8">No data available</div>
          )}
        </Card>

        {/* Cohort Analysis */}
        <Card className="p-6">
          <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-white">
            Cohort Analysis
          </h2>
          {cohortData && cohortData.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead className="bg-gray-50 dark:bg-gray-800">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Cohort Week
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Provider
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Size
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Avg Confidence
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Total Cost
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-700">
                  {cohortData.map((cohort, idx) => (
                    <tr key={idx}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                        {new Date(cohort.cohort_week).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                        {cohort.provider}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                        {cohort.cohort_size.toLocaleString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                        {(cohort.avg_confidence * 100).toFixed(1)}%
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                        ${cohort.total_cost.toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center text-gray-500 py-8">No data available</div>
          )}
        </Card>
      </div>
    </Layout>
  );
}
