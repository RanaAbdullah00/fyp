import React, { useEffect, useState } from 'react';
import Card from '../../components/ui/Card.jsx';
import Button from '../../components/ui/Button.jsx';
import Loader from '../../components/ui/Loader.jsx';
import { useApi } from '../../hooks/useApi.js';
import { notifySuccess } from '../../components/ui/ToastProvider.jsx';

const fallbackDisputes = [
  { id: 'd1', loadCode: 'L-101', reason: 'POD unclear', status: 'open' },
  { id: 'd2', loadCode: 'L-102', reason: 'Route deviation', status: 'open' }
];

const Disputes = () => {
  const { request, loading } = useApi();
  const [disputes, setDisputes] = useState(fallbackDisputes);

  useEffect(() => {
    (async () => {
      try {
        const data = await request({ url: '/admin/disputes' });
        if (Array.isArray(data) && data.length) setDisputes(data);
      } catch {
        // offline mock
      }
    })();
  }, [request]);

  const resolve = async (id) => {
    try {
      await request({ method: 'PATCH', url: `/admin/disputes/${id}/resolve` });
      setDisputes((prev) => prev.map((d) => (d.id === id ? { ...d, status: 'resolved' } : d)));
      notifySuccess('Dispute resolved');
    } catch {
      setDisputes((prev) => prev.map((d) => (d.id === id ? { ...d, status: 'resolved' } : d)));
      notifySuccess('Dispute resolved (offline)');
    }
  };

  return (
    <div className="container py-3">
      <h5 className="mb-3">Disputes</h5>
      {loading ? (
        <div className="d-flex justify-content-center py-5">
          <Loader />
        </div>
      ) : (
        disputes.map((d) => (
          <Card key={d.id}>
            <div className="d-flex justify-content-between align-items-start">
              <div>
                <div className="fw-semibold">{d.loadCode}</div>
                <div className="small text-muted">{d.reason}</div>
                <div className="small mt-1">
                  Status: <span className="fw-semibold">{d.status}</span>
                </div>
              </div>
              <Button
                variant="primary"
                className="btn-sm rounded-lg"
                disabled={d.status !== 'open'}
                onClick={() => resolve(d.id)}
              >
                Resolve
              </Button>
            </div>
          </Card>
        ))
      )}
    </div>
  );
};

export default Disputes;

