import express from 'express';
import cors from 'cors';
import { env } from './config/env.js';
import { dbState } from './config/db.js';
import { notFound, errorHandler } from './middleware/error.js';

import authRoutes from './routes/auth.js';
import loadRoutes from './routes/loads.js';
import bidRoutes from './routes/bids.js';
import trackingRoutes from './routes/tracking.js';
import notificationRoutes from './routes/notifications.js';

export function createApp() {
  const app = express();

  app.use(
    cors({
      origin: env.CLIENT_ORIGIN,
      credentials: true
    })
  );
  app.use(express.json({ limit: '2mb' }));

  app.get('/api/health', (req, res) =>
    res.json({
      ok: true,
      dbReady: dbState.ready,
      dbMode: dbState.mode,
      dbError: dbState.lastError ? String(dbState.lastError.message || dbState.lastError) : null
    })
  );

  // DB gate: if both external + embedded failed.
  app.use((req, res, next) => {
    if (!dbState.ready && req.path !== '/api/health') {
      res.status(503).json({ message: 'Database unavailable.' });
      return;
    }
    next();
  });

  app.use('/api/auth', authRoutes);
  app.use('/api/loads', loadRoutes);
  app.use('/api/bids', bidRoutes);
  app.use('/api/tracking', trackingRoutes);
  app.use('/api/notifications', notificationRoutes);

  app.use(notFound);
  app.use(errorHandler);

  return app;
}
