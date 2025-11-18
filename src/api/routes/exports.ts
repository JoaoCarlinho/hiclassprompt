import express from 'express';
import { authenticate, AuthenticatedRequest } from '../middleware/auth';
import { exportService } from '../services/exportService';

const router = express.Router();

// Create export
router.post('/', authenticate, async (req: AuthenticatedRequest, res) => {
  try {
    const { data, format, title } = req.body;

    if (!data || !Array.isArray(data) || data.length === 0) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_DATA', message: 'Data array is required and must not be empty' }
      });
    }

    let buffer: Buffer;
    let contentType: string;
    let fileExtension: string;

    switch (format) {
      case 'csv':
        buffer = await exportService.exportToCSV(data, Object.keys(data[0]));
        contentType = 'text/csv';
        fileExtension = 'csv';
        break;
      case 'xlsx':
        buffer = await exportService.exportToExcel(data, 'Export');
        contentType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
        fileExtension = 'xlsx';
        break;
      case 'pdf':
        buffer = await exportService.exportToPDF(data, title || 'Classification Report');
        contentType = 'application/pdf';
        fileExtension = 'pdf';
        break;
      case 'json':
        buffer = Buffer.from(JSON.stringify(data, null, 2));
        contentType = 'application/json';
        fileExtension = 'json';
        break;
      default:
        return res.status(400).json({
          success: false,
          error: { code: 'INVALID_FORMAT', message: 'Invalid export format' }
        });
    }

    // Save to S3 if enabled
    const filename = `export-${Date.now()}.${fileExtension}`;
    let s3Key = null;

    if (process.env.S3_BUCKET_NAME) {
      try {
        s3Key = await exportService.saveToS3(buffer, filename, contentType);
      } catch (error) {
        console.error('Failed to save to S3:', error);
      }
    }

    // Return file directly
    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(buffer);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: {
        code: 'EXPORT_ERROR',
        message: error instanceof Error ? error.message : 'Unknown error'
      }
    });
  }
});

// List exports (placeholder)
router.get('/', authenticate, async (req: AuthenticatedRequest, res) => {
  try {
    res.json({
      success: true,
      data: []
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: {
        code: 'LIST_ERROR',
        message: error instanceof Error ? error.message : 'Unknown error'
      }
    });
  }
});

// Schedule export
router.post('/schedule', authenticate, async (req: AuthenticatedRequest, res) => {
  try {
    await exportService.scheduleExport({
      ...req.body,
      userId: req.user?.sub || ''
    });
    res.json({ success: true, message: 'Export scheduled successfully' });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: {
        code: 'SCHEDULE_ERROR',
        message: error instanceof Error ? error.message : 'Unknown error'
      }
    });
  }
});

export default router;
