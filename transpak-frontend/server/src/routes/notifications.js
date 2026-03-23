import express from 'express';
import asyncHandler from 'express-async-handler';
import { requireAuth } from '../middleware/auth.js';
import { Notification } from '../models/Notification.js';

const router = express.Router();

// GET /api/notifications
router.get(
  '/',
  requireAuth,
  asyncHandler(async (req, res) => {
    const notifications = await Notification.find({ receiverId: req.user._id })
      .sort({ createdAt: -1 })
      .lean();
    res.json(notifications);
  })
);

export default router;
