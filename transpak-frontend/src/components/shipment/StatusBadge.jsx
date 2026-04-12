import React from 'react';
import Badge from '../ui/Badge.jsx';
import { normalizeShipmentStatus } from '../../utils/shipmentStatus.js';

// Visual indicator for shipment / tracking status.
const StatusBadge = ({ status, size }) => {
  const canon = normalizeShipmentStatus(status) || String(status || '').toLowerCase();
  const map = {
    posted: 'secondary',
    booked: 'warning',
    pickedup: 'warning',
    intransit: 'primary',
    delivered: 'success',
    closed: 'secondary',
    pending: 'warning',
    in_transit: 'primary',
    cancelled: 'secondary'
  };
  const labelMap = {
    posted: 'Posted',
    booked: 'Booked',
    pickedup: 'Picked up',
    intransit: 'In transit',
    delivered: 'Delivered',
    closed: 'Closed',
    pending: 'Pending',
    in_transit: 'In transit',
    cancelled: 'Cancelled'
  };
  const variant = map[canon] || map[String(status || '').toLowerCase()] || 'secondary';
  const label = labelMap[canon] || String(status || 'Unknown').replace(/_/g, ' ');
  const cls = size === 'lg' ? 'fs-6 px-3 py-2' : '';
  return (
    <Badge variant={variant} className={cls}>
      {label}
    </Badge>
  );
};

export default StatusBadge;
