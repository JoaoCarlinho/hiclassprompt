import express from 'express';
import { authenticate, AuthenticatedRequest } from '../middleware/auth';
import { analyticsService } from '../services/analyticsService';

const router = express.Router();

// Time series data
router.post('/timeseries', authenticate, async (req: AuthenticatedRequest, res) => {
  try {
    const { metric, startDate, endDate } = req.body;

    const data = await analyticsService.getTimeSeriesData(metric, {
      start: new Date(startDate),
      end: new Date(endDate)
    });

    res.json({ success: true, data });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: {
        code: 'ANALYTICS_ERROR',
        message: error instanceof Error ? error.message : 'Unknown error'
      }
    });
  }
});

// Provider comparison
router.get('/provider-comparison', authenticate, async (req: AuthenticatedRequest, res) => {
  try {
    const { startDate, endDate } = req.query;

    const data = await analyticsService.compareProviders({
      start: new Date(startDate as string),
      end: new Date(endDate as string)
    });

    res.json({ success: true, data });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: {
        code: 'COMPARISON_ERROR',
        message: error instanceof Error ? error.message : 'Unknown error'
      }
    });
  }
});

// Category performance
router.get('/category-performance', authenticate, async (req: AuthenticatedRequest, res) => {
  try {
    const { startDate, endDate } = req.query;

    const data = await analyticsService.analyzeCategoryPerformance({
      start: new Date(startDate as string),
      end: new Date(endDate as string)
    });

    res.json({ success: true, data });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: {
        code: 'CATEGORY_ERROR',
        message: error instanceof Error ? error.message : 'Unknown error'
      }
    });
  }
});

export default router;
