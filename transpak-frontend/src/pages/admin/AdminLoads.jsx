import React, { useEffect, useState } from 'react';
import Card from '../../components/ui/Card.jsx';
import Button from '../../components/ui/Button.jsx';
import Loader from '../../components/ui/Loader.jsx';
import { useApi } from '../../hooks/useApi.js';
import { notifyError, notifySuccess } from '../../components/ui/ToastProvider.jsx';

const AdminLoads = () => {
  const { request, loading } = useApi();
  const [loads, setLoads] = useState([]);

  const refresh = async () => {
    const data = await request({ url: '/admin/loads' });
    setLoads(Array.isArray(data) ? data : []);
  };

  useEffect(() => {
    refresh().catch(() => {});
  }, []);

  const del = async (id) => {
    try {
      await request({ method: 'DELETE', url: `/admin/loads/${id}` });
      setLoads((prev) => prev.filter((l) => l.id !== id));
      notifySuccess('Load deleted');
    } catch {
      notifyError('Delete failed');
    }
  };

  return (
    <div className="container py-3">
      <h5 className="mb-3">Loads</h5>
      {loading && loads.length === 0 ? (
        <div className="d-flex justify-content-center py-5">
          <Loader />
        </div>
      ) : loads.length === 0 ? (
        <div className="text-muted text-center py-5">No loads.</div>
      ) : (
        <Card className="p-0 overflow-hidden">
          <div className="table-responsive">
            <table className="table table-hover table-sm mb-0 align-middle">
              <thead className="table-light">
                <tr>
                  <th className="ps-3 py-3">Code</th>
                  <th className="py-3">Cargo</th>
                  <th className="py-3 d-none d-lg-table-cell">Route</th>
                  <th className="py-3">Pickup</th>
                  <th className="py-3">Status</th>
                  <th className="pe-3 py-3 text-end">Action</th>
                </tr>
              </thead>
              <tbody>
                {loads.map((l) => (
                  <tr key={l.id}>
                    <td className="ps-3 py-3 fw-semibold">{l.code}</td>
                    <td className="py-3"><small>{l.cargo || '—'}</small></td>
                    <td className="py-3 d-none d-lg-table-cell"><small className="text-muted">{l.origin || '—'} → {l.destination || '—'}</small></td>
                    <td className="py-3"><small>{l.pickupDate || '—'}</small></td>
                    <td className="py-3"><span className="badge bg-info">{String(l.status || '').replaceAll('_', ' ')}</span></td>
                    <td className="pe-3 py-3 text-end">
                      <Button variant="outline-danger" size="sm" onClick={() => del(l.id)} className="rounded-lg">
                        Delete
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
};

export default AdminLoads;

