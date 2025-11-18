'use client';

import React, { useState } from 'react';
import { useParams } from 'next/navigation';
import { Layout } from '@/components/layout/Layout';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import {
  usePromptVersions,
  useCompareVersions,
  useCreateVersion,
  useRollbackVersion
} from '@/hooks/usePromptVersions';

export default function PromptVersionsPage() {
  const params = useParams();
  const promptId = params?.promptId as string;
  const { data: versions, loading, refetch } = usePromptVersions(promptId);
  const { mutate: createVersion, loading: creating } = useCreateVersion();
  const { mutate: rollbackVersion, loading: rollingBack } = useRollbackVersion();

  const [selectedVersion1, setSelectedVersion1] = useState<number | undefined>();
  const [selectedVersion2, setSelectedVersion2] = useState<number | undefined>();
  const [showNewVersion, setShowNewVersion] = useState(false);
  const [newContent, setNewContent] = useState('');
  const [commitMessage, setCommitMessage] = useState('');

  const { data: comparison } = useCompareVersions(selectedVersion1, selectedVersion2);

  const handleCreateVersion = async () => {
    try {
      await createVersion({
        promptId,
        content: newContent,
        commitMessage,
        tags: ['manual']
      });
      setShowNewVersion(false);
      setNewContent('');
      setCommitMessage('');
      refetch();
    } catch (error) {
      console.error('Failed to create version:', error);
    }
  };

  const handleRollback = async (versionId: number) => {
    if (!confirm('Are you sure you want to rollback to this version?')) return;

    try {
      await rollbackVersion({
        promptId,
        versionId,
        commitMessage: 'Rollback from UI'
      });
      refetch();
    } catch (error) {
      console.error('Failed to rollback:', error);
    }
  };

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <LoadingSpinner size="lg" />
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="max-w-7xl mx-auto space-y-6 p-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
              Prompt Version History
            </h1>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              ID: {promptId}
            </p>
          </div>
          <Button onClick={() => setShowNewVersion(true)}>
            Create New Version
          </Button>
        </div>

        {showNewVersion && (
          <Card className="p-6">
            <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-white">
              Create New Version
            </h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
                  Commit Message
                </label>
                <input
                  type="text"
                  value={commitMessage}
                  onChange={(e) => setCommitMessage(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg dark:bg-gray-800 dark:border-gray-600 dark:text-white"
                  placeholder="Describe your changes..."
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
                  Prompt Content
                </label>
                <textarea
                  value={newContent}
                  onChange={(e) => setNewContent(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg dark:bg-gray-800 dark:border-gray-600 dark:text-white"
                  rows={10}
                  placeholder="Enter your prompt content..."
                />
              </div>
              <div className="flex gap-2">
                <Button onClick={handleCreateVersion} disabled={creating || !commitMessage || !newContent}>
                  {creating ? 'Creating...' : 'Create Version'}
                </Button>
                <Button
                  onClick={() => setShowNewVersion(false)}
                  className="bg-gray-500 hover:bg-gray-600"
                >
                  Cancel
                </Button>
              </div>
            </div>
          </Card>
        )}

        <Card className="p-6">
          <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-white">
            Version History
          </h2>
          <div className="space-y-4">
            {versions.map((version) => (
              <div
                key={version.id}
                className="border border-gray-200 dark:border-gray-700 rounded-lg p-4"
              >
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="flex items-center gap-3">
                      <span className="text-lg font-semibold text-gray-900 dark:text-white">
                        Version {version.versionNumber}
                      </span>
                      {version.tags.map((tag) => (
                        <span
                          key={tag}
                          className="px-2 py-1 text-xs bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 rounded"
                        >
                          {tag}
                        </span>
                      ))}
                      {version.isPublished && (
                        <span className="px-2 py-1 text-xs bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 rounded">
                          Published
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                      {version.commitMessage || 'No commit message'}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                      By {version.createdBy} on {new Date(version.createdAt).toLocaleString()}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      onClick={() => handleRollback(version.id)}
                      className="text-sm"
                      disabled={rollingBack}
                    >
                      Rollback
                    </Button>
                    <input
                      type="checkbox"
                      checked={selectedVersion1 === version.id}
                      onChange={() => setSelectedVersion1(
                        selectedVersion1 === version.id ? undefined : version.id
                      )}
                      className="w-5 h-5"
                    />
                  </div>
                </div>
                <div className="mt-3 p-3 bg-gray-50 dark:bg-gray-800 rounded text-sm font-mono whitespace-pre-wrap">
                  {version.content.substring(0, 200)}
                  {version.content.length > 200 && '...'}
                </div>
              </div>
            ))}
          </div>
        </Card>

        {comparison && (
          <Card className="p-6">
            <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-white">
              Version Comparison
            </h2>
            <pre className="p-4 bg-gray-50 dark:bg-gray-800 rounded text-sm overflow-auto">
              {comparison.patch}
            </pre>
          </Card>
        )}
      </div>
    </Layout>
  );
}
