'use client';

import React, { useState } from 'react';
import { Layout } from '@/components/layout/Layout';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { Badge } from '@/components/ui/Badge';
import { ErrorMessage } from '@/components/ui/ErrorMessage';
import { Upload, Play, Pause, Square } from 'lucide-react';
import { useCreateBatch, useBatchControls, useProviders, useBudgetStatus } from '@/hooks/useAPI';
import { useBatchProgress } from '@/hooks/useWebSocket';
import { Provider } from '@/types';

export default function BatchPage() {
  const [inputType, setInputType] = useState<'directory' | 'csv' | 'urls'>('directory');
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [provider, setProvider] = useState<string>('gemini');
  const [model, setModel] = useState<string>('gemini-2.0-flash-exp');
  const [concurrency, setConcurrency] = useState<number>(10);
  const [sessionId, setSessionId] = useState<string | null>(null);

  const { data: providers } = useProviders();
  const { data: budgetStatus } = useBudgetStatus();
  const { createBatch, loading: creating, error: createError } = useCreateBatch();
  const { pauseBatch, resumeBatch, stopBatch } = useBatchControls(sessionId || '');
  const progress = useBatchProgress(sessionId);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setSelectedFiles(Array.from(e.target.files));
    }
  };

  const handleStartBatch = async () => {
    if (selectedFiles.length === 0) return;

    try {
      const result = await createBatch(
        { type: inputType, data: selectedFiles },
        { provider, model, concurrency }
      );
      if (result?.sessionId) {
        setSessionId(result.sessionId);
      }
    } catch (error) {
      console.error('Failed to start batch:', error);
    }
  };

  return (
    <Layout>
      <div className="max-w-6xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            Batch Processing
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Process multiple images in parallel with intelligent concurrency
          </p>
        </div>

        {/* Configuration */}
        <Card>
          <CardHeader>
            <CardTitle>Configure Batch</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              {/* Input Source */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                  Input Source
                </label>
                <div className="flex gap-4 mb-4">
                  <label className="flex items-center">
                    <input type="radio" name="inputType" value="directory" defaultChecked className="mr-2" />
                    <span className="text-sm">Upload directory</span>
                  </label>
                  <label className="flex items-center">
                    <input type="radio" name="inputType" value="csv" className="mr-2" />
                    <span className="text-sm">CSV file</span>
                  </label>
                  <label className="flex items-center">
                    <input type="radio" name="inputType" value="urls" className="mr-2" />
                    <span className="text-sm">Image URLs</span>
                  </label>
                </div>

                <div className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-8 text-center">
                  <Upload className="h-8 w-8 mx-auto text-gray-400 mb-2" />
                  <p className="text-sm text-gray-600 dark:text-gray-300 mb-1">
                    Drop folder here or <button className="text-primary-600 hover:text-primary-700">Browse Files</button>
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Selected: /auction-images/ (1,247 images)
                  </p>
                  <div className="mt-2 flex justify-center gap-4 text-xs text-gray-500">
                    <span>✓ JPEG: 892</span>
                    <span>✓ PNG: 285</span>
                    <span>✓ WebP: 70</span>
                  </div>
                </div>
              </div>

              {/* Settings */}
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Provider
                  </label>
                  <select className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800">
                    <option>Gemini</option>
                    <option>Claude</option>
                    <option>OpenAI</option>
                    <option>Bedrock</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Model
                  </label>
                  <select className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800">
                    <option>gemini-2.0-flash-exp</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Concurrency
                  </label>
                  <select className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800">
                    <option>10 simultaneous requests</option>
                    <option>6 simultaneous requests</option>
                    <option>15 simultaneous requests</option>
                  </select>
                </div>
              </div>

              {/* Options */}
              <div className="space-y-2">
                <label className="flex items-center">
                  <input type="checkbox" defaultChecked className="mr-2" />
                  <span className="text-sm text-gray-700 dark:text-gray-300">Enable retry logic (3 attempts)</span>
                </label>
                <label className="flex items-center">
                  <input type="checkbox" defaultChecked className="mr-2" />
                  <span className="text-sm text-gray-700 dark:text-gray-300">Skip duplicates (image hash detection)</span>
                </label>
                <label className="flex items-center">
                  <input type="checkbox" defaultChecked className="mr-2" />
                  <span className="text-sm text-gray-700 dark:text-gray-300">Auto-resume on interruption</span>
                </label>
              </div>

              {/* Cost Estimate */}
              <Card className="bg-gray-50 dark:bg-gray-900 border-gray-300 dark:border-gray-600">
                <CardContent className="pt-4">
                  <h4 className="font-medium text-gray-900 dark:text-white mb-3">Cost Estimate</h4>
                  <dl className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <dt className="text-gray-600 dark:text-gray-400">Images</dt>
                      <dd className="font-medium">1,247</dd>
                    </div>
                    <div>
                      <dt className="text-gray-600 dark:text-gray-400">Cost/image</dt>
                      <dd className="font-medium">$0.000075</dd>
                    </div>
                    <div>
                      <dt className="text-gray-600 dark:text-gray-400">Total cost</dt>
                      <dd className="font-medium">$0.093</dd>
                    </div>
                    <div>
                      <dt className="text-gray-600 dark:text-gray-400">Est. time</dt>
                      <dd className="font-medium">~2 minutes</dd>
                    </div>
                  </dl>
                  <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
                    <Badge variant="success" size="sm">
                      ✓ Within daily limit ($0.09 / $10.00)
                    </Badge>
                  </div>
                </CardContent>
              </Card>

              <Button size="lg" className="w-full" onClick={handleStartBatch}>
                <Play className="h-4 w-4 mr-2" />
                Start Batch Processing
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Processing Status */}
        {sessionId && progress && (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Processing: Auction-2025-01-10</CardTitle>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                    Session: batch-20250110-120000-abc123
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm">
                    <Pause className="h-4 w-4" />
                  </Button>
                  <Button variant="outline" size="sm">
                    <Square className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <ProgressBar value={1060} max={1247} variant="success" />

                <div className="grid grid-cols-4 gap-4">
                  <Card className="bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800">
                    <CardContent className="pt-4">
                      <div className="text-xs text-green-600 dark:text-green-400">Successful</div>
                      <div className="text-2xl font-bold text-green-700 dark:text-green-300">1,042</div>
                      <div className="text-xs text-green-600 dark:text-green-400">98.3%</div>
                    </CardContent>
                  </Card>
                  <Card className="bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800">
                    <CardContent className="pt-4">
                      <div className="text-xs text-red-600 dark:text-red-400">Failed</div>
                      <div className="text-2xl font-bold text-red-700 dark:text-red-300">18</div>
                      <div className="text-xs text-red-600 dark:text-red-400">1.7%</div>
                    </CardContent>
                  </Card>
                  <Card className="bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800">
                    <CardContent className="pt-4">
                      <div className="text-xs text-blue-600 dark:text-blue-400">ETA</div>
                      <div className="text-2xl font-bold text-blue-700 dark:text-blue-300">22s</div>
                      <div className="text-xs text-blue-600 dark:text-blue-400">remaining</div>
                    </CardContent>
                  </Card>
                  <Card className="bg-purple-50 dark:bg-purple-900/20 border-purple-200 dark:border-purple-800">
                    <CardContent className="pt-4">
                      <div className="text-xs text-purple-600 dark:text-purple-400">Rate</div>
                      <div className="text-2xl font-bold text-purple-700 dark:text-purple-300">8.5</div>
                      <div className="text-xs text-purple-600 dark:text-purple-400">img/s</div>
                    </CardContent>
                  </Card>
                </div>

                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <strong>Live Stats:</strong>
                    <ul className="mt-1 text-gray-600 dark:text-gray-400 space-y-1">
                      <li>• Active requests: 10</li>
                      <li>• Queue depth: 187</li>
                      <li>• Current cost: $0.078</li>
                      <li>• Memory: 512 MB / 2048 MB (25%)</li>
                    </ul>
                  </div>
                  <div>
                    <strong>Recent completions:</strong>
                    <ul className="mt-1 text-gray-600 dark:text-gray-400 space-y-1">
                      <li>✓ img_1058.jpg → Jewelry (97.2%)</li>
                      <li>✓ img_1059.jpg → Antiques (95.8%)</li>
                      <li>✓ img_1060.jpg → Electronics (96.3%)</li>
                    </ul>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </Layout>
  );
}
