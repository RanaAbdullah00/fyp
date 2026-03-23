import { http, HttpResponse } from 'msw';

// Mock handlers for TransPak APIs
// Matches existing mock data structure

const mockLoads = [
  {
    id: 1,
    code: 'L-102',
    cargo: '20ft container · FMCG',
    origin: 'Lahore',
    destination: 'Karachi',
    weight: 18,
    vehicleType: 'Trailer',
    distance: 1240,
    expectedPrice: 120000,
    pickupDate: 'Today',
    status: 'open'
  },
  {
    id: 2,
    code: 'L-103',
    cargo: 'Bulk cement',
    origin: 'DG Khan',
    destination: 'Lahore',
    weight: 22,
    vehicleType: 'Truck',
    distance: 380,
    expectedPrice: 90000,
    pickupDate: 'Tomorrow',
    status: 'open'
  }
];

const mockBids = [
  {
    id: 1,
    carrierName: 'PakTrans Logistics',
    amount: 83000,
    vehicleType: 'Container',
    transitTime: 1,
    status: 'pending',
    createdAt: '20 min ago'
  },
  {
    id: 2,
    carrierName: 'Alpha Carriers',
    amount: 80000,
    vehicleType: 'Trailer',
    transitTime: 2,
    status: 'accepted',
    createdAt: '1 hr ago'
  }
];

export const handlers = [
  // Loads API
  http.get('http://localhost:5000/api/loads', ({ request }) => {
    const url = new URL(request.url);
    const origin = url.searchParams.get('origin') || '';
    const destination = url.searchParams.get('destination') || '';
    const vehicleType = url.searchParams.get('vehicleType') || '';

    const filtered = mockLoads.filter((load) => {
      const matchesOrigin = load.origin.toLowerCase().includes(origin.toLowerCase());
      const matchesDest = load.destination.toLowerCase().includes(destination.toLowerCase());
      const matchesVehicle = load.vehicleType === vehicleType;
      return matchesOrigin && matchesDest && matchesVehicle;
    });

    return HttpResponse.json(filtered);
  }),

  http.post('http://localhost:5000/api/loads', async ({ request }) => {
    const newLoad = await request.json();
    const load = {
      id: Date.now(),
      code: `L-${Date.now().toString().slice(-4)}`,
      status: 'open',
      deadline: new Date(Date.now() + parseInt(newLoad.deadlineHours) * 60 * 60 * 1000).toISOString(),
      bids: [],
      ...newLoad
    };
    mockLoads.unshift(load);
    return HttpResponse.json(load);
  }),

  // Bids API
  http.get('http://localhost:5000/api/bids', () => {
    return HttpResponse.json(mockBids);
  }),

  http.post('http://localhost:5000/api/bids', async ({ request }) => {
    const newBid = await request.json();
    // Check duplicate
    const duplicate = mockBids.find(b => b.loadId === newBid.loadId && b.carrierId === newBid.carrierId);
    if (duplicate) {
      return new HttpResponse('Duplicate bid not allowed', { status: 409 });
    }
    const bid = {
      ...newBid,
      id: Date.now(),
      status: 'pending',
      carrierName: newBid.carrierName || 'Demo Carrier',
      createdAt: newBid.createdAt || new Date().toISOString()
    };
    mockBids.unshift(bid);
    return HttpResponse.json(bid);
  }),

  // Accept/Reject bid
  http.put('http://localhost:5000/api/bids/:id/accept', ({ params, request }) => {
    const bidId = Number(params.id);
    const bid = mockBids.find(b => b.id === bidId);
    if (bid) {
      bid.status = 'accepted';
      return HttpResponse.json(bid);
    }
    return new HttpResponse(null, { status: 404 });
  }),

  http.put('http://localhost:5000/api/bids/:id/reject', ({ params }) => {
    const bidId = Number(params.id);
    const bidIndex = mockBids.findIndex(b => b.id === bidId);
    if (bidIndex > -1) {
      mockBids.splice(bidIndex, 1);
      return HttpResponse.json({ status: 'rejected' });
    }
    return new HttpResponse(null, { status: 404 });
  }),

// Update shipment status (carrier)
  http.put('http://localhost:5000/api/shipments/:id/status', ({ params, request }) => {
    const shipmentId = Number(params.id);
    const { status } = request.json(); // Fix: no await
    
    // Simulate status progression
    const mockTrackingData = {
      tracking: {
        status,
        currentLocation: status === 'delivered' ? [24.8607, 67.0011] : [27.5, 68.5],
        eta: status === 'delivered' ? 'Delivered' : 'Tonight 11:30 PM',
        lastUpdate: new Date().toLocaleTimeString()
      },
      history: [
        { event: 'Picked up', time: 'Today 8:15 AM', location: 'Lahore', done: true },
        { event: 'Passed checkpoint', time: 'Today 12:40 PM', location: 'Near Sukkur', done: true },
        { event: status.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase()), time: new Date().toLocaleTimeString(), done: true }
      ],
      liveTrackingMap: {
        coordinates: [
          [31.5204, 74.3587],
          [28, 75],
          [27.5, 68.5],
          [24.8607, 67.0011]
        ]
      }
    };
    
    return HttpResponse.json(mockTrackingData);
  }),

  // Shipments tracking API
  http.get('http://localhost:5000/api/shipments/track/:id', ({ params }) => {
    return HttpResponse.json({
      tracking: {
        status: 'in_transit',
        currentLocation: [27.5, 68.5],
        eta: 'Tonight 11:30 PM',
        lastUpdate: '5 min ago'
      },
      history: [
        { event: 'Picked up', time: 'Today 8:15 AM', location: 'Lahore' },
        { event: 'Passed checkpoint', time: 'Today 12:40 PM', location: 'Near Sukkur' }
      ],
      liveTrackingMap: {
        coordinates: [
          [31.5204, 74.3587],
          [28, 75],
          [27.5, 68.5],
          [24.8607, 67.0011]
        ]
      }
    });
  })
];

