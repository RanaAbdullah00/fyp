import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';

export function signToken(userId) {
  return jwt.sign({ id: userId }, env.JWT_SECRET, { expiresIn: '7d' });
}
