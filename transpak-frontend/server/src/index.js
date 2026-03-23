import http from 'http';
import { Server as SocketIOServer } from 'socket.io';
import { env } from './config/env.js';
import { connectDb, dbState } from './config/db.js';
import { createApp } from './app.js';
import { registerSockets } from './sockets/index.js';

await connectDb();

const app = createApp();
const server = http.createServer(app);

const io = new SocketIOServer(server, {
  cors: {
    origin: env.CLIENT_ORIGIN,
    credentials: true
  }
});

registerSockets(io);

server.listen(env.PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`[api] listening on http://localhost:${env.PORT}`);
  if (!dbState.ready) {
    // eslint-disable-next-line no-console
    console.log('[api] running without DB. Start MongoDB to enable endpoints.');
  }
});
