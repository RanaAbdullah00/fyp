import { io } from 'socket.io-client';

/**
 * Socket.io client (JWT in handshake). Falls back to simulated notifications if server unreachable.
 */
export function createSocketClient({
  token,
  onNotification,
  onTracking,
  onChatMessage,
  onChatSeen
}) {
  const url =
    import.meta.env.VITE_SOCKET_URL ||
    (import.meta.env.DEV ? window.location.origin : 'http://localhost:5000');

  let socket = null;
  let simulatedTimer = null;

  const startSimulated = () => {
    if (simulatedTimer || token) return;
    simulatedTimer = window.setInterval(() => {
      onNotification?.({
        id: Date.now(),
        senderId: 'system',
        receiverId: 'local',
        roleType: 'shipper',
        type: 'INFO',
        message: 'Simulated: connect backend + login for live notifications.',
        createdAt: new Date().toISOString(),
        read: false
      });
    }, 20000);
  };

  const stopSimulated = () => {
    if (simulatedTimer) window.clearInterval(simulatedTimer);
    simulatedTimer = null;
  };

  if (!token) {
    startSimulated();
    return {
      socket: null,
      disconnect: () => stopSimulated()
    };
  }

  try {
    socket = io(url, {
      auth: { token },
      transports: ['websocket', 'polling'],
      autoConnect: true
    });

    socket.on('connect', () => {
      stopSimulated();
    });

    socket.on('connect_error', () => {
      startSimulated();
    });

    socket.on('notification:new', (n) => onNotification?.(n));
    socket.on('tracking:update', (p) => onTracking?.(p));
    socket.on('chat:message', (m) => onChatMessage?.(m));
    socket.on('chat:seen', (p) => onChatSeen?.(p));
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
