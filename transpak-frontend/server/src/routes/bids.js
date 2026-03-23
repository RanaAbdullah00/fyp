import express from 'express';
import asyncHandler from 'express-async-handler';
import { requireAuth } from '../middleware/auth.js';
import { Bid } from '../models/Bid.js';
import { Load } from '../models/Load.js';

const router = express.Router();

// GET /api/bids
router.get(
  '/',
  requireAuth,
  asyncHandler(async (req, res) => {
    // Shipper sees bids for their loads, carrier sees their own bids
    const loads = await Load.find({ shipperId: req.user._id }).select('_id').lean();
    const shipperLoadIds = loads.map((l) => l._id);

    const query =
      shipperLoadIds.length > 0
        ? { $or: [{ carrierId: req.user._id }, { loadId: { $in: shipperLoadIds } }] }
        : { carrierId: req.user._id };

    const bids = await Bid.find(query).sort({ createdAt: -1 }).lean();
    res.json(bids);
  })
);

// POST /api/bids (alternate bid create)
router.post(
  '/',
  requireAuth,
  asyncHandler(async (req, res) => {
    const { loadId, price, eta, ETA } = req.body || {};
    if (!loadId || !price || !(eta || ETA)) {
      res.status(400);
      throw new Error('Missing bid fields');
    }
    const bid = await Bid.create({
      loadId,
      carrierId: req.user._id,
      price: Number(price),
      eta: String(eta || ETA)
    });
    res.status(201).json(bid);
  })
);

// PUT /api/bids/:id/accept
router.put(
  '/:id/accept',
  requireAuth,
  asyncHandler(async (req, res) => {
    const bid = await Bid.findById(req.params.id);
    if (!bid) {
      res.status(404);
      throw new Error('Bid not found');
    }
    const load = await Load.findById(bid.loadId);
    if (!load) {
      res.status(404);
      throw new Error('Load not found');
    }
    if (String(load.shipperId) !== String(req.user._id)) {
      res.status(403);
      throw new Error('Forbidden');
    }

    await Bid.updateMany({ loadId: load._id }, { $set: { status: 'rejected' } });
    bid.status = 'accepted';
    await bid.save();

    load.assignedCarrierId = bid.carrierId;
    load.status = 'Active';
    await load.save();

    res.json({ bid, load });
  })
);

// PUT /api/bids/:id/reject
router.put(
  '/:id/reject',
  requireAuth,
  asyncHandler(async (req, res) => {
    const bid = await Bid.findById(req.params.id);
    if (!bid) {
      res.status(404);
      throw new Error('Bid not found');
    }
    const load = await Load.findById(bid.loadId);
    if (!load) {
      res.status(404);
      throw new Error('Load not found');
    }
    if (String(load.shipperId) !== String(req.user._id)) {
      res.status(403);
      throw new Error('Forbidden');
    }
    bid.status = 'rejected';
    await bid.save();
    res.json(bid);
  })
);

export default router;
