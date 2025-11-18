import React from 'react';
import { Card } from './Card';
import { clsx } from 'clsx';

interface StatCardProps {
  title: string;
  value: string | number;
  change?: {
    value: number;
    trend: 'up' | 'down' | 'neutral';
  };
  icon?: React.ReactNode;
  className?: string;
}

export const StatCard: React.FC<StatCardProps> = ({
  title,
  value,
  change,
  icon,
  className,
}) => {
  return (
    <Card className={className}>
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
            {title}
          </p>
          <p className="mt-2 text-3xl font-bold text-gray-900 dark:text-white">
            {value}
          </p>
          {change && (
            <div className="mt-2 flex items-center text-sm">
              <span className={clsx(
                'font-medium',
                change.trend === 'up' && 'text-green-600 dark:text-green-400',
                change.trend === 'down' && 'text-red-600 dark:text-red-400',
                change.trend === 'neutral' && 'text-gray-600 dark:text-gray-400'
              )}>
                {change.trend === 'up' && '↑'}
                {change.trend === 'down' && '↓'}
                {change.trend === 'neutral' && '↔'}
                {' '}
                {Math.abs(change.value)}%
              </span>
            </div>
          )}
        </div>
        {icon && (
          <div className="p-3 bg-primary-50 dark:bg-primary-900/20 rounded-lg">
            {icon}
          </div>
        )}
      </div>
    </Card>
  );
};
