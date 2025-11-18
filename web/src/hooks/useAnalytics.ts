import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';

interface DateRange {
  start: Date;
  end: Date;
}

export function useTimeSeriesData(metric: string, dateRange: DateRange) {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const { getAccessToken } = useAuth();

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const token = await getAccessToken();
        const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/analytics/timeseries`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            metric,
            startDate: dateRange.start.toISOString(),
            endDate: dateRange.end.toISOString()
          })
        });
        const result = await response.json();
        if (result.success) {
          setData(result.data);
        }
      } catch (error) {
        console.error('Failed to fetch time series data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [metric, dateRange, getAccessToken]);

  return { data, loading };
}

export function useProviderComparison(dateRange: DateRange) {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const { getAccessToken } = useAuth();

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const token = await getAccessToken();
        const response = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL}/api/analytics/provider-comparison?startDate=${dateRange.start.toISOString()}&endDate=${dateRange.end.toISOString()}`,
          {
            headers: {
              'Authorization': `Bearer ${token}`
            }
          }
        );
        const result = await response.json();
        if (result.success) {
          setData(result.data);
        }
      } catch (error) {
        console.error('Failed to fetch provider comparison:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [dateRange, getAccessToken]);

  return { data, loading };
}

export function useCohortAnalysis(dateRange: DateRange) {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Mock data for now
    setData([
      {
        cohort_week: new Date(),
        provider: 'gemini',
        cohort_size: 1000,
        avg_confidence: 0.85,
        total_cost: 25.50
      }
    ]);
    setLoading(false);
  }, [dateRange]);

  return { data, loading };
}
