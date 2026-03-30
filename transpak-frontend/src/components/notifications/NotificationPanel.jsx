import React, { useMemo } from 'react';
import Card from '../ui/Card.jsx';
import NotificationItem from './NotificationItem.jsx';
import { AppContext } from '../../context/AppContext.jsx';

// Panel listing all notifications with read state.
const NotificationPanel = () => {
  const app = React.useContext(AppContext);
  const notifications = Array.isArray(app?.notifications) ? app.notifications : [];
  const markNotificationRead = app?.markNotificationRead || (() => {});

  const sorted = useMemo(() => {
    return [...notifications].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [notifications]);

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
                onClick={() => markNotificationRead(n._id || n.id)}
              />
            ))}
            {!sorted.length && (
              <div className="text-center text-muted small py-3">
                You&apos;re all caught up.
              </div>
            )}
          </div>
        </div>
      </Card>
    </div>
  );
};

export default NotificationPanel;

