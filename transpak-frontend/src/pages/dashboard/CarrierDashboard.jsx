import React, { useMemo } from 'react';
import StatsCards from '../../components/dashboard/StatsCards.jsx';
import ActivityFeed from '../../components/dashboard/ActivityFeed.jsx';
import AnalyticsChart from '../../components/dashboard/AnalyticsChart.jsx';
import LoadList from '../../components/loadboard/LoadList.jsx';
import { useState, useEffect } from 'react';
import { useApi } from '../../hooks/useApi.js';
import { useAuth } from '../../hooks/useAuth.js';
import TrackingMap from '../../components/shipment/TrackingMap.jsx';
import StatusBadge from '../../components/shipment/StatusBadge.jsx';
import StatusTimeline from '../../components/shipment/StatusTimeline.jsx';
import Loader from '../../components/ui/Loader.jsx';
import Button from '../../components/ui/Button.jsx';
import { FaTruck } from 'react-icons/fa';
import { notifySuccess, notifyError } from '../../components/ui/ToastProvider.jsx';
import { normalizeTracking } from '../../adapters/normalize.js';
import { Link } from 'react-router-dom';

// Dashboard view tailored for carriers.
const CarrierDashboard = () => {
  const { user } = useAuth();
  const profileComplete = user?.profileComplete === true;
  const stats = [
    { label: 'Active loads', value: 3 },
    { label: 'Bids pending', value: 5 },
    { label: 'Fleet vehicles', value: 12 },
    { label: 'Earnings (PKR)', value: '3.1M', subLabel: 'Last 30 days' }
  ];

  const activities = [
    { id: 1, message: 'Assigned to shipment PK-INV-004 (Karachi → Faisalabad).', time: '30 min ago' },
    { id: 2, message: 'Bid accepted for Load L-099.', time: '2 hrs ago' }
  ];

  const [month, setMonth] = useState('This month');
  const chartData = useMemo(() => {
    const base = month === 'Last month' ? [1, 2, 3, 2, 3, 2, 1] : [2, 3, 4, 2, 5, 3, 1];
    return ['W1', 'W2', 'W3', 'W4', 'W5', 'W6', 'W7'].map((n, i) => ({ name: n, value: base[i] }));
  }, [month]);

  const loads = [
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

  const [trackingData, setTrackingData] = useState(null);
  const [loadingTracking, setLoadingTracking] = useState(false);
  const [loadingStatus, setLoadingStatus] = useState(false);
  const { request } = useApi();

  const updateShipmentStatus = async (newStatus) => {
    setLoadingStatus(true);
    try {
      const updatedData = await request({
        method: 'PUT',
        url: '/shipments/1/status',
        data: { status: newStatus }
      });
      setTrackingData(updatedData);
      notifySuccess(`Status updated to ${newStatus.replace('_', ' ')}`);
    } catch (err) {
      notifyError('Status update failed');
    } finally {
      setLoadingStatus(false);
    }
  };

  useEffect(() => {
    const fetchTracking = async () => {
      setLoadingTracking(true);
      try {
        const data = await request({
          url: '/shipments/track/1'
        });
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
        <h5 className="mb-0">Carrier dashboard</h5>
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
          <AnalyticsChart data={chartData} label="Monthly accepted loads" />
        </div>
        <div className="col-12 col-lg-6">
          <ActivityFeed activities={activities} />
        </div>
      </div>
      <div className="mt-3">
        <div className="d-flex justify-content-between align-items-center mb-1">
          <h6 className="mb-0">Recommended loads</h6>
        </div>
        <LoadList loads={loads} />
      </div>
      <div className="mt-4">
        <div className="d-flex justify-content-between align-items-center mb-3">
          <h6 className="mb-0">My Assigned Shipments</h6>
        </div>
        {loadingTracking ? (
          <div className="text-center py-4">
            <Loader />
          </div>
        ) : trackingData ? (
          <div className="card shadow-sm mb-4">
            <div className="card-body">
              <div className="row g-3">
                <div className="col-lg-8">
                  <TrackingMap 
                    trackingData={trackingData}
                    origin={[31.5204, 74.3587]} 
                    destination={[24.8607, 67.0011]} 
                  />
                </div>
                <div className="col-lg-4">
                  <StatusBadge status={trackingData.tracking?.status || 'unknown'} size="lg" />
                  <h5 className="mt-2 mb-3">Update Status</h5>
                  
                  <div className="d-grid gap-2">
                    <Button 
                      variant="outline-primary" 
                      className="py-2"
                      onClick={() => updateShipmentStatus('picked_up')}
                      disabled={trackingData?.tracking?.status === 'in_transit' || loadingStatus}
                    >
                      Load Picked Up
                    </Button>
                    <Button 
                      variant="primary" 
                      className="py-2"
                      onClick={() => updateShipmentStatus('in_transit')}
                      disabled={trackingData?.tracking?.status === 'delivered' || loadingStatus}
                    >
                      In Transit
                    </Button>
                    <Button 
                      variant="success" 
                      className="py-2"
                      onClick={() => updateShipmentStatus('delivered')}
                      disabled={trackingData?.tracking?.status !== 'in_transit' || loadingStatus}
                    >
                      Mark Delivered
                    </Button>
                  </div>
                  <small className="text-muted mt-2">
                    Current:{' '}
                    {String(trackingData?.tracking?.status || 'No shipment')
                      .replaceAll('_', ' ')
                      .replace(/\b\w/g, (c) => c.toUpperCase())}
                  </small>
                  
                  <div className="mt-4">
                    <StatusTimeline 
                      currentStatus={trackingData.tracking?.status} 
                      events={(trackingData.history || []).map(h => ({
                        label: h.event,
                        time: h.time,
                        note: h.location,
                        done: true
                      }))} 
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="text-center py-5">
            <div className="text-muted">
              <FaTruck className="fs-1 text-muted mb-3" />
              <h6>No assigned shipments</h6>
              <p className="small">Check loads and bids for new assignments.</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default CarrierDashboard;

