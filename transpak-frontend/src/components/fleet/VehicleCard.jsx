import React from 'react';
import Card from '../ui/Card.jsx';
import Badge from '../ui/Badge.jsx';

// Card representing a fleet vehicle for carriers.
const VehicleCard = ({ vehicle }) => (
  <Card>
    <div className="d-flex justify-content-between align-items-center mb-1">
      <h6 className="mb-0">{vehicle.reg}</h6>
      <Badge variant={vehicle.active ? 'success' : 'secondary'}>
        {vehicle.active ? 'Active' : 'Inactive'}
      </Badge>
    </div>
    <div className="small text-muted mb-1">
      {vehicle.type} · Capacity: {vehicle.capacity} tons
    </div>
    <div className="small">Driver: {vehicle.driverName}</div>
  </Card>
);

export default VehicleCard;

