/**
 * React Hook for Provider Comparison Progress
 * Tracks real-time progress updates during multi-provider comparisons
 */

import { useEffect, useState } from 'react';
import { useWebSocket } from './useWebSocket';

interface ComparisonProgressUpdate {
  comparisonId: string;
  provider: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  resultsCount?: number;
  error?: string;
  timestamp: Date;
}

/**
 * Hook for tracking comparison progress via WebSocket
 */
export function useComparisonProgress(comparisonId: string | null) {
  const { subscribe, isConnected } = useWebSocket();
  const [progress, setProgress] = useState<Record<string, ComparisonProgressUpdate>>({});

  useEffect(() => {
    if (!comparisonId || !isConnected) return;

    const handleProgress = (data: ComparisonProgressUpdate) => {
      setProgress((prev) => ({
        ...prev,
        [data.provider]: data,
      }));
    };

    const unsubscribe = subscribe(`comparison:progress:${comparisonId}`, handleProgress);

    return () => {
      unsubscribe();
    };
  }, [comparisonId, isConnected, subscribe]);

  return {
    progress,
    isConnected,
  };
}
