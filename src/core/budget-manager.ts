/**
 * Budget Management System
 * Cost limits, alerts, provider cost caps, spend tracking
 */

import { logger } from '../utils/logger';
import type { AIProvider } from '../types';
import { CostTracker } from './cost-tracker';

/**
 * Budget limit configuration
 */
export interface BudgetLimit {
  dailyLimit?: number;
  weeklyLimit?: number;
  monthlyLimit?: number;
  perRequestLimit?: number;
  providerLimits?: Partial<Record<AIProvider, number>>;
}

/**
 * Budget alert
 */
export interface BudgetAlert {
  type: 'warning' | 'exceeded';
  level: 'daily' | 'weekly' | 'monthly' | 'per-request' | 'provider';
  provider?: AIProvider;
  currentSpend: number;
  limit: number;
  percentage: number;
  timestamp: Date;
  message: string;
}

/**
 * Budget status
 */
export interface BudgetStatus {
  daily: {
    spent: number;
    limit?: number;
    remaining?: number;
    percentage?: number;
  };
  weekly: {
    spent: number;
    limit?: number;
    remaining?: number;
    percentage?: number;
  };
  monthly: {
    spent: number;
    limit?: number;
    remaining?: number;
    percentage?: number;
  };
  byProvider: Map<AIProvider, { spent: number; limit?: number; remaining?: number }>;
  alerts: BudgetAlert[];
}

/**
 * Budget manager
 */
export class BudgetManager {
  private limits: BudgetLimit;
  private costTracker: CostTracker;
  private alerts: BudgetAlert[] = [];
  private warningThreshold: number = 80; // Alert at 80% of limit
  private startOfDay: Date;
  private startOfWeek: Date;
  private startOfMonth: Date;

  constructor(limits: BudgetLimit, costTracker: CostTracker) {
    this.limits = limits;
    this.costTracker = costTracker;

    // Initialize time periods
    const now = new Date();
    this.startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    this.startOfWeek = new Date(now);
    this.startOfWeek.setDate(now.getDate() - now.getDay());
    this.startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  }

  /**
   * Check if a request would exceed budget
   * @param provider - AI provider
   * @param estimatedCost - Estimated cost of request
   * @returns True if within budget
   */
  canAfford(provider: AIProvider, estimatedCost: number): boolean {
    const status = this.getStatus();

    // Check per-request limit
    if (this.limits.perRequestLimit && estimatedCost > this.limits.perRequestLimit) {
      this.addAlert({
        type: 'exceeded',
        level: 'per-request',
        currentSpend: estimatedCost,
        limit: this.limits.perRequestLimit,
        percentage: (estimatedCost / this.limits.perRequestLimit) * 100,
        timestamp: new Date(),
        message: `Request cost $${estimatedCost.toFixed(6)} exceeds per-request limit of $${this.limits.perRequestLimit}`,
      });
      return false;
    }

    // Check daily limit
    if (this.limits.dailyLimit) {
      const newDaily = status.daily.spent + estimatedCost;
      if (newDaily > this.limits.dailyLimit) {
        this.addAlert({
          type: 'exceeded',
          level: 'daily',
          currentSpend: newDaily,
          limit: this.limits.dailyLimit,
          percentage: (newDaily / this.limits.dailyLimit) * 100,
          timestamp: new Date(),
          message: `Daily budget exceeded: $${newDaily.toFixed(2)} > $${this.limits.dailyLimit}`,
        });
        return false;
      }
    }

    // Check weekly limit
    if (this.limits.weeklyLimit) {
      const newWeekly = status.weekly.spent + estimatedCost;
      if (newWeekly > this.limits.weeklyLimit) {
        this.addAlert({
          type: 'exceeded',
          level: 'weekly',
          currentSpend: newWeekly,
          limit: this.limits.weeklyLimit,
          percentage: (newWeekly / this.limits.weeklyLimit) * 100,
          timestamp: new Date(),
          message: `Weekly budget exceeded: $${newWeekly.toFixed(2)} > $${this.limits.weeklyLimit}`,
        });
        return false;
      }
    }

    // Check monthly limit
    if (this.limits.monthlyLimit) {
      const newMonthly = status.monthly.spent + estimatedCost;
      if (newMonthly > this.limits.monthlyLimit) {
        this.addAlert({
          type: 'exceeded',
          level: 'monthly',
          currentSpend: newMonthly,
          limit: this.limits.monthlyLimit,
          percentage: (newMonthly / this.limits.monthlyLimit) * 100,
          timestamp: new Date(),
          message: `Monthly budget exceeded: $${newMonthly.toFixed(2)} > $${this.limits.monthlyLimit}`,
        });
        return false;
      }
    }

    // Check provider-specific limit
    if (this.limits.providerLimits?.[provider]) {
      const providerSpent = status.byProvider.get(provider)?.spent || 0;
      const providerLimit = this.limits.providerLimits[provider];
      const newProviderSpent = providerSpent + estimatedCost;

      if (newProviderSpent > providerLimit) {
        this.addAlert({
          type: 'exceeded',
          level: 'provider',
          provider,
          currentSpend: newProviderSpent,
          limit: providerLimit,
          percentage: (newProviderSpent / providerLimit) * 100,
          timestamp: new Date(),
          message: `${provider} budget exceeded: $${newProviderSpent.toFixed(2)} > $${providerLimit}`,
        });
        return false;
      }
    }

    // Check for warnings
    this.checkWarnings(status, estimatedCost);

    return true;
  }

