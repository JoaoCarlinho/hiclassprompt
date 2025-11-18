import React from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '../ui/Card';
import { ClassificationResult } from '@/types';
import { formatDistanceToNow } from 'date-fns';
import { Badge } from '../ui/Badge';

interface RecentActivityProps {
  results: ClassificationResult[];
}

export const RecentActivity: React.FC<RecentActivityProps> = ({ results }) => {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Recent Activity</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead>
              <tr className="text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                <th className="pb-3">Time</th>
                <th className="pb-3">Image</th>
                <th className="pb-3">Category</th>
                <th className="pb-3">Provider</th>
                <th className="pb-3 text-right">Cost</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {results.slice(0, 5).map((result) => (
                <tr key={result.id} className="text-sm">
                  <td className="py-3 text-gray-500 dark:text-gray-400">
                    {formatDistanceToNow(new Date(result.timestamp), { addSuffix: true })}
                  </td>
                  <td className="py-3 font-medium text-gray-900 dark:text-white truncate max-w-xs">
                    {result.imagePath.split('/').pop()}
                  </td>
                  <td className="py-3">
                    <Badge variant="default" size="sm">
                      {result.classification.category} ({(result.classification.confidence * 100).toFixed(1)}%)
                    </Badge>
                  </td>
                  <td className="py-3 text-gray-600 dark:text-gray-300">
                    {result.provider}
                  </td>
                  <td className="py-3 text-right text-gray-600 dark:text-gray-300">
                    ${result.metrics.costUsd.toFixed(5)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {results.length > 5 && (
            <div className="mt-4 text-center">
              <button className="text-sm text-primary-600 hover:text-primary-700 dark:text-primary-400">
                View All ({results.length.toLocaleString()})
              </button>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
