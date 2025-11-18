import express from 'express';
import { PromptVersionService } from '../services/PromptVersionService';
import { authenticate, AuthenticatedRequest } from '../middleware/auth';
import { Pool } from 'pg';

const router = express.Router();

// Create a mock pool for now - in production this would be configured properly
const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'hiclassprompt',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres'
});

const versionService = new PromptVersionService(pool);

// Create a new version
router.post('/prompts/:promptId/versions', authenticate, async (req: AuthenticatedRequest, res) => {
  try {
    const { promptId } = req.params;
    const { content, commitMessage, tags, metadata } = req.body;

    const version = await versionService.createVersion({
      promptId,
      content,
      commitMessage,
      createdBy: req.user?.email || 'unknown',
      tags,
      metadata
    });

    res.json({
      success: true,
      data: version
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: {
        code: 'VERSION_CREATE_FAILED',
        message: error instanceof Error ? error.message : 'Unknown error'
      }
    });
  }
});

// Get version history
router.get('/prompts/:promptId/versions', authenticate, async (req: AuthenticatedRequest, res) => {
  try {
    const { promptId } = req.params;
    const limit = parseInt(req.query.limit as string) || 50;
    const offset = parseInt(req.query.offset as string) || 0;

    const result = await versionService.getVersionHistory(promptId, { limit, offset });

    res.json({
      success: true,
      data: result.versions,
      pagination: {
        limit,
        offset,
        total: result.total
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: {
        code: 'VERSION_HISTORY_FAILED',
        message: error instanceof Error ? error.message : 'Unknown error'
      }
    });
  }
});

// Get specific version
router.get('/prompts/versions/:versionId', authenticate, async (req: AuthenticatedRequest, res) => {
  try {
    const versionId = parseInt(req.params.versionId);
    const version = await versionService.getVersion(versionId);

    if (!version) {
      return res.status(404).json({
        success: false,
        error: { code: 'VERSION_NOT_FOUND', message: 'Version not found' }
      });
    }

    res.json({
      success: true,
      data: version
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: {
        code: 'VERSION_GET_FAILED',
        message: error instanceof Error ? error.message : 'Unknown error'
      }
    });
  }
});

// Compare two versions
router.get('/prompts/versions/compare/:versionId1/:versionId2', authenticate, async (req: AuthenticatedRequest, res) => {
  try {
    const versionId1 = parseInt(req.params.versionId1);
    const versionId2 = parseInt(req.params.versionId2);

    const comparison = await versionService.compareVersions(versionId1, versionId2);

    res.json({
      success: true,
      data: comparison
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: {
        code: 'VERSION_COMPARE_FAILED',
        message: error instanceof Error ? error.message : 'Unknown error'
      }
    });
  }
});

// Rollback to version
router.post('/prompts/:promptId/rollback/:versionId', authenticate, async (req: AuthenticatedRequest, res) => {
  try {
    const { promptId, versionId } = req.params;
    const { commitMessage } = req.body;

    const newVersion = await versionService.rollbackToVersion(
      promptId,
      parseInt(versionId),
      req.user?.email || 'unknown',
      commitMessage || 'Rollback'
    );

    res.json({
      success: true,
      data: newVersion
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: {
        code: 'ROLLBACK_FAILED',
        message: error instanceof Error ? error.message : 'Unknown error'
      }
    });
  }
});

// Tag version
router.post('/prompts/versions/:versionId/tag', authenticate, async (req: AuthenticatedRequest, res) => {
  try {
    const versionId = parseInt(req.params.versionId);
    const { tags } = req.body;

    await versionService.tagVersion(versionId, tags);

    res.json({
      success: true,
      message: 'Tags added successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: {
        code: 'TAG_FAILED',
        message: error instanceof Error ? error.message : 'Unknown error'
      }
    });
  }
});

// Publish version
router.post('/prompts/versions/:versionId/publish', authenticate, async (req: AuthenticatedRequest, res) => {
  try {
    const versionId = parseInt(req.params.versionId);
    await versionService.publishVersion(versionId);

    res.json({
      success: true,
      message: 'Version published successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: {
        code: 'PUBLISH_FAILED',
        message: error instanceof Error ? error.message : 'Unknown error'
      }
    });
  }
});

// Create branch
router.post('/prompts/:promptId/branches', authenticate, async (req: AuthenticatedRequest, res) => {
  try {
    const { promptId } = req.params;
    const { branchName, baseVersionId } = req.body;

    const branch = await versionService.createBranch(
      promptId,
      branchName,
      baseVersionId,
      req.user?.email || 'unknown'
    );

    res.json({
      success: true,
      data: branch
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: {
        code: 'BRANCH_CREATE_FAILED',
        message: error instanceof Error ? error.message : 'Unknown error'
      }
    });
  }
});

export default router;
