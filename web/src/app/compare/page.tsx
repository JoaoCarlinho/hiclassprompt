'use client';

import React from 'react';
import { Layout } from '@/components/layout/Layout';
import { ProviderComparison } from '@/components/Comparison/ProviderComparison';

export default function ComparePage() {
  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            Provider Comparison
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Test your prompt across all AI providers simultaneously and compare performance, cost, and accuracy
          </p>
        </div>

        <ProviderComparison />
      </div>
    </Layout>
  );
}
