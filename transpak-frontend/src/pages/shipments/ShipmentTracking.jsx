import React from 'react';
import TrackingMap from '../../components/shipment/TrackingMap.jsx';
import RouteInfo from '../../components/shipment/RouteInfo.jsx';
import ShipmentCard from '../../components/shipment/ShipmentCard.jsx';
import StatusTimeline from '../../components/shipment/StatusTimeline.jsx';

// Live shipment tracking view with map placeholder and route details.
const ShipmentTracking = () => {
  const shipment = {
    code: 'PK-INV-001',
    origin: 'Lahore',
    destination: 'Karachi',
    status: 'in_transit',
    driverName: 'Ali Raza',
    vehicleReg: 'LEA-4567',
    eta: 'Tonight 11:30 PM',
    lastUpdate: '5 min ago'
  };

  const checkpoints = ['Lahore', 'Multan', 'Sukkur', 'Hyderabad', 'Karachi'];
  const timelineEvents = [
    { label: 'Load confirmed', time: 'Yesterday 6:20 PM', done: true },
    { label: 'Picked up', time: 'Today 8:15 AM', done: true, note: 'Warehouse gate 3' },
    { label: 'In transit', time: 'Today 12:40 PM', done: true, note: 'Near Sukkur' },
    { label: 'Arriving', time: 'Tonight 10:30 PM', done: false },
    { label: 'Delivered', time: 'Pending', done: false }
  ];

  return (
    <div className="container py-3">
      <h5 className="mb-3">Shipment tracking</h5>
      <ShipmentCard shipment={shipment} />
      <TrackingMap currentLocation="Near Sukkur" />
      <StatusTimeline currentStatus={shipment.status} events={timelineEvents} />
      <RouteInfo distance={1240} duration={20} checkpoints={checkpoints} />
    </div>
  );
};

export default ShipmentTracking;

