import React, { useMemo } from 'react';
import StatsCards from '../../components/dashboard/StatsCards.jsx';
import ActivityFeed from '../../components/dashboard/ActivityFeed.jsx';
import AnalyticsChart from '../../components/dashboard/AnalyticsChart.jsx';
import LoadList from '../../components/loadboard/LoadList.jsx';
import { useState, useEffect } from 'react';
import { useApi } from '../../hooks/useApi.js';
import { useAuth } from '../../hooks/useAuth.js';
import ActiveShipmentPanel from '../../components/dashboard/ActiveShipmentPanel.jsx';
import { FaTruck } from 'react-icons/fa';
import { normalizeLoads } from '../../adapters/normalize.js';
import { Link } from 'react-router-dom';
// Dashboard view tailored for carriers.
const CarrierDashboard = () => {
  const { user } = useAuth();
  const profileComplete = user?.profileComplete === true;
  const activities = [];

  const [month, setMonth] = useState('This month');
  const [openLoads, setOpenLoads] = useState([]);
  const [bidSummary, setBidSummary] = useState({ accepted: 0, pending: 0 });
  const [fleetCount, setFleetCount] = useState(0);

  const metrics = useMemo(() => {
    const open = openLoads.length;
    const accepted = bidSummary.accepted;
    const pending = bidSummary.pending;
    return { open, accepted, pending };
  }, [openLoads, bidSummary]);

  const stats = useMemo(
    () => [
      { label: 'Open marketplace loads', value: metrics.open },
      { label: 'Accepted bids', value: metrics.accepted },
      { label: 'Pending bids', value: metrics.pending },
      { label: 'Fleet vehicles', value: fleetCount, subLabel: 'Registered' }
    ],
    [metrics, fleetCount]
  );

  const chartData = useMemo(() => {
    // We avoid synthetic charts; show data only when bids exist.
    const windowWeeks = 4;
    if (!metrics.accepted && !metrics.pending) return [];
    return Array.from({ length: windowWeeks }, (_, i) => ({ name: `Week ${i + 1}`, value: 0 }));
  }, [metrics.accepted, metrics.pending]);

  const [trackingData] = useState(null);
  const [loadingTracking] = useState(false);
  const { request } = useApi();

  useEffect(() => {
    (async () => {
      try {
        const [loadsRaw, bidsRaw, trucksRaw] = await Promise.all([
          request({ method: 'GET', url: '/loads' }).catch(() => []),
          request({ method: 'GET', url: '/bids/mine' }).catch(() => []),
          request({ method: 'GET', url: '/trucks/mine' }).catch(() => [])
        ]);
        const loadsArr = normalizeLoads(Array.isArray(loadsRaw) ? loadsRaw : []);
        setOpenLoads(loadsArr.slice(0, 6));
        const bids = Array.isArray(bidsRaw) ? bidsRaw : [];
        setBidSummary({
          accepted: bids.filter((b) => String(b.status) === 'accepted').length,
          pending: bids.filter((b) => String(b.status) === 'pending').length
        });
        setFleetCount(Array.isArray(trucksRaw) ? trucksRaw.length : 0);
      } catch {
        setOpenLoads([]);
        setFleetCount(0);
      }
    })();
  }, [request]);
  // Tracking and status updates happen on the Shipment Tracking screen with a real reference/id.

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
          <AnalyticsChart
            data={chartData}
            label="Weekly bidding activity"
            legend="Accepted bids"
            emptyHint="Place bids to build your activity trend."
          />
        </div>
        <div className="col-12 col-lg-6">
          <ActivityFeed activities={activities} />
        </div>
      </div>
      <div className="mt-3">
        <div className="d-flex justify-content-between align-items-center mb-1">
          <h6 className="mb-0">Recommended loads</h6>
        </div>
        <LoadList loads={openLoads} />
      </div>
      <div className="mt-4">
        <div className="d-flex justify-content-between align-items-center mb-3">
          <h6 className="mb-0">My Assigned Shipments</h6>
        </div>
        <ActiveShipmentPanel
          trackingData={trackingData}
          loadingTracking={loadingTracking}
          emptyState={
            <div className="text-center py-5 px-3 tp-empty-state rounded-3 border border-dashed text-muted">
              <FaTruck className="fs-1 text-muted mb-3" />
              <h6 className="mb-2">No assigned shipments</h6>
              <p className="small mb-0">When a shipper accepts your bid, the shipment will appear here.</p>
            </div>
          }
        />
      </div>
    </div>
  );
};

export default CarrierDashboard;

