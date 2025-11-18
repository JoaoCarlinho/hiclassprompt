'use client';

import React from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '../ui/Card';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

const mockData = [
  { day: 'Mon', cost: 0.8 },
  { day: 'Tue', cost: 1.2 },
  { day: 'Wed', cost: 1.5 },
  { day: 'Thu', cost: 1.9 },
  { day: 'Fri', cost: 2.3 },
  { day: 'Sat', cost: 2.1 },
  { day: 'Sun', cost: 1.35 },
];

export const CostTrendChart: React.FC = () => {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Cost Trend (7 Days)</CardTitle>
          <div className="text-sm text-gray-500 dark:text-gray-400">
            Current: $1.35
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={200}>
          <LineChart data={mockData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis dataKey="day" stroke="#9CA3AF" fontSize={12} />
            <YAxis stroke="#9CA3AF" fontSize={12} />
            <Tooltip
              contentStyle={{
                backgroundColor: '#1F2937',
                border: '1px solid #374151',
                borderRadius: '6px',
              }}
              labelStyle={{ color: '#F3F4F6' }}
            />
            <Line
              type="monotone"
              dataKey="cost"
              stroke="#0EA5E9"
              strokeWidth={2}
              dot={{ fill: '#0EA5E9', r: 4 }}
            />
          </LineChart>
        </ResponsiveContainer>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-2 text-center">
          Trend: ↓ Decreasing
        </p>
      </CardContent>
    </Card>
  );
};
