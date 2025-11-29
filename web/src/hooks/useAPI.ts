/**
 * React Hooks for API Operations
 * Provides easy-to-use hooks for API calls with loading and error states
 */

import { useState, useEffect, useCallback } from 'react';
import { apiClient } from '@/lib/api-client';

export interface UseAPIState<T> {
  data: T | null;
  loading: boolean;
  error: Error | null;
}

export interface UseAPIResult<T> extends UseAPIState<T> {
  refetch: () => Promise<void>;
}

/**
 * Generic hook for API calls
 */
export function useAPI<T>(
  apiFn: () => Promise<T>,
  deps: any[] = []
): UseAPIResult<T> {
  const [state, setState] = useState<UseAPIState<T>>({
    data: null,
    loading: true,
    error: null,
  });

  const fetchData = useCallback(async () => {
    setState((prev) => ({ ...prev, loading: true, error: null }));

    try {
      const data = await apiFn();
      setState({ data, loading: false, error: null });
    } catch (error) {
      setState({ data: null, loading: false, error: error as Error });
    }
  }, [apiFn]);

  useEffect(() => {
    fetchData();
  }, deps);

  return {
    ...state,
    refetch: fetchData,
  };
}

/**
 * Hook for Dashboard Stats
 */
export function useDashboardStats() {
  return useAPI(() => apiClient.getDashboardStats(), []);
}

/**
 * Hook for Recent Activity
 */
export function useRecentActivity(limit: number = 10) {
  return useAPI(() => apiClient.getRecentActivity(limit), [limit]);
}

/**
 * Hook for Active Batches
 */
export function useActiveBatches() {
  return useAPI(() => apiClient.getActiveBatches(), []);
}

/**
 * Hook for Cost Stats
 */
export function useCostStats(timeRange?: string) {
  return useAPI(() => apiClient.getCostStats(timeRange), [timeRange]);
}

/**
 * Hook for Budget Status
 */
export function useBudgetStatus() {
  return useAPI(() => apiClient.getBudgetStatus(), []);
}

/**
 * Hook for Providers
 */
export function useProviders() {
  return useAPI(() => apiClient.getProviders(), []);
}

/**
 * Hook for Batch Session
 */
export function useBatchSession(sessionId: string | null) {
  return useAPI(
    () => (sessionId ? apiClient.getBatchSession(sessionId) : Promise.resolve(null)),
    [sessionId]
  );
}

/**
 * Hook for Classification (mutation)
 */
export function useClassify() {
  const [state, setState] = useState<{
    loading: boolean;
    error: Error | null;
  }>({
    loading: false,
    error: null,
  });

  const classify = useCallback(
    async (
      imageInput: File | string,
      options?: {
        provider?: string;
        model?: string;
        title?: string;
        description?: string;
      }
    ) => {
      setState({ loading: true, error: null });

      try {
        let result;
        if (typeof imageInput === 'string') {
          // Image URL
          result = await apiClient.classifyImageByURL(imageInput, options);
        } else {
          // Image File
          result = await apiClient.classifyImage(imageInput, options);
        }
        setState({ loading: false, error: null });
        return result;
      } catch (error) {
        setState({ loading: false, error: error as Error });
        throw error;
      }
    },
    []
  );

  return {
    classify,
    loading: state.loading,
    error: state.error,
  };
}

/**
 * Hook for Provider Comparison (mutation)
 */
export function useCompareProviders() {
  const [state, setState] = useState<{
    loading: boolean;
    error: Error | null;
  }>({
    loading: false,
    error: null,
  });

  const compare = useCallback(async (imageFile: File, providers?: string[]) => {
    setState({ loading: true, error: null });

    try {
      const result = await apiClient.compareProviders(imageFile, providers);
      setState({ loading: false, error: null });
      return result;
    } catch (error) {
      setState({ loading: false, error: error as Error });
      throw error;
    }
  }, []);

  return {
    compare,
    loading: state.loading,
    error: state.error,
  };
}

/**
 * Hook for Batch Creation (mutation)
 */
export function useCreateBatch() {
  const [state, setState] = useState<{
    loading: boolean;
    error: Error | null;
  }>({
    loading: false,
    error: null,
  });

  const createBatch = useCallback(
    async (
      input: { type: 'directory' | 'csv' | 'json' | 'urls'; data: any },
      config: {
        provider: string;
        model?: string;
        concurrency?: number;
        retryAttempts?: number;
        skipDuplicates?: boolean;
      }
    ) => {
      setState({ loading: true, error: null });

      try {
        const result = await apiClient.createBatchSession(input, config);
        setState({ loading: false, error: null });
        return result;
      } catch (error) {
        setState({ loading: false, error: error as Error });
        throw error;
      }
    },
    []
  );

  return {
    createBatch,
    loading: state.loading,
    error: state.error,
  };
}

/**
 * Hook for Batch Controls (pause/resume/stop)
 */
export function useBatchControls(sessionId: string) {
  const pauseBatch = useCallback(async () => {
    await apiClient.pauseBatchSession(sessionId);
  }, [sessionId]);

  const resumeBatch = useCallback(async () => {
    await apiClient.resumeBatchSession(sessionId);
  }, [sessionId]);

  const stopBatch = useCallback(async () => {
    await apiClient.stopBatchSession(sessionId);
  }, [sessionId]);

  return {
    pauseBatch,
    resumeBatch,
    stopBatch,
  };
}

/**
 * Hook for Cost Export (mutation)
 */
export function useExportCosts() {
  const [state, setState] = useState<{
    loading: boolean;
    error: Error | null;
  }>({
    loading: false,
    error: null,
  });

  const exportCosts = useCallback(
    async (format: 'csv' | 'json' | 'excel', options?: any) => {
      setState({ loading: true, error: null });

      try {
        const blob = await apiClient.exportCosts(format, options);
        setState({ loading: false, error: null });

        // Trigger download
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `costs-export-${Date.now()}.${format}`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);

        return blob;
      } catch (error) {
        setState({ loading: false, error: error as Error });
        throw error;
      }
    },
    []
  );

  return {
    exportCosts,
    loading: state.loading,
    error: state.error,
  };
}
