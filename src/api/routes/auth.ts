import express from 'express';
import { authenticate, AuthenticatedRequest } from '../middleware/auth';

const router = express.Router();

// Get current user
router.get('/me', authenticate, (req: AuthenticatedRequest, res) => {
  res.json({
    success: true,
    data: req.user
  });
});

// Refresh token endpoint (handled by Cognito)
router.post('/refresh', async (req, res) => {
  // Implementation depends on your refresh token strategy
  res.json({ success: true });
});

export default router;
