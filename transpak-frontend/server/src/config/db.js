import mongoose from 'mongoose';
import { env } from './env.js';
import { MongoMemoryServer } from 'mongodb-memory-server';

export const dbState = {
  ready: false,
  lastError: null,
  uri: null,
  mode: 'external'
};

export async function connectDb() {
  mongoose.set('strictQuery', true);
  try {
    await mongoose.connect(env.MONGO_URI, { serverSelectionTimeoutMS: 3000 });
    dbState.ready = true;
    dbState.lastError = null;
    dbState.uri = env.MONGO_URI;
    dbState.mode = 'external';
    // eslint-disable-next-line no-console
    console.log('[db] connected:', mongoose.connection.name);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[db] connection failed:', err?.message || err);

    // Fallback: embedded MongoDB for local FYP/dev so auth/register works.
    try {
      const mongod = await MongoMemoryServer.create();
      const uri = mongod.getUri();
      await mongoose.connect(uri);
      dbState.ready = true;
      dbState.lastError = null;
      dbState.uri = uri;
      dbState.mode = 'memory';
      // eslint-disable-next-line no-console
      console.log('[db] started embedded mongodb');
    } catch (e) {
      dbState.ready = false;
      dbState.lastError = e;
      // eslint-disable-next-line no-console
      console.error('[db] embedded mongodb failed:', e?.message || e);
    }
  }
}
