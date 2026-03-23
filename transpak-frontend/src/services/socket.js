import { io } from 'socket.io-client';

// Safe socket wrapper: never throws, supports offline simulated events.
export function createSocketClient({ userId, onNotification, onTracking }) {
  const url = import.meta.env.VITE_SOCKET_URL || 'http://localhost:5000';
  let socket = null;
  let simulatedTimer = null;

  const startSimulated = () => {
    if (simulatedTimer) return;
    simulatedTimer = window.setInterval(() => {
      onNotification?.({
        id: Date.now(),
        senderId: 'system',
        receiverId: userId || 'local',
        roleType: 'shipper',
        type: 'INFO',
        message: 'Realtime (simulated): system heartbeat update.',
        createdAt: new Date().toISOString(),
        read: false
      });
    }, 12000);
  };

  const stopSimulated = () => {
    if (simulatedTimer) window.clearInterval(simulatedTimer);
    simulatedTimer = null;
  };

  try {
    socket = io(url, { autoConnect: true, transports: ['websocket', 'polling'] });

    socket.on('connect', () => {
      stopSimulated();
      if (userId) socket.emit('auth:join', { userId });
    });

    socket.on('connect_error', () => {
      startSimulated();
    });

    socket.on('notification:new', (n) => onNotification?.(n));
    socket.on('tracking:update', (p) => onTracking?.(p));
  } catch {
    startSimulated();
  }

  return {
    socket,
    disconnect: () => {
      stopSimulated();
      try {
        socket?.disconnect();
      } catch {
        // ignore
      }
    }
  };
}

