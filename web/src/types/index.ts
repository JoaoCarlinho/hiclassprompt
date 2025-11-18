// Core Types
export interface ClassificationResult {
  id: string;
  imagePath: string;
  classification: {
    category: string;
    confidence: number;
    reasoning: string;
  };
  provider: string;
  model: string;
  metrics: {
    latencyMs: number;
    tokensInput: number;
    tokensOutput: number;
    costUsd: number;
  };
  timestamp: string;
  status: 'success' | 'failed' | 'pending';
  error?: {
    code: string;
    message: string;
  };
}

export interface BatchSession {
  sessionId: string;
  startTime: string;
  endTime?: string;
  totalItems: number;
  completedItems: number;
  successfulItems: number;
  failedItems: number;
  skippedItems: number;
  status: 'running' | 'paused' | 'completed' | 'failed';
  provider: string;
  outputPath: string;
}

export interface Provider {
  id: string;
  name: string;
  model: string;
  status: 'connected' | 'disconnected' | 'error';
  rateLimit: number;
  pricing: {
    input: number;
    output: number;
  };
  enabled: boolean;
}

export interface CostStats {
  totalRequests: number;
  totalCostUsd: number;
  averageCostPerRequest: number;
  totalTokens: number;
  sessionDuration: number;
  byProvider: Record<string, {
    requests: number;
    costUsd: number;
    averageCostPerRequest: number;
    averageLatencyMs: number;
  }>;
}

export interface BudgetLimits {
  dailyLimit: number;
  weeklyLimit: number;
  monthlyLimit: number;
  perRequestLimit: number;
  providerLimits: Record<string, number>;
}

export interface BudgetStatus {
  daily: {
    used: number;
    limit: number;
    percentage: number;
  };
  weekly: {
    used: number;
    limit: number;
    percentage: number;
  };
  monthly: {
    used: number;
    limit: number;
    percentage: number;
  };
}

export interface ComparisonResult {
  imageId: string;
  imagePath: string;
  timestamp: string;
  consensus?: string;
  agreement: number;
  results: Array<{
    provider: string;
    model: string;
    category: string;
    confidence: number;
    reasoning: string;
    latencyMs: number;
    costUsd: number;
    tokens: number;
  }>;
  summary: {
    providersTest: number;
    successful: number;
    averageLatency: number;
    totalCost: number;
  };
}

export interface CategoryDistribution {
  category: string;
  count: number;
  percentage: number;
  averageConfidence: number;
}

export interface DashboardStats {
  last24Hours: {
    totalImages: number;
    successRate: number;
    totalCost: number;
    averageLatency: number;
  };
  activeBatches: BatchSession[];
  recentActivity: ClassificationResult[];
  categoryDistribution: CategoryDistribution[];
  providerPerformance: Array<{
    provider: string;
    successRate: number;
    averageLatency: number;
  }>;
}
