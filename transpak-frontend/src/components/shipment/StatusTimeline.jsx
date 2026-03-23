import React from 'react';
import Card from '../ui/Card.jsx';
import StatusBadge from './StatusBadge.jsx';

// Mobile-friendly shipment status timeline.
// In production this can be driven by /tracking events.
const StatusTimeline = ({ currentStatus, events }) => {
  return (
    <Card>
      <div className="d-flex justify-content-between align-items-center mb-2">
        <h6 className="mb-0">Status timeline</h6>
        <StatusBadge status={currentStatus} />
      </div>
      <ul className="list-unstyled small mb-0 tp-timeline">
        {events.map((e, idx) => (
          <li key={`${e.label}-${idx}`} className="tp-timeline-item">
            <div className={`tp-timeline-dot ${e.done ? 'done' : ''}`} />
            <div className="tp-timeline-content">
              <div className="fw-semibold">{e.label}</div>
              <div className="text-muted">{e.time}</div>
              {e.note && <div className="text-muted">{e.note}</div>}
            </div>
          </li>
        ))}
      </ul>
    </Card>
  );
};

export default StatusTimeline;

