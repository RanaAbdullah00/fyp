import React, { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth.js';
import { useApi } from '../../hooks/useApi.js';
import StatsCards from '../../components/dashboard/StatsCards.jsx';
import ActivityFeed from '../../components/dashboard/ActivityFeed.jsx';
import AnalyticsChart from '../../components/dashboard/AnalyticsChart.jsx';
import LoadList from '../../components/loadboard/LoadList.jsx';
import ActiveShipmentPanel from '../../components/dashboard/ActiveShipmentPanel.jsx';
import { normalizeLoads } from '../../adapters/normalize.js';

// Dashboard view tailored for shippers.
const ShipperDashboard = () => {
  const { user } = useAuth();
  const profileComplete = user?.profileComplete === true;
  const activities = [];

  const [month, setMonth] = useState('This month');
  const [mineLoads, setMineLoads] = useState([]);

  const metrics = useMemo(() => {
    const list = mineLoads;
    const total = list.length;
    const active = list.filter((l) => ['open', 'assigned', 'in_transit'].includes(l.status)).length;
    const done = list.filter((l) => l.status === 'delivered').length;
    const rev = list.filter((l) => l.status === 'delivered').reduce((s, l) => s + Number(l.expectedPrice || 0), 0);
    return { total, active, done, rev };
  }, [mineLoads]);

  const stats = useMemo(
    () => [
      { label: 'Total loads', value: metrics.total },
      { label: 'Active shipments', value: metrics.active },
      { label: 'Completed deliveries', value: metrics.done },
      {
        label: 'Delivered value (PKR)',
        value: metrics.rev ? metrics.rev.toLocaleString() : '0',
        subLabel: 'Sum of delivered loads'
      }
    ],
    [metrics]
  );

  const chartData = useMemo(() => {
    const loads = Array.isArray(mineLoads) ? mineLoads : [];
    if (!loads.length) return [];
    const now = new Date();
    const weekMs = 7 * 24 * 60 * 60 * 1000;
    const windowWeeks = 4;
    const from = new Date(now.getTime() - windowWeeks * weekMs);
    const buckets = Array.from({ length: windowWeeks }, (_, i) => ({
      name: `Week ${i + 1}`,
      value: 0
    }));
    for (const l of loads) {
      const dt = l?.createdAt ? new Date(l.createdAt) : null;
      if (!dt || Number.isNaN(dt.getTime()) || dt < from) continue;
      const idx = Math.min(windowWeeks - 1, Math.max(0, Math.floor((dt.getTime() - from.getTime()) / weekMs)));
      buckets[idx].value += 1;
    }
    return buckets;
  }, [mineLoads]);

  const openLoads = useMemo(() => mineLoads.filter((l) => l.status === 'open'), [mineLoads]);

  const [trackingData] = useState(null);
  const [loadingTracking] = useState(false);
  const { request } = useApi();

  useEffect(() => {
    (async () => {
      try {
        const data = await request({ method: 'GET', url: '/loads/mine' });
        setMineLoads(normalizeLoads(Array.isArray(data) ? data : []));
      } catch {
        setMineLoads([]);
      }
    })();
  }, [request]);

  // Tracking data is shown on the Shipment Tracking screen where a real reference/id is provided.

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
          <AnalyticsChart
            data={chartData}
            label="Weekly load activity"
            legend="Loads"
            emptyHint="Post loads to build your weekly activity trend."
          />
        </div>
        <div className="col-12 col-lg-6">
          <ActivityFeed activities={activities} />
        </div>
      </div>
      <div className="mt-3">
        <div className="d-flex justify-content-between align-items-center mb-1">
          <h6 className="mb-0">Open loads</h6>
        </div>
        <LoadList loads={openLoads.length ? openLoads : mineLoads.slice(0, 5)} />
      </div>
      <div className="mt-4">
        <div className="d-flex justify-content-between align-items-center mb-3">
          <h6 className="mb-0">My Active Shipments</h6>
        </div>
        <ActiveShipmentPanel
          trackingData={trackingData}
          loadingTracking={loadingTracking}
          emptyState={
            <div className="text-muted text-center py-5 px-3 tp-empty-state rounded-3 border border-dashed">
              <div className="fw-semibold mb-1">No active shipments</div>
              <div className="small">Accept a carrier bid to start shipment tracking.</div>
            </div>
          }
        />
      </div>
    </div>
  );
};

export default ShipperDashboard;

