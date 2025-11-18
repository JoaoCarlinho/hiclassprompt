/**
 * API Client for AI Ops Prompt IDE
 * Handles all HTTP requests to the backend API
 */

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

export class APIError extends Error {
  constructor(
    message: string,
    public status: number,
    public code?: string,
    public details?: any
  ) {
    super(message);
    this.name = 'APIError';
  }
}

interface RequestOptions extends RequestInit {
  timeout?: number;
}

/**
 * Base fetch wrapper with error handling and timeout
 */
async function fetchWithTimeout(
  url: string,
  options: RequestOptions = {}
): Promise<Response> {
  const { timeout = 30000, ...fetchOptions } = options;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, {
      ...fetchOptions,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      let errorData;
      try {
        errorData = await response.json();
      } catch {
        errorData = { message: response.statusText };
      }

      throw new APIError(
        errorData.message || 'Request failed',
        response.status,
        errorData.code,
        errorData.details
      );
    }

    return response;
  } catch (error) {
    clearTimeout(timeoutId);

    if (error instanceof APIError) {
      throw error;
    }

    if (error.name === 'AbortError') {
      throw new APIError('Request timeout', 408, 'TIMEOUT');
    }

    throw new APIError(
      error.message || 'Network error',
      0,
      'NETWORK_ERROR'
    );
  }
}

/**
 * API Client Class
 */
export class APIClient {
  private baseURL: string;

  constructor(baseURL: string = API_BASE_URL) {
    this.baseURL = baseURL;
  }

  /**
   * Classification API
   */
  async classifyImage(
    imageFile: File,
    options?: {
      provider?: string;
      model?: string;
      title?: string;
      description?: string;
    }
  ): Promise<any> {
    const formData = new FormData();
    formData.append('image', imageFile);

    if (options?.provider) formData.append('provider', options.provider);
    if (options?.model) formData.append('model', options.model);
    if (options?.title) formData.append('title', options.title);
    if (options?.description) formData.append('description', options.description);

    const response = await fetchWithTimeout(`${this.baseURL}/classify`, {
      method: 'POST',
      body: formData,
    });

    return response.json();
  }

  async classifyImageByURL(
    imageURL: string,
    options?: {
      provider?: string;
      model?: string;
      title?: string;
      description?: string;
    }
  ): Promise<any> {
    const response = await fetchWithTimeout(`${this.baseURL}/classify`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        imageURL,
        ...options,
      }),
    });

    return response.json();
  }

  /**
   * Provider Comparison API
   */
  async compareProviders(
    imageFile: File,
    providers?: string[]
  ): Promise<any> {
    const formData = new FormData();
    formData.append('image', imageFile);

    if (providers && providers.length > 0) {
      formData.append('providers', providers.join(','));
    }

    const response = await fetchWithTimeout(`${this.baseURL}/compare`, {
      method: 'POST',
      body: formData,
      timeout: 60000, // Longer timeout for multiple providers
    });

    return response.json();
  }

  /**
   * Batch Processing API
   */
  async createBatchSession(
    input: {
      type: 'directory' | 'csv' | 'json' | 'urls';
      data: any;
    },
    config: {
      provider: string;
      model?: string;
      concurrency?: number;
      retryAttempts?: number;
      skipDuplicates?: boolean;
    }
  ): Promise<{ sessionId: string }> {
    const response = await fetchWithTimeout(`${this.baseURL}/batch`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        input,
        config,
      }),
    });

    return response.json();
  }

  async getBatchSession(sessionId: string): Promise<any> {
    const response = await fetchWithTimeout(
      `${this.baseURL}/batch/${sessionId}`
    );

    return response.json();
  }

  async pauseBatchSession(sessionId: string): Promise<void> {
    await fetchWithTimeout(`${this.baseURL}/batch/${sessionId}/pause`, {
      method: 'POST',
    });
  }

  async resumeBatchSession(sessionId: string): Promise<void> {
    await fetchWithTimeout(`${this.baseURL}/batch/${sessionId}/resume`, {
      method: 'POST',
    });
  }

  async stopBatchSession(sessionId: string): Promise<void> {
    await fetchWithTimeout(`${this.baseURL}/batch/${sessionId}/stop`, {
      method: 'POST',
    });
  }

  /**
   * Cost Analytics API
   */
  async getCostStats(timeRange?: string): Promise<any> {
    const url = new URL(`${this.baseURL}/costs/stats`);
    if (timeRange) {
      url.searchParams.append('range', timeRange);
    }

    const response = await fetchWithTimeout(url.toString());
    return response.json();
  }

  async getBudgetStatus(): Promise<any> {
    const response = await fetchWithTimeout(`${this.baseURL}/costs/budget`);
    return response.json();
  }

  async exportCosts(format: 'csv' | 'json' | 'excel', options?: any): Promise<Blob> {
    const response = await fetchWithTimeout(`${this.baseURL}/costs/export`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ format, ...options }),
    });

    return response.blob();
  }

  /**
   * Dashboard API
   */
  async getDashboardStats(): Promise<any> {
    const response = await fetchWithTimeout(`${this.baseURL}/dashboard/stats`);
    return response.json();
  }

  async getRecentActivity(limit: number = 10): Promise<any> {
    const response = await fetchWithTimeout(
      `${this.baseURL}/dashboard/recent?limit=${limit}`
    );
    return response.json();
  }

  async getActiveBatches(): Promise<any> {
    const response = await fetchWithTimeout(`${this.baseURL}/dashboard/batches`);
    return response.json();
  }

  /**
   * Providers API
   */
  async getProviders(): Promise<any> {
    const response = await fetchWithTimeout(`${this.baseURL}/providers`);
    return response.json();
  }

  async testProvider(providerId: string): Promise<any> {
    const response = await fetchWithTimeout(
      `${this.baseURL}/providers/${providerId}/test`,
      { method: 'POST' }
    );
    return response.json();
  }

  async updateProviderConfig(providerId: string, config: any): Promise<any> {
    const response = await fetchWithTimeout(
      `${this.baseURL}/providers/${providerId}`,
      {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(config),
      }
    );
    return response.json();
  }

  /**
   * Settings API
   */
  async getSettings(): Promise<any> {
    const response = await fetchWithTimeout(`${this.baseURL}/settings`);
    return response.json();
  }

  async updateSettings(settings: any): Promise<any> {
    const response = await fetchWithTimeout(`${this.baseURL}/settings`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(settings),
    });
    return response.json();
  }
}

// Export singleton instance
export const apiClient = new APIClient();
