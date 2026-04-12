import React, {
  createContext,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState
} from 'react';
import { createSocketClient } from '../services/socket.js';
import { normalizeNotification } from '../adapters/normalize.js';
import api from '../services/api.js';
import { useAuth } from '../hooks/useAuth.js';

export const AppContext = createContext(null);

function isLikelyMongoId(v) {
  return typeof v === 'string' && /^[a-f\d]{24}$/i.test(v.trim());
}

export const AppProvider = ({ children }) => {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState([]);
  const chatMessageHandlers = useRef(new Set());
  const chatSeenHandlers = useRef(new Set());
  const trackingHandlers = useRef(new Set());
  const socketRef = useRef(null);
  const addNotificationRef = useRef(null);

  const registerChatMessageHandler = useCallback((fn) => {
    chatMessageHandlers.current.add(fn);
    return () => chatMessageHandlers.current.delete(fn);
  }, []);

  const registerChatSeenHandler = useCallback((fn) => {
    chatSeenHandlers.current.add(fn);
    return () => chatSeenHandlers.current.delete(fn);
  }, []);

  const registerTrackingHandler = useCallback((fn) => {
    trackingHandlers.current.add(fn);
    return () => trackingHandlers.current.delete(fn);
  }, []);

  const addNotification = useCallback((notification) => {
    const normalized = normalizeNotification(notification) || notification;
    const nid = normalized.id ?? normalized._id;
    setNotifications((prev) => {
      if (nid != null && prev.some((p) => String(p.id ?? p._id) === String(nid))) {
        return prev;
      }
      const msg = String(normalized.message || '').slice(0, 200);
      const title = String(normalized.title || normalized.type || '');
      const t0 = new Date(normalized.createdAt || Date.now()).getTime();
      const dup = prev.some((p) => {
        const pm = String(p.message || '').slice(0, 200);
        const pt = String(p.title || p.type || '');
        const t1 = new Date(p.createdAt || 0).getTime();
        return pm === msg && pt === title && Math.abs(t0 - t1) < 120000;
      });
      if (dup) return prev;
      return [{ id: nid ?? Date.now(), read: Boolean(normalized.read), ...normalized }, ...prev];
    });

    const token = localStorage.getItem('transpak_token');
    const alreadyPersisted = isLikelyMongoId(nid);
    if (token && normalized?.message && !alreadyPersisted) {
      api
        .post('/notifications', {
          title: String(normalized.type || 'Update').slice(0, 120),
          message: String(normalized.message).slice(0, 2000),
          roleType: normalized.roleType || '',
          meta: { type: normalized.type }
        })
        .catch(() => {});
    }
  }, []);

  addNotificationRef.current = addNotification;

  const markNotificationRead = useCallback((id) => {
    setNotifications((prev) =>
      prev.map((n) => {
        const nid = n.id ?? n._id;
        return nid === id || String(nid) === String(id) ? { ...n, read: true, isRead: true } : n;
      })
    );
  }, []);

  useEffect(() => {
    const token = localStorage.getItem('transpak_token');
    if (!token) {
      setNotifications([]);
      return undefined;
    }

    let cancelled = false;
    (async () => {
      try {
        const rows = await api.get('/notifications');
        if (cancelled || !Array.isArray(rows)) return;
        const mapped = rows.map((r) => ({
          id: r.id || r._id,
          type: r.type || 'INFO',
          message: r.message || r.title,
          roleType: r.roleType || '',
          read: Boolean(r.read || r.isRead),
          createdAt: r.createdAt
        }));
        setNotifications(mapped);
      } catch {
        // keep empty; socket may still deliver
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  useEffect(() => {
    const token = localStorage.getItem('transpak_token');
    const client = createSocketClient({
      token: token || undefined,
      onNotification: (n) => addNotificationRef.current?.(n),
      onTracking: (p) => {
        trackingHandlers.current.forEach((fn) => {
          try {
            fn(p);
          } catch {
            // ignore
          }
        });
      },
      onChatMessage: (msg) => {
        chatMessageHandlers.current.forEach((fn) => {
          try {
            fn(msg);
          } catch {
            // ignore
          }
        });
      },
      onChatSeen: (payload) => {
        chatSeenHandlers.current.forEach((fn) => {
          try {
            fn(payload);
          } catch {
            // ignore
          }
        });
      }
    });
    socketRef.current = client.socket;
    return () => {
      client.disconnect();
      socketRef.current = null;
    };
  }, [user?.id]);

  const getSocket = useCallback(() => socketRef.current, []);

  const value = useMemo(
    () => ({
      notifications,
      addNotification,
      markNotificationRead,
      registerChatMessageHandler,
      registerChatSeenHandler,
      registerTrackingHandler,
      getSocket
    }),
    [
      notifications,
      addNotification,
      markNotificationRead,
      registerChatMessageHandler,
      registerChatSeenHandler,
      registerTrackingHandler,
      getSocket
    ]
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
};
