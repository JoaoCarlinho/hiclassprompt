'use client';

import React, { useState } from 'react';
import { Layout } from '@/components/layout/Layout';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { ErrorMessage } from '@/components/ui/ErrorMessage';
import { Upload, Link as LinkIcon, Loader2 } from 'lucide-react';
import { useClassify, useProviders } from '@/hooks/useAPI';
import { ClassificationResult, Provider } from '@/types';

export default function ClassifyPage() {
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string>('');
  const [imageUrl, setImageUrl] = useState<string>('');
  const [provider, setProvider] = useState<string>('auto');
  const [title, setTitle] = useState<string>('');
  const [description, setDescription] = useState<string>('');
  const [result, setResult] = useState<ClassificationResult | null>(null);

  const { data: providers } = useProviders();
  const { classify, loading: isProcessing, error: classifyError } = useClassify();

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedImage(file);
      setImageUrl('');
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
      setResult(null);
    }
  };

  const handleUrlLoad = async () => {
    if (!imageUrl) return;
    setSelectedImage(null);
    setImagePreview(imageUrl);
    setResult(null);
  };

  const handleClassify = async () => {
    try {
      let classificationResult;

      if (selectedImage) {
        classificationResult = await classify(selectedImage, {
          provider: provider === 'auto' ? undefined : provider,
          title: title || undefined,
          description: description || undefined,
        });
      } else if (imageUrl) {
        classificationResult = await classify(imageUrl, {
          provider: provider === 'auto' ? undefined : provider,
          title: title || undefined,
          description: description || undefined,
        });
      }

      if (classificationResult) {
        setResult(classificationResult);
      }
    } catch (error) {
      console.error('Classification failed:', error);
    }
  };

  const handleReset = () => {
    setSelectedImage(null);
    setImagePreview('');
    setImageUrl('');
    setResult(null);
    setTitle('');
    setDescription('');
  };

  return (
    <Layout>
      <div className="max-w-5xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            Classify Image
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Upload an image or provide URL for AI-powered classification
          </p>
        </div>

        {/* Upload Section */}
        <Card>
          <CardHeader>
            <CardTitle>Upload Image</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {/* Drop Zone */}
              <div className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-12 text-center">
                <input
                  type="file"
                  id="image-upload"
                  accept="image/*"
                  onChange={handleImageUpload}
                  className="hidden"
                />
                <label htmlFor="image-upload" className="cursor-pointer">
                  <Upload className="h-12 w-12 mx-auto text-gray-400 mb-4" />
                  <p className="text-base text-gray-600 dark:text-gray-300 mb-2">
                    Drag & drop image here or click to browse
                  </p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Supported: JPG, PNG, WebP, GIF (max 10MB)
                  </p>
                </label>
              </div>

              {/* Or URL */}
              <div className="flex items-center gap-2">
                <div className="flex-1 relative">
                  <LinkIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <input
                    type="url"
                    placeholder="Or paste image URL..."
                    value={imageUrl}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setImageUrl(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                  />
                </div>
                <Button variant="outline" onClick={handleUrlLoad}>Load</Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Configuration */}
        <Card>
          <CardHeader>
            <CardTitle>Classification Options</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Provider
                </label>
                <div className="flex gap-4">
                  <label className="flex items-center">
                    <input
                      type="radio"
                      name="provider"
                      value="auto"
                      checked={provider === 'auto'}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => setProvider(e.target.value)}
                      className="mr-2"
                    />
                    <span className="text-sm">Auto-select cheapest</span>
                  </label>
                  {providers && providers.map((p: Provider) => (
                    <label key={p.id} className="flex items-center">
                      <input
                        type="radio"
                        name="provider"
                        value={p.id}
                        checked={provider === p.id}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setProvider(e.target.value)}
                        className="mr-2"
                      />
                      <span className="text-sm">{p.name}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Title (optional)
                  </label>
                  <input
                    type="text"
                    value={title}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setTitle(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Description (optional)
                  </label>
                  <input
                    type="text"
                    value={description}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setDescription(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between pt-4 border-t border-gray-200 dark:border-gray-700">
                <div className="text-sm text-gray-600 dark:text-gray-400">
                  Estimated cost: $0.000075 | Estimated time: &lt;2s
                </div>
                <Button
                  onClick={handleClassify}
                  disabled={!selectedImage || isProcessing}
                  loading={isProcessing}
                >
                  {isProcessing ? 'Classifying...' : 'Classify Image'}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Result */}
        {result && (
          <div className="grid grid-cols-3 gap-6">
            {/* Image Preview */}
            <Card>
              {imagePreview && (
                <img src={imagePreview} alt="Preview" className="w-full rounded-lg" />
              )}
            </Card>

            {/* Result Details */}
            <Card className="col-span-2">
              <CardContent className="pt-6">
                <div className="flex items-center gap-2 mb-4">
                  <Badge variant="success">✓ Classification Complete</Badge>
                </div>

                <div className="space-y-4">
                  <div>
                    <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                      {result.category}
                    </h3>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-gray-600 dark:text-gray-400">Confidence:</span>
                      <Badge variant="success">{result.confidence}% (High)</Badge>
                    </div>
                    <div className="mt-2 w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                      <div
                        className="bg-green-600 h-2 rounded-full"
                        style={{ width: `${result.confidence}%` }}
                      />
                    </div>
                  </div>

                  <div>
                    <h4 className="font-medium text-gray-900 dark:text-white mb-2">Reasoning</h4>
                    <p className="text-sm text-gray-600 dark:text-gray-300 bg-gray-50 dark:bg-gray-900 p-3 rounded">
                      {result.reasoning}
                    </p>
                  </div>

                  <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
                    <h4 className="font-medium text-gray-900 dark:text-white mb-3">Performance Metrics</h4>
                    <dl className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <dt className="text-gray-600 dark:text-gray-400">Provider</dt>
                        <dd className="font-medium text-gray-900 dark:text-white">{result.provider}</dd>
                      </div>
                      <div>
                        <dt className="text-gray-600 dark:text-gray-400">Model</dt>
                        <dd className="font-medium text-gray-900 dark:text-white">{result.model}</dd>
                      </div>
                      <div>
                        <dt className="text-gray-600 dark:text-gray-400">Latency</dt>
                        <dd className="font-medium text-gray-900 dark:text-white">{result.latency}ms</dd>
                      </div>
                      <div>
                        <dt className="text-gray-600 dark:text-gray-400">Cost</dt>
                        <dd className="font-medium text-gray-900 dark:text-white">${result.cost}</dd>
                      </div>
                    </dl>
                  </div>

                  <div className="flex gap-3 pt-4">
                    <Button variant="outline">Copy Result</Button>
                    <Button variant="outline">Save</Button>
                    <Button variant="ghost">Classify Another</Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </Layout>
  );
}
