import express from 'express';
import asyncHandler from 'express-async-handler';
import { requireAuth } from '../middleware/auth.js';
import { Load } from '../models/Load.js';
import { Bid } from '../models/Bid.js';

const router = express.Router();

// POST /api/loads/create
router.post(
  '/create',
  requireAuth,
  asyncHandler(async (req, res) => {
    const { origin, destination, weight, type, price, date, pickupDate } = req.body || {};
    if (!origin || !destination || !weight || !type || !price || !(pickupDate || date)) {
      res.status(400);
      throw new Error('Missing required fields');
    }
    const load = await Load.create({
      shipperId: req.user._id,
      origin,
      destination,
      weight: Number(weight),
      type,
      price: Number(price),
      pickupDate: new Date(pickupDate || date),
      status: 'Pending'
    });
    res.status(201).json(load);
  })
);

// GET /api/loads
router.get(
  '/',
  requireAuth,
  asyncHandler(async (req, res) => {
    const loads = await Load.find().sort({ createdAt: -1 }).lean();
    res.json(loads);
  })
);

// GET /api/loads/search?origin=&destination=&type=
router.get(
  '/search',
  requireAuth,
  asyncHandler(async (req, res) => {
    const { origin, destination, type } = req.query || {};
    const q = {};
    if (origin) q.origin = new RegExp(String(origin), 'i');
    if (destination) q.destination = new RegExp(String(destination), 'i');
    if (type) q.type = new RegExp(String(type), 'i');
    const loads = await Load.find(q).sort({ createdAt: -1 }).lean();
    res.json(loads);
  })
);

// PUT /api/loads/:id/bid  (carrier creates/updates a bid)
router.put(
  '/:id/bid',
  requireAuth,
  asyncHandler(async (req, res) => {
    const { price, ETA, eta } = req.body || {};
    if (!price || !(ETA || eta)) {
      res.status(400);
      throw new Error('Missing bid fields');
    }
    const load = await Load.findById(req.params.id);
    if (!load) {
      res.status(404);
      throw new Error('Load not found');
    }

    const bid = await Bid.findOneAndUpdate(
      { loadId: load._id, carrierId: req.user._id },
      { price: Number(price), eta: String(ETA || eta), status: 'pending' },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );

    res.json(bid);
  })
);

// PATCH /api/loads/:id/assign  (shipper accepts one bid, assigns carrier, moves to Active)
router.patch(
  '/:id/assign',
  requireAuth,
  asyncHandler(async (req, res) => {
    const { bidId } = req.body || {};
    const load = await Load.findById(req.params.id);
    if (!load) {
      res.status(404);
      throw new Error('Load not found');
    }
    if (String(load.shipperId) !== String(req.user._id)) {
      res.status(403);
      throw new Error('Forbidden');
    }

    const bid = await Bid.findById(bidId);
    if (!bid || String(bid.loadId) !== String(load._id)) {
      res.status(400);
      throw new Error('Invalid bid');
    }

    await Bid.updateMany({ loadId: load._id }, { $set: { status: 'rejected' } });
    bid.status = 'accepted';
    await bid.save();

    load.assignedCarrierId = bid.carrierId;
    load.status = 'Active';
    await load.save();

    res.json({ load, acceptedBid: bid });
  })
);

export default router;
