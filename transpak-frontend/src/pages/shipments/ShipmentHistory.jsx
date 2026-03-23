import React from 'react';
import ShipmentCard from '../../components/shipment/ShipmentCard.jsx';

// Historical list of completed shipments.
const ShipmentHistory = () => {
  const shipments = [
    {
      id: 1,
      code: 'PK-INV-021',
      origin: 'Karachi',
      destination: 'Faisalabad',
      status: 'delivered',
      driverName: 'Ahmed Khan',
      vehicleReg: 'KAR-9988',
      eta: 'Delivered yesterday',
      lastUpdate: '1 day ago'
    },
    {
      id: 2,
      code: 'PK-INV-018',
      origin: 'Lahore',
      destination: 'Quetta',
      status: 'delivered',
      driverName: 'Bilal Ahmad',
      vehicleReg: 'LEB-2211',
      eta: 'Delivered 3 days ago',
      lastUpdate: '3 days ago'
    }
  ];

  return (
    <div className="container py-3">
      <h5 className="mb-3">Shipment history</h5>
      {shipments.length === 0 ? (
        <div className="text-center py-5 px-3 rounded-xl" style={{ background: 'var(--pak-light-green-bg)' }}>
          <p className="text-muted mb-0 fw-medium">No shipment history yet</p>
          <p className="small text-muted mt-1 mb-0">Completed shipments will appear here.</p>
        </div>
      ) : (
        shipments.map((s) => (
          <ShipmentCard key={s.id} shipment={s} />
        ))
      )}
    </div>
  );
};

export default ShipmentHistory;

