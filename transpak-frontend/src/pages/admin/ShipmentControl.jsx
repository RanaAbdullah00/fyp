import React, { useEffect, useState } from 'react';
import Card from '../../components/ui/Card.jsx';
import Button from '../../components/ui/Button.jsx';
import Loader from '../../components/ui/Loader.jsx';
import { useApi } from '../../hooks/useApi.js';
import { notifyError, notifySuccess } from '../../components/ui/ToastProvider.jsx';

const ShipmentControl = () => {
  const { request, loading } = useApi();
  const [shipments, setShipments] = useState([]);

  useEffect(() => {
    (async () => {
      try {
        const data = await request({ url: '/admin/shipments' });
        setShipments(Array.isArray(data) ? data : []);
      } catch (e) {
        notifyError(e?.response?.data?.message || 'Failed to load shipments');
        setShipments([]);
      }
    })();
  }, [request]);

  const updateStatus = async (id, status) => {
    try {
      await request({ method: 'PATCH', url: `/admin/shipments/${id}/status`, data: { status } });
      setShipments((prev) => prev.map((s) => (s.id === id ? { ...s, status } : s)));
      notifySuccess('Shipment status updated');
    } catch {
      notifyError('Failed to update shipment status');
    }
  };

  return (
    <div className="container py-3">
      <h5 className="mb-3">Shipment control</h5>
      {loading ? (
        <div className="d-flex justify-content-center py-5">
          <Loader />
        </div>
      ) : (
        shipments.map((s) => (
          <Card key={s.id}>
            <div className="d-flex justify-content-between align-items-start">
              <div>
                <div className="fw-semibold">{s.code}</div>
                <div className="small text-muted">
                  {s.origin} → {s.destination}
                </div>
                <div className="small mt-1">
                  Status: <span className="fw-semibold">{s.status}</span>
                </div>
              </div>
              <div className="d-flex gap-2 flex-wrap justify-content-end">
                <Button variant="outline-primary" className="btn-sm rounded-lg" onClick={() => updateStatus(s.id, 'pending')}>
                  Pending
                </Button>
                <Button variant="primary" className="btn-sm rounded-lg" onClick={() => updateStatus(s.id, 'in_transit')}>
                  In transit
                </Button>
                <Button variant="success" className="btn-sm rounded-lg" onClick={() => updateStatus(s.id, 'delivered')}>
                  Delivered
                </Button>
              </div>
            </div>
          </Card>
        ))
      )}
    </div>
  );
};

export default ShipmentControl;

