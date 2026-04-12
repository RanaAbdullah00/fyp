import React, { useMemo } from 'react';
import StatsCards from '../../components/dashboard/StatsCards.jsx';
import ActivityFeed from '../../components/dashboard/ActivityFeed.jsx';
import AnalyticsChart from '../../components/dashboard/AnalyticsChart.jsx';
import LoadList from '../../components/loadboard/LoadList.jsx';
import { useState, useEffect } from 'react';
import { useApi } from '../../hooks/useApi.js';
import { useAuth } from '../../hooks/useAuth.js';
import { useLanguage } from '../../hooks/useLanguage.js';
import Loader from '../../components/ui/Loader.jsx';
import ActiveShipmentPanel from '../../components/dashboard/ActiveShipmentPanel.jsx';
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
      { label: 'Fleet vehicles', value: 12, subLabel: 'Registered' }
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
    upcoming != null
      ? ADVANCE_LABELS[currentCanon] || t('pages.pipeline.advance')
      : currentCanon === 'closed'
        ? t('pages.pipeline.closed')
        : t('pages.pipeline.delivered');
  const buttonLabel =
    upcoming != null
      ? `${t('pages.pipeline.advance')}: ${advanceLabel}`
      : currentCanon === 'closed'
        ? t('pages.pipeline.closed')
        : t('pages.pipeline.delivered');

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
        <ActiveShipmentPanel
          trackingData={trackingData}
          loadingTracking={loadingTracking}
          emptyState={
            <div className="text-center py-5 px-3 tp-empty-state rounded-3 border border-dashed text-muted">
              <FaTruck className="fs-1 text-muted mb-3" />
              <h6 className="mb-2">No assigned shipments</h6>
              <p className="small mb-0">Check loads and bids for new assignments.</p>
            </div>
          }
          carrierAdvance={{
            title: 'Update status',
            loadingStatus,
            onAdvance: updateShipmentStatus,
            upcoming,
            buttonLabel,
            statusLine: `Current: ${String(trackingData?.tracking?.status || '—')
              .replaceAll('_', ' ')
              .replace(/\b\w/g, (c) => c.toUpperCase())}`
          }}
        />
      </div>
    </div>
  );
};

export default CarrierDashboard;

