import React from 'react';
import FleetList from '../../components/fleet/FleetList.jsx';

// Carrier fleet monitoring page.
// Later you can add telematics, vehicle locations, and driver assignments here.
const FleetMonitoring = () => {
  const vehicles = [
    { id: 1, reg: 'LEA-4567', type: 'Truck', capacity: 18, driverName: 'Ali Raza', active: true },
    { id: 2, reg: 'KAR-9988', type: 'Trailer', capacity: 24, driverName: 'Ahmed Khan', active: false }
  ];

  return (
    <div className="container py-3">
      <h5 className="mb-3">Fleet monitoring</h5>
      <FleetList vehicles={vehicles} />
    </div>
  );
};

export default FleetMonitoring;

