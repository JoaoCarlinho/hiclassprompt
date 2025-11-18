import React from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '../ui/Card';
import { ProgressBar } from '../ui/ProgressBar';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { BatchSession } from '@/types';
import { Clock, Pause, Play } from 'lucide-react';

interface ActiveBatchesProps {
  batches: BatchSession[];
}

export const ActiveBatches: React.FC<ActiveBatchesProps> = ({ batches }) => {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Active Batches</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {batches.length === 0 ? (
            <p className="text-gray-500 dark:text-gray-400 text-center py-8">
              No active batches
            </p>
          ) : (
            batches.map((batch) => (
              <div key={batch.sessionId} className="border-b border-gray-200 dark:border-gray-700 last:border-0 pb-4 last:pb-0">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <h4 className="font-medium text-gray-900 dark:text-white">
                      {batch.sessionId}
                    </h4>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge variant={batch.status === 'running' ? 'info' : 'warning'} size="sm">
                        {batch.status}
                      </Badge>
                      <span className="text-xs text-gray-500 dark:text-gray-400">
                        {batch.completedItems}/{batch.totalItems} images
                      </span>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" variant="ghost">
                      {batch.status === 'running' ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                    </Button>
                    <Button size="sm" variant="outline">
                      Details
                    </Button>
                  </div>
                </div>
                <ProgressBar
                  value={batch.completedItems}
                  max={batch.totalItems}
                  size="sm"
                  showLabel={false}
                />
                <div className="flex items-center text-xs text-gray-500 dark:text-gray-400 mt-2">
                  <Clock className="h-3 w-3 mr-1" />
                  ETA: 22 seconds
                </div>
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
};
