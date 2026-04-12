import React, { useMemo } from 'react';
import StatsCards from '../../components/dashboard/StatsCards.jsx';
import ActivityFeed from '../../components/dashboard/ActivityFeed.jsx';
import AnalyticsChart from '../../components/dashboard/AnalyticsChart.jsx';
import LoadList from '../../components/loadboard/LoadList.jsx';
import { useState, useEffect } from 'react';
import { useApi } from '../../hooks/useApi.js';
import { useAuth } from '../../hooks/useAuth.js';
import { useLanguage } from '../../hooks/useLanguage.js';
import TrackingMap from '../../components/shipment/TrackingMap.jsx';
import StatusBadge from '../../components/shipment/StatusBadge.jsx';
import StatusTimeline from '../../components/shipment/StatusTimeline.jsx';
import ShipmentProgressPipeline from '../../components/shipment/ShipmentProgressPipeline.jsx';
import Loader from '../../components/ui/Loader.jsx';
import Button from '../../components/ui/Button.jsx';
import { FaTruck } from 'react-icons/fa';
import { notifySuccess, notifyError } from '../../components/ui/ToastProvider.jsx';
import { normalizeTracking, normalizeLoads } from '../../adapters/normalize.js';
import { nextShipmentStatus, ADVANCE_LABELS, normalizeShipmentStatus } from '../../utils/shipmentStatus.js';
import { Link } from 'react-router-dom';

// Dashboard view tailored for carriers.
const CarrierDashboard = () => {
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
    { id: 1, message: 'Assigned to shipment PK-INV-004 (Karachi → Faisalabad).', time: '30 min ago' },
    { id: 2, message: 'Bid accepted for Load L-099.', time: '2 hrs ago' }
  ];

  const [month, setMonth] = useState('This month');
  const [openLoads, setOpenLoads] = useState([]);
  const [bidSummary, setBidSummary] = useState({ accepted: 0, pending: 0 });

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
      { label: 'Fleet vehicles', value: 12, subLabel: 'Demo count' }
    ],
    [metrics]
  );

  const chartData = useMemo(() => {
    const seed = Math.max(1, Math.min(8, metrics.accepted + 1));
    const base =
      month === 'Last month' ? [seed, seed, seed + 1, seed, seed + 1, seed, seed] : [seed, seed + 1, seed + 2, seed, seed + 1, seed + 2, seed];
    return ['Week 1', 'Week 2', 'Week 3', 'Week 4', 'Week 5', 'Week 6', 'Week 7'].map((n, i) => ({
      name: n,
      value: base[i]
    }));
  }, [month, metrics.accepted]);

  const [trackingData, setTrackingData] = useState(null);
  const [loadingTracking, setLoadingTracking] = useState(false);
  const [loadingStatus, setLoadingStatus] = useState(false);
  const { request } = useApi();

  useEffect(() => {
    (async () => {
      try {
        const [loadsRaw, bidsRaw] = await Promise.all([
          request({ method: 'GET', url: '/loads' }).catch(() => []),
          request({ method: 'GET', url: '/bids/mine' }).catch(() => [])
        ]);
        const loadsArr = normalizeLoads(Array.isArray(loadsRaw) ? loadsRaw : []);
        setOpenLoads(loadsArr.slice(0, 6));
        const bids = Array.isArray(bidsRaw) ? bidsRaw : [];
        setBidSummary({
          accepted: bids.filter((b) => String(b.status) === 'accepted').length,
          pending: bids.filter((b) => String(b.status) === 'pending').length
        });
      } catch {
        setOpenLoads([]);
      }
    })();
  }, [request]);

  const updateShipmentStatus = async (newStatus) => {
    setLoadingStatus(true);
    try {
      const updatedData = await request({
        method: 'PUT',
        url: '/shipments/1/status',
        data: { status: newStatus }
      });
      setTrackingData(normalizeTracking(updatedData));
      notifySuccess(`Status updated`);
    } catch (err) {
      notifyError(err?.message || 'Status update failed');
    } finally {
      setLoadingStatus(false);
    }
  };

  const currentCanon = normalizeShipmentStatus(trackingData?.tracking?.status) || 'posted';
  const upcoming = nextShipmentStatus(currentCanon);
  const advanceLabel =
    currentCanon === 'delivered' ? t('pages.pipeline.delivered') : ADVANCE_LABELS[currentCanon] || ADVANCE_LABELS.posted;

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
          <AnalyticsChart data={chartData} label="Weekly bidding activity" legend="Accepted loads (index)" />
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
                  <ShipmentProgressPipeline status={trackingData.tracking?.status} labels={pipelineLabels} />
                  <StatusBadge status={trackingData.tracking?.status || 'unknown'} size="lg" />
                  <h5 className="mt-2 mb-3">Update status</h5>
                  <div className="d-grid gap-2">
                    <Button
                      variant="primary"
                      className="py-2"
                      onClick={() => upcoming && updateShipmentStatus(upcoming)}
                      disabled={!upcoming || loadingStatus}
                    >
                      {upcoming ? `${t('pages.pipeline.advance')}: ${advanceLabel}` : t('pages.pipeline.delivered')}
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
          <div className="text-center py-5 px-3 tp-empty-state rounded-3 border border-dashed text-muted">
            <FaTruck className="fs-1 text-muted mb-3" />
            <h6 className="mb-2">No assigned shipments</h6>
            <p className="small mb-0">Check loads and bids for new assignments.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default CarrierDashboard;

