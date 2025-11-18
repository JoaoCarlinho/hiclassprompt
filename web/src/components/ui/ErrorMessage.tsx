import React from 'react';
import { AlertCircle, XCircle } from 'lucide-react';
import { Card } from './Card';
import { Button } from './Button';

interface ErrorMessageProps {
  error: Error | null;
  onRetry?: () => void;
  variant?: 'inline' | 'card' | 'overlay';
}

export const ErrorMessage: React.FC<ErrorMessageProps> = ({
  error,
  onRetry,
  variant = 'inline',
}) => {
  if (!error) return null;

  const errorContent = (
    <>
      <div className="flex items-start gap-3">
        <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
        <div className="flex-1">
          <h4 className="text-sm font-medium text-red-800 dark:text-red-200">
            Error
          </h4>
          <p className="mt-1 text-sm text-red-700 dark:text-red-300">
            {error.message || 'An unexpected error occurred'}
          </p>
          {onRetry && (
            <Button
              variant="outline"
              size="sm"
              onClick={onRetry}
              className="mt-3"
            >
              Try Again
            </Button>
          )}
        </div>
      </div>
    </>
  );

  if (variant === 'card') {
    return (
      <Card className="bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800">
        {errorContent}
      </Card>
    );
  }

  if (variant === 'overlay') {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-md w-full mx-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              Error Occurred
            </h3>
            <button
              onClick={() => window.location.reload()}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            >
              <XCircle className="h-5 w-5" />
            </button>
          </div>
          {errorContent}
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-lg bg-red-50 dark:bg-red-900/20 p-4 border border-red-200 dark:border-red-800">
      {errorContent}
    </div>
  );
};
