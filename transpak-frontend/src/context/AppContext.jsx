import React, { createContext, useEffect, useMemo, useState } from 'react';
import { createSocketClient } from '../services/socket.js';
import { normalizeNotification } from '../adapters/normalize.js';

// Global app-level context for things like notifications, layout flags,
// and shared mock data used across dashboards.
export const AppContext = createContext(null);

export const AppProvider = ({ children }) => {
  const [notifications, setNotifications] = useState([
    {
      id: 1,
      type: 'shipment',
      message: 'Shipment PK-INV-001 picked up from Lahore.',
      roleType: 'shipper',
      read: false,
      createdAt: new Date(Date.now() - 5 * 60 * 1000).toISOString()
    },
    {
      id: 2,
      type: 'bid',
      message: 'New bid received for Load #L-102.',
      roleType: 'carrier',
      read: false,
      createdAt: new Date(Date.now() - 20 * 60 * 1000).toISOString()
    }
  ]);

  const addNotification = (notification) => {
    const normalized = normalizeNotification(notification) || notification;
    setNotifications((prev) => [
      { id: Date.now(), read: false, ...normalized },
      ...prev
    ]);
  };

  const markNotificationRead = (id) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n))
    );
  };

  // Safe realtime: connect if possible; otherwise simulated updates run.
  useEffect(() => {
    const stored = localStorage.getItem('transpak_user');
    const user = stored ? JSON.parse(stored) : null;
    const client = createSocketClient({
      userId: user?.id || user?._id || user?.email,
      onNotification: (n) => addNotification(n)
    });
    return () => client.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const value = useMemo(() => ({
    notifications,
    addNotification,
    markNotificationRead
  }), [notifications]);

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
};

