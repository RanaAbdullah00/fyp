import express from 'express';
import asyncHandler from 'express-async-handler';
import { requireAuth } from '../middleware/auth.js';

const router = express.Router();

// PATCH /api/tracking/update
router.patch(
  '/update',
  requireAuth,
  asyncHandler(async (req, res) => {
    // Minimal implementation: accept coordinates + loadId, return ack
    const { loadId, lat, lng, status } = req.body || {};
    if (!loadId || typeof lat !== 'number' || typeof lng !== 'number') {
      res.status(400);
      throw new Error('Missing tracking fields');
    }
    res.json({
      ok: true,
      tracking: {
        loadId,
        lat,
        lng,
        status: status || 'in_transit',
        timestamp: new Date().toISOString()
      }
    });
  })
);

export default router;
