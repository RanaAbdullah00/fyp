import React, { useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import TrackingMap from '../../components/shipment/TrackingMap.jsx';
import RouteInfo from '../../components/shipment/RouteInfo.jsx';
import ShipmentCard from '../../components/shipment/ShipmentCard.jsx';
import StatusTimeline from '../../components/shipment/StatusTimeline.jsx';
import ShipmentProgressBox from '../../components/shipment/ShipmentProgressBox.jsx';
import api from '../../services/api.js';
import { normalizeTracking } from '../../adapters/normalize.js';
import { AppContext } from '../../context/AppContext.jsx';

const ShipmentTracking = () => {
  const { trackId } = useParams();
  const id = trackId || '1';
  const app = useContext(AppContext);

  const [payload, setPayload] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.get(`/shipments/track/${encodeURIComponent(id)}`);
      const raw = res?.data;
      setPayload(normalizeTracking(raw) || null);
    } catch (e) {
      setError(e?.response?.data?.message || e?.message || 'Failed to load tracking');
      setPayload(null);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const reg = app?.registerTrackingHandler;
    if (!reg) return undefined;
    return reg((p) => {
      if (!p || (p.refKey != null && String(p.refKey) !== String(id))) return;
      setPayload((prev) => {
        const merged = {
          tracking: { ...(prev?.tracking || {}), ...(p.tracking || {}) },
          history: Array.isArray(p.history) ? p.history : prev?.history || [],
          liveTrackingMap: p.liveTrackingMap || prev?.liveTrackingMap || { coordinates: [] }
        };
        return normalizeTracking(merged);
      });
    });
  }, [app, id]);

  const tracking = payload?.tracking;
  const coords = useMemo(() => {
    const raw = payload?.liveTrackingMap?.coordinates || [];
    return raw.filter(
      (c) =>
        Array.isArray(c) &&
        c.length >= 2 &&
        Number.isFinite(Number(c[0])) &&
        Number.isFinite(Number(c[1]))
    ).map((c) => [Number(c[0]), Number(c[1])]);
  }, [payload?.liveTrackingMap?.coordinates]);
  const currentLocation =
    tracking?.currentLocation ??
    (Array.isArray(tracking?.location) &&
    tracking.location.length >= 2 &&
    Number.isFinite(Number(tracking.location[0])) &&
    Number.isFinite(Number(tracking.location[1]))
      ? [Number(tracking.location[0]), Number(tracking.location[1])]
      : null);

  const shipment = useMemo(
    () => ({
      code: `#${id}`,
      origin: '—',
      destination: '—',
      status: tracking?.status || 'posted',
      driverName: '—',
      vehicleReg: '—',
      eta: tracking?.eta || '—',
      lastUpdate: payload?.history?.[0]?.time || '—'
    }),
    [id, tracking, payload?.history]
  );

  const timelineEvents = useMemo(() => {
    const h = payload?.history || [];
    return h.map((ev) => ({
      label: ev.event || ev.label || 'Update',
      time: ev.time || '',
      done: true,
      note: ev.location
    }));
  }, [payload?.history]);

  const checkpoints = useMemo(() => {
    if (coords.length >= 2) return coords.map((_, i) => `Point ${i + 1}`);
    if (coords.length === 1) return ['Last reported position'];
    return [];
  }, [coords]);

  const trackingDataForMap = useMemo(
    () => ({
      tracking: {
        status: tracking?.status,
        eta: tracking?.eta,
        currentLocation,
        locationUnavailable: tracking?.locationUnavailable
      },
      liveTrackingMap: payload?.liveTrackingMap || { coordinates: coords }
    }),
    [tracking, currentLocation, payload?.liveTrackingMap, coords]
  );

  if (loading && !payload) {
    return (
      <div className="container py-3">
        <h5 className="mb-3">Shipment tracking</h5>
        <p className="small text-muted">Loading…</p>
      </div>
    );
  }

  if (error && !payload) {
    return (
      <div className="container py-3">
        <h5 className="mb-3">Shipment tracking</h5>
        <p className="text-danger small">{error}</p>
      </div>
    );
  }

  return (
    <div className="container py-3">
      <h5 className="mb-3">Shipment tracking</h5>
      {error ? <p className="text-warning small mb-2">{error}</p> : null}
      <ShipmentCard shipment={shipment} />
      <div className="tp-tracking-progress mb-3">
        <ShipmentProgressBox status={shipment.status} eta={shipment.eta} />
      </div>
      <div className="tp-tracking-map mb-3 overflow-hidden">
        <TrackingMap trackingData={trackingDataForMap} currentLocation={currentLocation} />
      </div>
      <StatusTimeline currentStatus={shipment.status} events={timelineEvents} />
      <RouteInfo distance={null} duration={null} checkpoints={checkpoints} />
    </div>
  );
};

export default ShipmentTracking;