  /**
   * Check for budget warnings
   * @param status - Current budget status
   * @param estimatedCost - Estimated cost of next request
   */
  private checkWarnings(status: BudgetStatus, estimatedCost: number): void {
    // Check daily warning
    if (this.limits.dailyLimit) {
      const newDaily = status.daily.spent + estimatedCost;
      const percentage = (newDaily / this.limits.dailyLimit) * 100;
      if (percentage >= this.warningThreshold && percentage < 100) {
        this.addAlert({
          type: 'warning',
          level: 'daily',
          currentSpend: newDaily,
          limit: this.limits.dailyLimit,
          percentage,
          timestamp: new Date(),
          message: `Daily budget at ${percentage.toFixed(0)}%: $${newDaily.toFixed(2)} of $${this.limits.dailyLimit}`,
        });
      }
    }

    // Check weekly warning
    if (this.limits.weeklyLimit) {
      const newWeekly = status.weekly.spent + estimatedCost;
      const percentage = (newWeekly / this.limits.weeklyLimit) * 100;
      if (percentage >= this.warningThreshold && percentage < 100) {
        this.addAlert({
          type: 'warning',
          level: 'weekly',
          currentSpend: newWeekly,
          limit: this.limits.weeklyLimit,
          percentage,
          timestamp: new Date(),
          message: `Weekly budget at ${percentage.toFixed(0)}%: $${newWeekly.toFixed(2)} of $${this.limits.weeklyLimit}`,
        });
      }
    }

    // Check monthly warning
    if (this.limits.monthlyLimit) {
      const newMonthly = status.monthly.spent + estimatedCost;
      const percentage = (newMonthly / this.limits.monthlyLimit) * 100;
      if (percentage >= this.warningThreshold && percentage < 100) {
        this.addAlert({
          type: 'warning',
          level: 'monthly',
          currentSpend: newMonthly,
          limit: this.limits.monthlyLimit,
          percentage,
          timestamp: new Date(),
          message: `Monthly budget at ${percentage.toFixed(0)}%: $${newMonthly.toFixed(2)} of $${this.limits.monthlyLimit}`,
        });
      }
    }
  }

  /**
   * Add a budget alert
   * @param alert - Budget alert
   */
  private addAlert(alert: BudgetAlert): void {
    this.alerts.push(alert);
    logger.warn('Budget alert', {
      type: alert.type,
      level: alert.level,
      message: alert.message,
    });
  }

  /**
   * Get current budget status
   * @returns Budget status
   */
  getStatus(): BudgetStatus {
    const stats = this.costTracker.getStats();

    // Calculate spending by time period
    const dailyRecords = this.costTracker.getRecordsByDateRange(this.startOfDay, new Date());
    const weeklyRecords = this.costTracker.getRecordsByDateRange(this.startOfWeek, new Date());
    const monthlyRecords = this.costTracker.getRecordsByDateRange(this.startOfMonth, new Date());

    const dailySpent = dailyRecords.reduce((sum, r) => sum + r.costUsd, 0);
    const weeklySpent = weeklyRecords.reduce((sum, r) => sum + r.costUsd, 0);
    const monthlySpent = monthlyRecords.reduce((sum, r) => sum + r.costUsd, 0);

    // Calculate by provider
    const byProvider = new Map<AIProvider, { spent: number; limit?: number; remaining?: number }>();
    for (const [provider, providerStats] of stats.byProvider) {
      const limit = this.limits.providerLimits?.[provider];
      byProvider.set(provider, {
        spent: providerStats.costUsd,
        limit,
        remaining: limit ? limit - providerStats.costUsd : undefined,
      });
    }

    return {
      daily: {
        spent: dailySpent,
        limit: this.limits.dailyLimit,
        remaining: this.limits.dailyLimit ? this.limits.dailyLimit - dailySpent : undefined,
        percentage: this.limits.dailyLimit ? (dailySpent / this.limits.dailyLimit) * 100 : undefined,
      },
      weekly: {
        spent: weeklySpent,
        limit: this.limits.weeklyLimit,
        remaining: this.limits.weeklyLimit ? this.limits.weeklyLimit - weeklySpent : undefined,
        percentage: this.limits.weeklyLimit
          ? (weeklySpent / this.limits.weeklyLimit) * 100
          : undefined,
      },
      monthly: {
        spent: monthlySpent,
        limit: this.limits.monthlyLimit,
        remaining: this.limits.monthlyLimit ? this.limits.monthlyLimit - monthlySpent : undefined,
        percentage: this.limits.monthlyLimit
          ? (monthlySpent / this.limits.monthlyLimit) * 100
          : undefined,
      },
      byProvider,
      alerts: this.alerts,
    };
  }

  /**
   * Get recent alerts
   * @param count - Number of alerts to return
   * @returns Recent alerts
   */
  getRecentAlerts(count: number = 10): BudgetAlert[] {
    return this.alerts.slice(-count);
  }

  /**
   * Clear all alerts
   */
  clearAlerts(): void {
    this.alerts = [];
    logger.info('Budget alerts cleared');
  }

  /**
   * Update budget limits
   * @param limits - New budget limits
   */
  updateLimits(limits: Partial<BudgetLimit>): void {
    this.limits = { ...this.limits, ...limits };
    logger.info('Budget limits updated', limits);
  }

  /**
   * Set warning threshold percentage
   * @param threshold - Warning threshold (0-100)
   */
  setWarningThreshold(threshold: number): void {
    this.warningThreshold = Math.max(0, Math.min(100, threshold));
    logger.info('Warning threshold updated', { threshold: this.warningThreshold });
  }
}
