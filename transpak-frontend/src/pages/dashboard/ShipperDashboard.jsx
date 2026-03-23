import React, { useMemo, useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth.js';
import { useApi } from '../../hooks/useApi.js';
import StatsCards from '../../components/dashboard/StatsCards.jsx';
import ActivityFeed from '../../components/dashboard/ActivityFeed.jsx';
import AnalyticsChart from '../../components/dashboard/AnalyticsChart.jsx';
import LoadList from '../../components/loadboard/LoadList.jsx';
import TrackingMap from '../../components/shipment/TrackingMap.jsx';
import StatusBadge from '../../components/shipment/StatusBadge.jsx';
import StatusTimeline from '../../components/shipment/StatusTimeline.jsx';
import Loader from '../../components/ui/Loader.jsx';
import { normalizeTracking } from '../../adapters/normalize.js';

// Dashboard view tailored for shippers.
const ShipperDashboard = () => {
  const { user } = useAuth();
  const profileComplete = user?.profileComplete === true;
  const stats = [
    { label: 'Active shipments', value: 4 },
    { label: 'Pending bids', value: 7 },
    { label: 'Completed', value: 26 },
    { label: 'Revenue (PKR)', value: '4.2M', subLabel: 'Last 30 days' }
  ];

  const activities = [
    { id: 1, message: 'Carrier ABC Logistics delivered PK-INV-001.', time: '10 min ago' },
    { id: 2, message: 'New bid on Load L-102 from PakTrans.', time: '45 min ago' }
  ];

  const [month, setMonth] = useState('This month');
  const chartData = useMemo(() => {
    const base = month === 'Last month' ? [2, 3, 2, 4, 3, 5, 2] : [3, 4, 2, 5, 4, 6, 3];
    return ['W1', 'W2', 'W3', 'W4', 'W5', 'W6', 'W7'].map((n, i) => ({ name: n, value: base[i] }));
  }, [month]);

  const loads = [
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
    }
  ];

  const [trackingData, setTrackingData] = useState(null);
  const [loadingTracking, setLoadingTracking] = useState(false);
  const { request } = useApi();

  useEffect(() => {
    const fetchTracking = async () => {
      setLoadingTracking(true);
      try {
        const data = await request({ url: '/shipments/track/1' });
        setTrackingData(normalizeTracking(data));
      } catch (err) {
        console.error('Tracking fetch failed:', err);
      } finally {
        setLoadingTracking(false);
      }
    };
    fetchTracking();
  }, [request]);

  return (
    <div className="container py-3">
      <div className="d-flex justify-content-between align-items-center mb-3 flex-wrap gap-2">
        <h5 className="mb-0">Shipper dashboard</h5>
        <div className="d-flex gap-2 flex-wrap">
          {!profileComplete && (
            <Link to="/profile" className="btn btn-warning btn-sm rounded-lg">Incomplete Profile</Link>
          )}
        </div>
      </div>
      <StatsCards stats={stats} />
      <div className="mt-3 row g-2">
        <div className="col-12 col-lg-6">
          <div className="d-flex justify-content-between align-items-center mb-1">
            <div className="small text-muted">Monthly view</div>
            <select className="form-select form-select-sm w-auto" value={month} onChange={(e) => setMonth(e.target.value)}>
              <option>This month</option>
              <option>Last month</option>
            </select>
          </div>
          <AnalyticsChart data={chartData} label="Monthly shipments" />
        </div>
        <div className="col-12 col-lg-6">
          <ActivityFeed activities={activities} />
        </div>
      </div>
      <div className="mt-3">
        <div className="d-flex justify-content-between align-items-center mb-1">
          <h6 className="mb-0">Open loads</h6>
        </div>
        <LoadList loads={loads} />
      </div>
      <div className="mt-4">
        <div className="d-flex justify-content-between align-items-center mb-3">
          <h6 className="mb-0">My Active Shipments</h6>
        </div>
        {loadingTracking ? (
          <div className="text-center py-4">
            <Loader />
          </div>
        ) : trackingData ? (
          <div className="row g-3">
            <div className="col-12 col-lg-8">
              <TrackingMap 
                trackingData={trackingData}
                origin={[31.5204, 74.3587]} 
                destination={[24.8607, 67.0011]} 
              />
            </div>
            <div className="col-12 col-lg-4">
              <div className="mb-3">
                <StatusBadge status={trackingData.tracking?.status || 'unknown'} />
                <h6 className="mt-2 mb-2">
                  Status: {String(trackingData.tracking?.status || 'N/A').replaceAll('_', ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
                </h6>
                <small className="text-muted">ETA: {trackingData.tracking?.eta || 'N/A'}</small>
              </div>
              {trackingData.history?.length > 0 ? (
                <StatusTimeline 
                  currentStatus={trackingData.tracking?.status} 
                  events={trackingData.history.map(h => ({
                    label: h.event,
                    time: h.time,
                    note: h.location,
                    done: true
                  }))} 
                />
              ) : (
                <div className="text-muted small text-center py-3">No history available</div>
              )}
            </div>
          </div>
        ) : (
          <div className="text-muted text-center py-4">No active shipments</div>
        )}
      </div>
    </div>
  );
};

export default ShipperDashboard;

