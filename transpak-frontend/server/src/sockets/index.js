import { Notification } from '../models/Notification.js';

export function registerSockets(io) {
  io.on('connection', (socket) => {
    socket.on('auth:join', ({ userId }) => {
      if (!userId) return;
      socket.join(`user:${userId}`);
    });

    socket.on('tracking:update', (payload) => {
      // payload should include loadId + coords; broadcast to room
      if (payload?.loadId) {
        io.to(`load:${payload.loadId}`).emit('tracking:update', payload);
      }
    });

    socket.on('load:join', ({ loadId }) => {
      if (!loadId) return;
      socket.join(`load:${loadId}`);
    });
  });
}

export async function emitNotification(io, notification) {
  const created = await Notification.create(notification);
  io.to(`user:${created.receiverId}`).emit('notification:new', created);
  return created;
}
