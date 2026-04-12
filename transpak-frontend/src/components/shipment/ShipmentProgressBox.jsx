import React from 'react';
import Card from '../ui/Card.jsx';
import { SHIPMENT_ORDER, normalizeShipmentStatus } from '../../utils/shipmentStatus.js';

const PRETTY = {
  posted: 'Posted',
  booked: 'Booked',
  pickedup: 'Picked up',
  intransit: 'In transit',
  delivered: 'Delivered',
  closed: 'Closed'
};

/** Horizontal lifecycle line: labels on the rail; done=green, current=yellow pulse, upcoming=white glow. */
const ShipmentProgressBox = ({ status, eta }) => {
  const cur = normalizeShipmentStatus(status) || 'posted';
  const idx = Math.max(0, SHIPMENT_ORDER.indexOf(cur));
  const n = SHIPMENT_ORDER.length;
  const fillPct = n <= 1 ? 0 : (idx / (n - 1)) * 100;

  const stepClass = (i) => {
    if (i < idx) return 'done';
    if (i === idx) return 'current';
    return 'upcoming';
  };

  return (
    <Card className="tp-progress-box mb-0 h-100">
      <div className="d-flex flex-wrap align-items-baseline justify-content-between gap-2 mb-3">
        <span className="small text-muted text-uppercase">Shipment</span>
        {eta ? <span className="small text-muted">{eta}</span> : null}
      </div>
      <div className="tp-progress-lane px-1">
        <div className="tp-progress-lane__labels d-flex justify-content-between gap-1">
          {SHIPMENT_ORDER.map((step, i) => (
            <div key={step} className="tp-progress-lane__label-cell flex-fill text-center">
              <span className={`tp-progress-lane__label tp-progress-lane__label--${stepClass(i)}`}>
                {PRETTY[step] || step}
              </span>
            </div>
          ))}
        </div>
        <div className="tp-progress-lane__bar-row position-relative mx-1 my-2">
          <div className="tp-progress-lane__bar-bg rounded-pill" />
          <div className="tp-progress-lane__bar-fill rounded-pill" style={{ width: `${fillPct}%` }} />
          <div className="tp-progress-lane__nodes d-flex justify-content-between align-items-center position-relative">
            {SHIPMENT_ORDER.map((step, i) => (
              <div
                key={step}
                className={`tp-progress-lane__node tp-progress-lane__node--${stepClass(i)}`}
                aria-hidden
              />
            ))}
          </div>
        </div>
      </div>
    </Card>
  );
};

export default ShipmentProgressBox;
