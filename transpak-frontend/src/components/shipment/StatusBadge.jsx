import React from 'react';
import Badge from '../ui/Badge.jsx';

// Visual indicator for shipment status.
const StatusBadge = ({ status }) => {
  const map = {
    pending: 'warning',
    in_transit: 'primary',
    delivered: 'success',
    cancelled: 'secondary'
  };
  const labelMap = {
    pending: 'Pending pickup',
    in_transit: 'In transit',
    delivered: 'Delivered',
    cancelled: 'Cancelled'
  };
  const variant = map[status] || 'secondary';
  return <Badge variant={variant}>{labelMap[status] || status}</Badge>;
};

export default StatusBadge;

