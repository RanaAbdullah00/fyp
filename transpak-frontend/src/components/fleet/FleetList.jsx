import React from 'react';
import VehicleCard from './VehicleCard.jsx';

// List of carrier vehicles.
const FleetList = ({ vehicles }) => {
  if (!vehicles.length) {
    return (
      <p className="text-center text-muted small mt-3">
        No vehicles registered yet.
      </p>
    );
  }

  return (
    <div className="mt-2">
      {vehicles.map((v) => (
        <VehicleCard key={v.id} vehicle={v} />
      ))}
    </div>
  );
};

export default FleetList;

