import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';

interface PromptVersion {
  id: number;
  promptId: string;
  versionNumber: number;
  content: string;
  createdBy: string;
  createdAt: string;
  commitMessage?: string;
  tags: string[];
  isPublished: boolean;
}

export function usePromptVersions(promptId: string) {
  const [data, setData] = useState<PromptVersion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const { getAccessToken } = useAuth();

  const refetch = async () => {
    try {
      setLoading(true);
      const token = await getAccessToken();
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/prompts/${promptId}/versions`,
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
      setError(null);
    } catch (err) {
      setError(err as Error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (promptId) {
      refetch();
    }
  }, [promptId]);

  return { data, loading, error, refetch };
}

export function useCompareVersions(versionId1?: number, versionId2?: number) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const { getAccessToken } = useAuth();

  useEffect(() => {
    if (!versionId1 || !versionId2) return;

    const fetchComparison = async () => {
      try {
        setLoading(true);
        const token = await getAccessToken();
        const response = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL}/api/prompts/versions/compare/${versionId1}/${versionId2}`,
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
        setError(null);
      } catch (err) {
        setError(err as Error);
      } finally {
        setLoading(false);
      }
    };

    fetchComparison();
  }, [versionId1, versionId2, getAccessToken]);

  return { data, loading, error };
}

export function useCreateVersion() {
  const [loading, setLoading] = useState(false);
  const { getAccessToken } = useAuth();

  const mutate = async (params: {
    promptId: string;
    content: string;
    commitMessage: string;
    tags?: string[];
    metadata?: Record<string, any>;
  }) => {
    try {
      setLoading(true);
      const token = await getAccessToken();
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/prompts/${params.promptId}/versions`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            content: params.content,
            commitMessage: params.commitMessage,
            tags: params.tags,
            metadata: params.metadata
          })
        }
      );
      const result = await response.json();
      return result.data;
    } finally {
      setLoading(false);
    }
  };

  return { mutate, loading };
}

export function useRollbackVersion() {
  const [loading, setLoading] = useState(false);
  const { getAccessToken } = useAuth();

  const mutate = async (params: {
    promptId: string;
    versionId: number;
    commitMessage: string;
  }) => {
    try {
      setLoading(true);
      const token = await getAccessToken();
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/prompts/${params.promptId}/rollback/${params.versionId}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ commitMessage: params.commitMessage })
        }
      );
      const result = await response.json();
      return result.data;
    } finally {
      setLoading(false);
    }
  };

  return { mutate, loading };
}
