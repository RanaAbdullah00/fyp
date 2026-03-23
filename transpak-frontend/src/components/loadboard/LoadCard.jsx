import React from 'react';
import { FaMapMarkerAlt, FaCube, FaWeightHanging } from 'react-icons/fa';
import Card from '../ui/Card.jsx';
import Badge from '../ui/Badge.jsx';
import Button from '../ui/Button.jsx';

// Card representing a single load in the marketplace.
const LoadCard = ({ load, onBid }) => {
  const expectedPrice = Number(load?.expectedPrice ?? 0);
  const distance = load?.distance ?? '—';
  return (
    <Card className="tp-load-card" hover>
      <div className="d-flex justify-content-between align-items-start mb-2">
        <div>
          <h6 className="mb-1">{load.cargo}</h6>
          <small className="text-muted">Load ID: {load.code}</small>
        </div>
        <Badge variant={load.status === 'open' ? 'success' : 'secondary'}>
          {load.status}
        </Badge>
      </div>
      <div className="d-flex flex-column small mb-2">
        <span className="d-flex align-items-center mb-1">
          <FaMapMarkerAlt className="text-primary me-2" />
          {load.origin} → {load.destination}
        </span>
        <span className="d-flex align-items-center mb-1">
          <FaWeightHanging className="text-secondary me-2" />
          {load.weight} tons · {load.vehicleType}
        </span>
        <span className="d-flex align-items-center">
          <FaCube className="text-secondary me-2" />
          {distance} km · {expectedPrice.toLocaleString()} PKR
        </span>
      </div>
      <div className="d-flex justify-content-between align-items-start mb-2">
        <small className="text-muted">Pickup: {load.pickupDate}</small>
        {load.deadline && (
          <Badge variant={Date.now() > new Date(load.deadline).getTime() ? 'secondary' : 'warning'}>
            {Date.now() > new Date(load.deadline).getTime() ? 'Expired' : 'Bidding open'}
          </Badge>
        )}
      </div>
      {onBid && (
        <div className="mt-auto">
          <Button
            variant="primary"
            className="w-100 btn-sm rounded-lg"
            onClick={() => onBid(load)}
            disabled={load.deadline && Date.now() > new Date(load.deadline).getTime()}
          >
            {load.deadline && Date.now() > new Date(load.deadline).getTime() ? 'Bidding closed' : 'Place bid'}
          </Button>
        </div>
      )}
    </Card>
  );
};

export default LoadCard;

