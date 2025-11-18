'use client';

import React from 'react';
import { Layout } from '@/components/layout/Layout';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';

export default function ComparePage() {
  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            Provider Comparison
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Compare AI provider performance and costs
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Compare Providers</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-gray-500 dark:text-gray-400">
              Provider comparison feature coming soon.
            </p>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
