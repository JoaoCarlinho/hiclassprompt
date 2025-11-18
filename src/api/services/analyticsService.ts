// OpenSearch is optional - only import if needed
let Client: any;
let opensearch: any;

try {
  const opensearchModule = require('@opensearch-project/opensearch');
  Client = opensearchModule.Client;
  opensearch = new Client({
    node: process.env.OPENSEARCH_ENDPOINT || 'http://localhost:9200',
    auth: {
      username: process.env.OPENSEARCH_USERNAME || 'admin',
      password: process.env.OPENSEARCH_PASSWORD || 'admin'
    }
  });
} catch (error) {
  console.warn('OpenSearch not available - analytics features will use mock data');
  opensearch = null;
}

interface DateRange {
  start: Date;
  end: Date;
}

interface CohortCriteria {
  startDate: Date;
  endDate: Date;
}

export class AnalyticsService {
  // Time series analysis
  async getTimeSeriesData(metric: string, dateRange: DateRange) {
    // Return mock data if OpenSearch is not available
    if (!opensearch) {
      return this.getMockTimeSeriesData(metric, dateRange);
    }

    const query = {
      index: 'classification_results',
      body: {
        size: 0,
        query: {
          range: {
            created_at: {
              gte: dateRange.start.toISOString(),
              lte: dateRange.end.toISOString()
            }
          }
        },
        aggs: {
          timeline: {
            date_histogram: {
              field: 'created_at',
              interval: this.getInterval(dateRange),
              time_zone: 'America/New_York'
            },
            aggs: {
              metric_value: {
                [this.getAggregationType(metric)]: {
                  field: this.getMetricField(metric)
                }
              }
            }
          }
        }
      }
    };

    const result = await opensearch.search(query);
    return this.formatTimeSeriesResponse(result);
  }

  // Provider comparison
  async compareProviders(dateRange: DateRange) {
    // This would query your database
    return [
      {
        provider: 'gemini',
        total_requests: 1000,
        avg_confidence: 0.85,
        p95_latency: 250,
        total_cost: 25.50,
        avg_cost_per_image: 0.0255,
        high_confidence_rate: 78.5
      },
      {
        provider: 'claude',
        total_requests: 800,
        avg_confidence: 0.92,
        p95_latency: 320,
        total_cost: 48.00,
        avg_cost_per_image: 0.0600,
        high_confidence_rate: 89.2
      }
    ];
  }

  // Category performance
  async analyzeCategoryPerformance(dateRange: DateRange) {
    return [
      {
        primary_category: 'Electronics',
        frequency: 350,
        avg_confidence: 0.88,
        provider: 'gemini',
        percentage: 35.0
      },
      {
        primary_category: 'Clothing',
        frequency: 250,
        avg_confidence: 0.82,
        provider: 'claude',
        percentage: 25.0
      }
    ];
  }

  private getInterval(dateRange: DateRange): string {
    const days = (dateRange.end.getTime() - dateRange.start.getTime()) / (1000 * 60 * 60 * 24);
    if (days <= 7) return '1h';
    if (days <= 30) return '1d';
    if (days <= 90) return '1w';
    return '1M';
  }

  private getAggregationType(metric: string): string {
    const aggregations: Record<string, string> = {
      'cost': 'sum',
      'latency': 'avg',
      'confidence': 'avg',
      'count': 'value_count'
    };
    return aggregations[metric] || 'avg';
  }

  private getMetricField(metric: string): string {
    const fields: Record<string, string> = {
      'cost': 'cost_usd',
      'latency': 'latency_ms',
      'confidence': 'confidence',
      'count': 'request_id'
    };
    return fields[metric] || metric;
  }

  private formatTimeSeriesResponse(result: any) {
    const buckets = result.body?.aggregations?.timeline?.buckets || [];
    return buckets.map((bucket: any) => ({
      timestamp: bucket.key_as_string || new Date(bucket.key).toISOString(),
      value: bucket.metric_value?.value || 0
    }));
  }

  // Mock data methods for when OpenSearch is not available
  private getMockTimeSeriesData(metric: string, dateRange: DateRange) {
    const data = [];
    const days = Math.ceil((dateRange.end.getTime() - dateRange.start.getTime()) / (1000 * 60 * 60 * 24));
    for (let i = 0; i < Math.min(days, 30); i++) {
      const date = new Date(dateRange.start);
      date.setDate(date.getDate() + i);
      data.push({
        timestamp: date.toISOString(),
        value: Math.random() * 100
      });
    }
    return data;
  }
}

export const analyticsService = new AnalyticsService();
