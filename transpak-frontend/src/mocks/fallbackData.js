// Safe offline fallback data for UI stability when API is unavailable.

export const fallbackLoads = [
  {
    id: 101,
    code: 'L-101',
    cargo: 'FMCG cartons',
    origin: 'Lahore',
    destination: 'Karachi',
    weight: 18,
    vehicleType: 'Trailer',
    distance: 1240,
    expectedPrice: 120000,
    price: 120000,
    pickupDate: 'Today',
    status: 'open'
  },
  {
    id: 102,
    code: 'L-102',
    cargo: 'Textile rolls',
    origin: 'Faisalabad',
    destination: 'Islamabad',
    weight: 10,
    vehicleType: 'Truck',
    distance: 300,
    expectedPrice: 65000,
    price: 65000,
    pickupDate: 'Tomorrow',
    status: 'open'
  }
];

export const fallbackBids = [
  {
    id: 201,
    loadId: 101,
    carrierId: 'demo_carrier',
    carrierName: 'Demo Carrier',
    vehicleType: 'Trailer',
    transitTime: 2,
    amount: 110000,
    price: 110000,
    status: 'pending',
    createdAt: new Date().toISOString()
  }
];

export const fallbackNotifications = [
  {
    id: 301,
    senderId: 'system',
    receiverId: 'demo_shipper',
    roleType: 'shipper',
    type: 'NEW_LOAD',
    message: 'Welcome! Your demo loads are ready.',
    createdAt: new Date().toISOString(),
    read: false
  }
];

export const fallbackTracking = {
  tracking: {
    status: 'in_transit',
    eta: 'Tonight 11:30 PM',
    currentLocation: [28.4, 70.3]
  },
  history: [
    { event: 'Picked up', time: 'Today 8:15 AM', location: 'Lahore' },
    { event: 'In transit', time: 'Today 12:40 PM', location: 'Near Sukkur' }
  ],
  liveTrackingMap: {
    coordinates: [
      [31.5204, 74.3587],
      [30.2, 71.5],
      [28.4, 70.3],
      [24.8607, 67.0011]
    ]
  }
};

