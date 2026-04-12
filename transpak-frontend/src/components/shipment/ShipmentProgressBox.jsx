import React, { useMemo } from 'react';
import Card from '../ui/Card.jsx';
import {
  SHIPMENT_ORDER,
  normalizeShipmentStatus,
  nextShipmentStatus
} from '../../utils/shipmentStatus.js';

const PRETTY = {
  posted: 'Posted',
  booked: 'Booked',
  pickedup: 'Picked up',
  intransit: 'In transit',
  delivered: 'Delivered'
};

const ShipmentProgressBox = ({ status, eta, mapHint, labels }) => {
  const cur = normalizeShipmentStatus(status) || 'posted';
  const idx = Math.max(0, SHIPMENT_ORDER.indexOf(cur));
  const next = nextShipmentStatus(cur);
  const labelList =
    labels ||
    SHIPMENT_ORDER.map((k) => PRETTY[k] || k);

  const filled = useMemo(() => idx + 1, [idx]);

  return (
    <Card className="tp-progress-box mb-3 mb-lg-0">
      <div className="small text-muted text-uppercase mb-1">Shipment progress</div>
      <h3 className="h4 fw-bold text-success mb-1">{PRETTY[cur] || cur}</h3>
      <div className="small text-muted mb-2">
        {next ? (
          <>
            Next: <span className="fw-semibold text-body">{PRETTY[next]}</span>
          </>
        ) : (
          <span className="fw-semibold text-body">Final stage reached</span>
        )}
      </div>
      {eta && <div className="small mb-2">ETA: {eta}</div>}
      {mapHint != null && (
        <div className="small text-muted mb-3">
          Map:{' '}
          {Array.isArray(mapHint)
            ? `Near ${Number(mapHint[0]).toFixed(2)}°, ${Number(mapHint[1]).toFixed(2)}°`
            : String(mapHint)}
        </div>
      )}
      <div className="d-flex gap-1 mb-2" role="progressbar" aria-valuenow={filled} aria-valuemin={0} aria-valuemax={5}>
        {SHIPMENT_ORDER.map((step, i) => (
          <div
            key={step}
            className={`flex-grow-1 rounded-pill tp-progress-seg ${i < filled ? 'tp-progress-seg--on' : ''}`}
            style={{ height: 8 }}
            title={labelList[i] || step}
          />
        ))}
      </div>
      <div className="d-flex justify-content-between small text-muted">
        {labelList.map((lbl, i) => (
          <span key={lbl} className={`text-truncate px-0 ${i === idx ? 'fw-bold text-success' : ''}`} style={{ maxWidth: '20%' }}>
            {lbl}
          </span>
        ))}
      </div>
    </Card>
  );
};

export default ShipmentProgressBox;
