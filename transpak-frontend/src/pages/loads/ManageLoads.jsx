import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import Card from '../../components/ui/Card.jsx';
import Badge from '../../components/ui/Badge.jsx';
import Button from '../../components/ui/Button.jsx';
import Loader from '../../components/ui/Loader.jsx';
import { useApi } from '../../hooks/useApi.js';
import { notifyError } from '../../components/ui/ToastProvider.jsx';

// Shipper screen to manage their posted loads (open/assigned/completed).
const ManageLoads = () => {
  const { request, loading } = useApi();
  const [loads, setLoads] = useState([]);

  useEffect(() => {
    (async () => {
      try {
        const rows = await request({ url: '/loads/mine' });
        setLoads(Array.isArray(rows) ? rows : []);
      } catch (e) {
        notifyError(e?.response?.data?.message || 'Failed to load your loads');
        setLoads([]);
      }
    })();
  }, [request]);

  const normalizedLoads = useMemo(
    () =>
      loads.map((l) => ({
        id: l.id || l._id,
        code: l.code || '—',
        cargo: l.cargo || l.title || 'Load',
        origin: l.origin || '—',
        destination: l.destination || '—',
        status: l.status || 'open',
        bids: Number(l.bids || 0)
      })),
    [loads]
  );

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

      {loading ? (
        <div className="d-flex justify-content-center py-5">
          <Loader />
        </div>
      ) : normalizedLoads.length === 0 ? (
        <div className="text-center py-5 px-3 rounded-xl" style={{ background: 'var(--pak-light-green-bg)' }}>
          <p className="text-muted mb-2 fw-medium">No loads posted yet</p>
          <p className="small text-muted mb-3">Post your first load to receive bids from carriers.</p>
          <Link to="/loads/post">
            <Button variant="primary" className="rounded-lg">Post Load</Button>
          </Link>
        </div>
      ) : normalizedLoads.map((l) => (
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
              <Link to={`/loads/${l.id}`}>
                <Button variant="outline-primary" className="btn-sm">
                  View
                </Button>
              </Link>
              <Button variant="outline-secondary" className="btn-sm" disabled>
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

