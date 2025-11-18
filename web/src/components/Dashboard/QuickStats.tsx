import React from 'react';
import { StatCard } from '../ui/StatCard';
import { Image, CheckCircle, DollarSign, Zap } from 'lucide-react';

interface QuickStatsProps {
  stats: {
    totalImages: number;
    successRate: number;
    totalCost: number;
    averageLatency: number;
  };
}

export const QuickStats: React.FC<QuickStatsProps> = ({ stats }) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      <StatCard
        title="Images Processed"
        value={stats.totalImages.toLocaleString()}
        change={{ value: 23, trend: 'up' }}
        icon={<Image className="h-6 w-6 text-primary-600" />}
      />
      <StatCard
        title="Success Rate"
        value={`${stats.successRate}%`}
        change={{ value: 2.1, trend: 'up' }}
        icon={<CheckCircle className="h-6 w-6 text-green-600" />}
      />
      <StatCard
        title="Total Cost"
        value={`$${stats.totalCost.toFixed(2)}`}
        change={{ value: 88, trend: 'down' }}
        icon={<DollarSign className="h-6 w-6 text-blue-600" />}
      />
      <StatCard
        title="Avg Latency"
        value={`${stats.averageLatency}ms`}
        change={{ value: 15, trend: 'down' }}
        icon={<Zap className="h-6 w-6 text-yellow-600" />}
      />
    </div>
  );
};
