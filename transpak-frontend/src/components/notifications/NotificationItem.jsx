import React from 'react';
import Badge from '../ui/Badge.jsx';

const roleText = (roleType) => {
  if (roleType === 'carrier') return 'Carrier';
  if (roleType === 'shipper') return 'Shipper';
  return 'Role';
};

const roleVariant = (roleType) => {
  if (roleType === 'carrier') return 'warning'; // amber
  if (roleType === 'shipper') return 'success'; // green
  return 'secondary';
};

const typeVariant = (type) => {
  if (!type) return 'secondary';
  const t = String(type).toUpperCase();
  if (t.includes('BID')) return 'success';
  if (t.includes('LOAD')) return 'primary';
  if (t.includes('PAY')) return 'warning';
  return 'secondary';
};

// Single notification entry.
const NotificationItem = ({ notification, onClick }) => (
  <button
    type="button"
    className="list-group-item list-group-item-action border-0 px-3 py-2 d-flex justify-content-between align-items-start"
    onClick={onClick}
  >
    <div className="me-2">
      <div className="small">
        <strong>{roleText(notification.roleType)}:</strong> {notification.message}
      </div>
      <div className="small text-muted d-flex gap-2 flex-wrap">
        <Badge variant={roleVariant(notification.roleType)}>{roleText(notification.roleType)}</Badge>
        {notification.type && (
          <span className="text-uppercase">{notification.type}</span>
        )}
        <span>
          {notification.createdAt ? new Date(notification.createdAt).toLocaleString() : ''}
        </span>
      </div>
    </div>
    <div className="d-flex align-items-center gap-2">
      {notification.type && <Badge variant={typeVariant(notification.type)}>{notification.type}</Badge>}
      {!notification.read && <Badge variant="primary">New</Badge>}
    </div>
  </button>
);

export default NotificationItem;

