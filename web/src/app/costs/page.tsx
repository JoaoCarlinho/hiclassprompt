'use client';

import React from 'react';
import { Layout } from '@/components/layout/Layout';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { StatCard } from '@/components/ui/StatCard';
import { Button } from '@/components/ui/Button';
import { DollarSign, TrendingDown, TrendingUp, Download } from 'lucide-react';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

const costTrendData = [
  { date: 'Dec 15', cost: 0.8 },
  { date: 'Dec 22', cost: 1.2 },
  { date: 'Dec 29', cost: 1.5 },
  { date: 'Jan 5', cost: 2.0 },
  { date: 'Jan 12', cost: 1.35 },
];

export default function CostsPage() {
  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
              Cost Analytics
            </h1>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              Last 30 Days Overview
            </p>
          </div>
          <div className="flex gap-3">
            <Button variant="outline">
              <Download className="h-4 w-4 mr-2" />
              Export CSV
            </Button>
            <Button variant="outline">
              <Download className="h-4 w-4 mr-2" />
              Export Excel
            </Button>
            <Button>
              <Download className="h-4 w-4 mr-2" />
              PDF Report
            </Button>
          </div>
        </div>

        {/* Overview Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <StatCard
            title="Total Spend"
            value="$42.18"
            change={{ value: 88, trend: 'down' }}
            icon={<DollarSign className="h-6 w-6 text-blue-600" />}
          />
          <StatCard
            title="Avg Cost/Request"
            value="$0.000075"
            change={{ value: 0, trend: 'neutral' }}
            icon={<DollarSign className="h-6 w-6 text-green-600" />}
          />
          <StatCard
            title="Total Requests"
            value="562,400"
            change={{ value: 156, trend: 'up' }}
            icon={<TrendingUp className="h-6 w-6 text-purple-600" />}
          />
          <StatCard
            title="Savings"
            value="$280,200"
            change={{ value: 99, trend: 'up' }}
            icon={<TrendingDown className="h-6 w-6 text-green-600" />}
          />
        </div>

        {/* Cost Trend */}
        <Card>
          <CardHeader>
            <CardTitle>Cost Trend (30 Days)</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={costTrendData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis dataKey="date" stroke="#9CA3AF" />
                <YAxis stroke="#9CA3AF" />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#1F2937',
                    border: '1px solid #374151',
                    borderRadius: '6px',
                  }}
                />
                <Line type="monotone" dataKey="cost" stroke="#0EA5E9" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Provider Breakdown & Budget */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Provider Breakdown</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium">Gemini</span>
                  <div className="flex items-center gap-3">
                    <div className="text-right text-sm">
                      <div className="font-medium">$42.18</div>
                      <div className="text-gray-500">562,400 requests</div>
                    </div>
                    <span className="text-sm text-gray-500">100%</span>
                  </div>
                </div>
                <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                  <div className="bg-primary-600 h-2 rounded-full" style={{ width: '100%' }} />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Budget Status</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <div className="flex justify-between text-sm mb-2">
                    <span>Daily</span>
                    <span>$1.35 / $10.00 (13.5%)</span>
                  </div>
                  <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                    <div className="bg-green-600 h-2 rounded-full" style={{ width: '13.5%' }} />
                  </div>
                </div>
                <div>
                  <div className="flex justify-between text-sm mb-2">
                    <span>Weekly</span>
                    <span>$9.44 / $50.00 (18.9%)</span>
                  </div>
                  <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                    <div className="bg-green-600 h-2 rounded-full" style={{ width: '18.9%' }} />
                  </div>
                </div>
                <div>
                  <div className="flex justify-between text-sm mb-2">
                    <span>Monthly</span>
                    <span>$42.18 / $200.00 (21.1%)</span>
                  </div>
                  <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                    <div className="bg-green-600 h-2 rounded-full" style={{ width: '21.1%' }} />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* ROI Analysis */}
        <Card>
          <CardHeader>
            <CardTitle>ROI Analysis</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-8">
              <div>
                <h4 className="font-medium mb-4">Cost Comparison</h4>
                <dl className="space-y-3 text-sm">
                  <div className="flex justify-between">
                    <dt className="text-gray-600 dark:text-gray-400">Manual Classification:</dt>
                    <dd className="font-medium">$281,200</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-gray-600 dark:text-gray-400">AI Classification:</dt>
                    <dd className="font-medium">$42.18</dd>
                  </div>
                  <div className="flex justify-between border-t border-gray-200 dark:border-gray-700 pt-3">
                    <dt className="font-medium text-green-600 dark:text-green-400">Total Savings:</dt>
                    <dd className="font-bold text-green-600 dark:text-green-400">$281,158 (99.98%)</dd>
                  </div>
                </dl>
              </div>
              <div>
                <h4 className="font-medium mb-4">Annual Projection</h4>
                <dl className="space-y-3 text-sm">
                  <div className="flex justify-between">
                    <dt className="text-gray-600 dark:text-gray-400">Cost:</dt>
                    <dd className="font-medium">$506.16 vs $3.37M (manual)</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-gray-600 dark:text-gray-400">Savings:</dt>
                    <dd className="font-medium">$3,369,484 (99.98%)</dd>
                  </div>
                  <div className="flex justify-between border-t border-gray-200 dark:border-gray-700 pt-3">
                    <dt className="font-medium">ROI:</dt>
                    <dd className="font-bold">6,666x</dd>
                  </div>
                </dl>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
