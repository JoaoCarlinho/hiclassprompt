'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { Layout } from '@/components/layout/Layout';
import { QuickStats } from '@/components/Dashboard/QuickStats';
import { ActiveBatches } from '@/components/Dashboard/ActiveBatches';
import { CostTrendChart } from '@/components/Dashboard/CostTrendChart';
import { RecentActivity } from '@/components/Dashboard/RecentActivity';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { ErrorMessage } from '@/components/ui/ErrorMessage';
import { Plus, FileText } from 'lucide-react';
import { useDashboardStats, useActiveBatches, useRecentActivity } from '@/hooks/useAPI';

export default function DashboardPage() {
  const router = useRouter();
  const { data: stats, loading: statsLoading, error: statsError, refetch: refetchStats } = useDashboardStats();
  const { data: activeBatches, loading: batchesLoading, error: batchesError, refetch: refetchBatches } = useActiveBatches();
  const { data: recentActivity, loading: activityLoading, error: activityError, refetch: refetchActivity } = useRecentActivity(10);

  const isLoading = statsLoading || batchesLoading || activityLoading;
  const hasError = statsError || batchesError || activityError;

  if (isLoading) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <LoadingSpinner size="lg" />
        </div>
      </Layout>
    );
  }

  if (hasError) {
    return (
      <Layout>
        <ErrorMessage
          error={statsError || batchesError || activityError}
          onRetry={() => {
            refetchStats();
            refetchBatches();
            refetchActivity();
          }}
          variant="card"
        />
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
              Dashboard
            </h1>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              Last 24 Hours Overview
            </p>
          </div>
          <div className="flex gap-3">
            <Button variant="outline" onClick={() => router.push('/costs')}>
              <FileText className="h-4 w-4 mr-2" />
              Generate Report
            </Button>
            <Button onClick={() => router.push('/classify')}>
              <Plus className="h-4 w-4 mr-2" />
              New Classification
            </Button>
          </div>
        </div>

        {/* Quick Stats */}
        {stats && <QuickStats stats={stats} />}

        {/* Main Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Active Batches */}
          <div className="lg:col-span-1">
            {activeBatches && <ActiveBatches batches={activeBatches?.active || []} />}
          </div>

          {/* Cost Trend Chart */}
          <div className="lg:col-span-2">
            <CostTrendChart />
          </div>
        </div>

        {/* Category Distribution & Provider Performance */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Category Distribution</CardTitle>
            </CardHeader>
            <CardContent>
              {stats?.categoryDistribution && stats.categoryDistribution.length > 0 ? (
                <div className="space-y-3">
                  {stats.categoryDistribution.map((category) => (
                    <div key={category.category}>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="text-gray-600 dark:text-gray-300">{category.category}</span>
                        <span className="font-medium text-gray-900 dark:text-white">
                          {category.percentage.toFixed(1)}%
                        </span>
                      </div>
                      <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                        <div
                          className="bg-primary-600 h-2 rounded-full"
                          style={{ width: `${category.percentage}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-gray-500 dark:text-gray-400">No category data available</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Provider Performance</CardTitle>
            </CardHeader>
            <CardContent>
              {stats?.providerPerformance && stats.providerPerformance.length > 0 ? (
                <div className="space-y-4">
                  {stats.providerPerformance.map((provider) => (
                    <div key={provider.provider} className="flex items-center justify-between">
                      <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                        {provider.provider}
                      </span>
                      <div className="flex items-center gap-2">
                        <div className="w-32 bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                          <div
                            className="bg-green-600 h-2 rounded-full"
                            style={{ width: `${provider.successRate}%` }}
                          />
                        </div>
                        <span className="text-sm font-medium text-gray-900 dark:text-white w-12 text-right">
                          {provider.successRate.toFixed(1)}%
                        </span>
                      </div>
                    </div>
                  ))}
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                    Based on last 1,000 requests
                  </p>
                </div>
              ) : (
                <p className="text-sm text-gray-500 dark:text-gray-400">No provider data available</p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Recent Activity */}
        {recentActivity && <RecentActivity results={recentActivity?.activities || []} />}
      </div>
    </Layout>
  );
}
