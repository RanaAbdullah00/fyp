import jwt from 'jsonwebtoken';
import asyncHandler from 'express-async-handler';
import { env } from '../config/env.js';
import { User } from '../models/User.js';

export const requireAuth = asyncHandler(async (req, res, next) => {
  const auth = req.headers.authorization || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
  if (!token) {
    res.status(401);
    throw new Error('Not authorized');
  }

  const decoded = jwt.verify(token, env.JWT_SECRET);
  const user = await User.findById(decoded.id).select('-password');
  if (!user) {
    res.status(401);
    throw new Error('Not authorized');
  }

  req.user = user;
  next();
});

export function requireRole(role) {
  return (req, res, next) => {
    const roles = req.user?.roles || [];
    if (!roles.includes(role)) {
      res.status(403);
      throw new Error('Forbidden');
    }
    next();
  };
}
