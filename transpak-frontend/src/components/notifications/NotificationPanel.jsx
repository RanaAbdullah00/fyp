import React, { useEffect, useMemo, useState } from 'react';
import Card from '../ui/Card.jsx';
import NotificationItem from './NotificationItem.jsx';
import { AppContext } from '../../context/AppContext.jsx';
import api from '../../services/api.js';

// Panel listing all notifications with read state.
const NotificationPanel = () => {
  const app = React.useContext(AppContext);
  const notifications = useMemo(
    () => (Array.isArray(app?.notifications) ? app.notifications : []),
    [app?.notifications]
  );
  const markNotificationRead = app?.markNotificationRead || (() => {});
  const [persisted, setPersisted] = useState([]);

  const fetchPersisted = React.useCallback(async () => {
    const token = localStorage.getItem('transpak_token');
    if (!token) return;
    try {
      const res = await api.get('/notifications');
      const rows = Array.isArray(res.data) ? res.data : [];
      setPersisted(rows);
    } catch {
      setPersisted([]);
    }
  }, []);

  useEffect(() => {
    fetchPersisted();
  }, [fetchPersisted]);

  useEffect(() => {
    const handler = () => fetchPersisted();
    window.addEventListener('tp_notifications_read', handler);
    return () => window.removeEventListener('tp_notifications_read', handler);
  }, [fetchPersisted]);

  const sorted = useMemo(() => {
    const byKey = new Map();
    persisted.forEach((n) => {
      const id = String(n.id || n._id || '');
      if (id) byKey.set(id, n);
      else byKey.set(`p-${n.message}-${n.createdAt}`, n);
    });
    notifications.forEach((n) => {
      const id = String(n.id || n._id || '');
      if (id) {
        if (!byKey.has(id)) byKey.set(id, n);
        return;
      }
      const k = `e-${n.message}-${n.createdAt}`;
      if (!byKey.has(k)) byKey.set(k, n);
    });
    return [...byKey.values()].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }, [notifications, persisted]);

  const handleOpen = (n) => {
    markNotificationRead(n._id || n.id);
    const id = String(n.id || n._id || '');
    if (id) {
      api
        .patch(`/notifications/${id}/read`)
        .then(() => window.dispatchEvent(new CustomEvent('tp_notifications_read')))
        .catch(() => {});
    }
  };

  return (
    <div className="container py-3">
      <h5 className="mb-3">Notifications</h5>
      <Card>
        <div style={{ maxHeight: '65vh', overflowY: 'auto' }}>
          <div className="list-group list-group-flush">
            {sorted.map((n) => (
              <NotificationItem
                key={n._id || n.id}
                notification={n}
                onClick={() => handleOpen(n)}
              />
            ))}
            {!sorted.length && (
              <div className="text-center text-muted small py-4 px-3 tp-empty-state">
                <div className="fw-semibold mb-1">No notifications yet</div>
                <div>When bids, loads, or shipments update, they will appear here.</div>
              </div>
            )}
          </div>
        </div>
      </Card>
    </div>
  );
};

export default NotificationPanel;

