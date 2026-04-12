import React, { useMemo, useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth.js';
import { useApi } from '../../hooks/useApi.js';
import { useLanguage } from '../../hooks/useLanguage.js';
import StatsCards from '../../components/dashboard/StatsCards.jsx';
import ActivityFeed from '../../components/dashboard/ActivityFeed.jsx';
import AnalyticsChart from '../../components/dashboard/AnalyticsChart.jsx';
import LoadList from '../../components/loadboard/LoadList.jsx';
import TrackingMap from '../../components/shipment/TrackingMap.jsx';
import StatusBadge from '../../components/shipment/StatusBadge.jsx';
import StatusTimeline from '../../components/shipment/StatusTimeline.jsx';
import ShipmentProgressPipeline from '../../components/shipment/ShipmentProgressPipeline.jsx';
import Loader from '../../components/ui/Loader.jsx';
import { normalizeTracking, normalizeLoads } from '../../adapters/normalize.js';

// Dashboard view tailored for shippers.
const ShipperDashboard = () => {
  const { user } = useAuth();
  const { t } = useLanguage();
  const profileComplete = user?.profileComplete === true;
  const pipelineLabels = useMemo(
    () => [
      t('pages.pipeline.posted'),
      t('pages.pipeline.booked'),
      t('pages.pipeline.picked'),
      t('pages.pipeline.transit'),
      t('pages.pipeline.delivered')
    ],
    [t]
  );

  const activities = [
    { id: 1, message: 'Carrier ABC Logistics delivered PK-INV-001.', time: '10 min ago' },
    { id: 2, message: 'New bid on Load L-102 from PakTrans.', time: '45 min ago' }
  ];

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
    const seed = Math.max(1, Math.min(8, Math.round(metrics.total / 2) + 1));
    const base =
      month === 'Last month'
        ? [seed, seed + 1, seed, seed + 2, seed, seed + 1, seed]
        : [seed + 1, seed + 2, seed, seed + 3, seed + 1, seed + 2, seed];
    return ['Week 1', 'Week 2', 'Week 3', 'Week 4', 'Week 5', 'Week 6', 'Week 7'].map((n, i) => ({
      name: n,
      value: base[i]
    }));
  }, [month, metrics.total]);

  const openLoads = useMemo(() => mineLoads.filter((l) => l.status === 'open'), [mineLoads]);

  const [trackingData, setTrackingData] = useState(null);
  const [loadingTracking, setLoadingTracking] = useState(false);
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
          <AnalyticsChart data={chartData} label="Weekly load activity (trend)" legend="Loads (index)" />
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
              <ShipmentProgressPipeline status={trackingData.tracking?.status} labels={pipelineLabels} />
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
          <div className="text-muted text-center py-5 px-3 tp-empty-state rounded-3 border border-dashed">
            <div className="fw-semibold mb-1">No active shipments</div>
            <div className="small">Post a load or wait for carrier assignment to see tracking here.</div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ShipperDashboard;

