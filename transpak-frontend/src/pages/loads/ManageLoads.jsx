import React from 'react';
import { Link } from 'react-router-dom';
import Card from '../../components/ui/Card.jsx';
import Badge from '../../components/ui/Badge.jsx';
import Button from '../../components/ui/Button.jsx';

// Shipper screen to manage their posted loads (open/assigned/completed).
const ManageLoads = () => {
  const loads = [
    {
      id: 1,
      code: 'L-102',
      cargo: '20ft container · FMCG',
      origin: 'Lahore',
      destination: 'Karachi',
      status: 'open',
      bids: 7
    },
    {
      id: 2,
      code: 'L-099',
      cargo: 'Steel coils',
      origin: 'Karachi',
      destination: 'Islamabad',
      status: 'assigned',
      bids: 3
    }
  ];

  return (
    <div className="container py-3">
      <div className="d-flex justify-content-between align-items-center mb-3">
        <h5 className="mb-0">Manage loads</h5>
        <Link to="/loads/post">
          <Button variant="primary" className="btn-sm px-3 rounded-lg">
            + Post Load
          </Button>
        </Link>
      </div>

      {loads.length === 0 ? (
        <div className="text-center py-5 px-3 rounded-xl" style={{ background: 'var(--pak-light-green-bg)' }}>
          <p className="text-muted mb-2 fw-medium">No loads posted yet</p>
          <p className="small text-muted mb-3">Post your first load to receive bids from carriers.</p>
          <Link to="/loads/post">
            <Button variant="primary" className="rounded-lg">Post Load</Button>
          </Link>
        </div>
      ) : loads.map((l) => (
        <Card key={l.id}>
          <div className="d-flex justify-content-between align-items-start">
            <div>
              <h6 className="mb-1">{l.cargo}</h6>
              <div className="small text-muted">
                {l.code} · {l.origin} → {l.destination}
              </div>
            </div>
            <Badge
              variant={l.status === 'open' ? 'success' : l.status === 'assigned' ? 'warning' : 'secondary'}
            >
              {l.status}
            </Badge>
          </div>
          <div className="d-flex justify-content-between align-items-center mt-2">
            <small className="text-muted">{l.bids} bids</small>
            <div className="d-flex gap-2">
              <Button variant="outline-primary" className="btn-sm" onClick={() => alert('Demo')}>
                View
              </Button>
              <Button variant="outline-secondary" className="btn-sm" onClick={() => alert('Demo')}>
                Edit
              </Button>
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
};

export default ManageLoads;

