/**
 * Costs API Endpoints
 * Handles cost analytics, budget tracking, and export
 */

import { Router, Request, Response } from 'express';
import { CostTracker } from '../core/cost-tracker';
import { CostComparison } from '../core/cost-comparison';
import { BudgetManager } from '../core/budget-manager';
import { logger } from '../utils/logger';

export function createCostsRouter(
  costTracker: CostTracker,
  budgetManager: BudgetManager
): Router {
  const router = Router();

  // Get cost statistics
  router.get('/stats', async (req: Request, res: Response) => {
    try {
      const dateRange = req.query.range as string || '30d';
      const stats = costTracker.getStats();

      // Calculate trends
      const byProvider = CostComparison.compareProviders(costTracker);
      const cheapest = CostComparison.findCheapestProvider({
        input: 10000,
        output: 500
      });

      res.json({
        totalCost: stats.totalCostUsd,
        avgCostPerImage: stats.averageCostPerRequest,
        totalImages: stats.totalRequests,
        cheapestProvider: cheapest.provider,
        cheapestProviderAvgCost: cheapest.costPerRequest,
        potentialSavings: stats.totalCostUsd * 0.3, // Estimate
        byProvider: byProvider.map(p => ({
          name: p.provider,
          totalCost: p.totalCostUsd,
          imageCount: p.requestCount,
          avgCost: p.costPerRequest,
          percentage: (p.totalCostUsd / stats.totalCostUsd) * 100
        })),
        trend: 5.2 // TODO: Calculate actual trend
      });
    } catch (error) {
      logger.error('Failed to get cost stats', { error });
      res.status(500).json({ error: 'Failed to retrieve cost statistics' });
    }
  });

  // Get budget status
  router.get('/budget', async (req: Request, res: Response) => {
    try {
      const limits = budgetManager.getLimits();
      const currentSpend = costTracker.getStats().totalCostUsd;

      res.json({
        budgetLimit: limits.monthlyLimit || 1000,
        currentSpend,
        percentUsed: (currentSpend / (limits.monthlyLimit || 1000)) * 100,
        remainingBudget: (limits.monthlyLimit || 1000) - currentSpend
      });
    } catch (error) {
      logger.error('Failed to get budget status', { error });
      res.status(500).json({ error: 'Failed to retrieve budget status' });
    }
  });

  // Get cost trends over time
  router.get('/trends', async (req: Request, res: Response) => {
    try {
      const dateRange = req.query.range as string || '30d';

      // TODO: Implement actual time-series data from database
      const mockData = {
        labels: ['Day 1', 'Day 2', 'Day 3', 'Day 4', 'Day 5'],
        datasets: [
          {
            label: 'Gemini',
            data: [10, 12, 8, 15, 11]
          },
          {
            label: 'Claude',
            data: [50, 55, 48, 52, 49]
          }
        ]
      };

      res.json(mockData);
    } catch (error) {
      logger.error('Failed to get cost trends', { error });
      res.status(500).json({ error: 'Failed to retrieve cost trends' });
    }
  });

  // Export costs
  router.post('/export', async (req: Request, res: Response) => {
    try {
      const { dateRange, format, includeDetails } = req.body;
      const stats = costTracker.getStats();

      if (format === 'csv') {
        const csv = [
          'Provider,Requests,Total Cost,Avg Cost,Total Tokens',
          ...Object.entries(stats.byProvider || {}).map(([provider, data]: [string, any]) =>
            `${provider},${data.requests},${data.totalCostUsd},${data.averageCostPerRequest},${data.totalTokens}`
          )
        ].join('\n');

        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename=costs-${dateRange}.csv`);
        res.send(csv);
      } else if (format === 'json') {
        res.json(stats);
      } else {
        res.status(400).json({ error: 'Unsupported export format' });
      }
    } catch (error) {
      logger.error('Failed to export costs', { error });
      res.status(500).json({ error: 'Failed to export costs' });
    }
  });

  return router;
}
