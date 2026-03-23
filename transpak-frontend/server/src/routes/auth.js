import express from 'express';
import asyncHandler from 'express-async-handler';
import { User } from '../models/User.js';
import { signToken } from '../utils/tokens.js';

const router = express.Router();

// POST /api/auth/register
router.post(
  '/register',
  asyncHandler(async (req, res) => {
    const { name, email, phone, cnic, password, roles } = req.body || {};
    if (!name || !password || (!email && !phone)) {
      res.status(400);
      throw new Error('Missing required fields');
    }

    const existing = await User.findOne({
      $or: [{ email: email?.toLowerCase() }, { phone }, { cnic }]
    });
    if (existing) {
      res.status(409);
      throw new Error('User already exists');
    }

    const user = await User.create({
      name,
      email: email?.toLowerCase(),
      phone,
      cnic,
      password,
      roles: Array.isArray(roles) && roles.length ? roles : ['shipper', 'carrier'],
      activeRole: Array.isArray(roles) && roles.includes('carrier') ? 'carrier' : 'shipper'
    });

    const token = signToken(user._id);
    res.status(201).json({
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        cnic: user.cnic,
        roles: user.roles,
        activeRole: user.activeRole,
        verified: user.verified
      }
    });
  })
);

// POST /api/auth/login
router.post(
  '/login',
  asyncHandler(async (req, res) => {
    const { emailOrPhone, email, phone, password } = req.body || {};
    const identifier = emailOrPhone || email || phone;
    if (!identifier || !password) {
      res.status(400);
      throw new Error('Missing credentials');
    }

    const user = await User.findOne({
      $or: [{ email: String(identifier).toLowerCase() }, { phone: String(identifier) }]
    });
    if (!user) {
      res.status(401);
      throw new Error('Invalid credentials');
    }
    if (user.blocked) {
      res.status(403);
      throw new Error('Account blocked');
    }

    const ok = await user.matchPassword(password);
    if (!ok) {
      res.status(401);
      throw new Error('Invalid credentials');
    }

    const token = signToken(user._id);
    res.json({
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        cnic: user.cnic,
        roles: user.roles,
        activeRole: user.activeRole,
        verified: user.verified
      }
    });
  })
);

export default router;
