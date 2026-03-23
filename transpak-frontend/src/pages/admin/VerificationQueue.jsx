import React, { useEffect, useState } from 'react';
import Card from '../../components/ui/Card.jsx';
import Button from '../../components/ui/Button.jsx';
import Loader from '../../components/ui/Loader.jsx';
import { useApi } from '../../hooks/useApi.js';
import { notifySuccess, notifyError } from '../../components/ui/ToastProvider.jsx';

const fallbackUsers = [
  { id: 'u1', name: 'Alpha Carriers', cnic: '35202-1234567-1', verified: false },
  { id: 'u2', name: 'PakTrans Logistics', cnic: '35202-7654321-2', verified: true }
];

const VerificationQueue = () => {
  const { request, loading } = useApi();
  const [users, setUsers] = useState(fallbackUsers);

  useEffect(() => {
    // If backend provides users endpoint later, this will use it; otherwise stays mock.
    (async () => {
      try {
        const data = await request({ url: '/admin/users' });
        if (Array.isArray(data) && data.length) setUsers(data);
      } catch {
        // stay on mock
      }
    })();
  }, [request]);

  const setVerified = async (id, verified) => {
    try {
      await request({ method: 'PATCH', url: `/admin/users/${id}/verify`, data: { verified } });
      setUsers((prev) => prev.map((u) => (u.id === id ? { ...u, verified } : u)));
      notifySuccess(verified ? 'User verified' : 'Verification removed');
    } catch {
      setUsers((prev) => prev.map((u) => (u.id === id ? { ...u, verified } : u)));
      notifySuccess(verified ? 'User verified (offline)' : 'Verification removed (offline)');
    }
  };

  return (
    <div className="container py-3">
      <h5 className="mb-3">Verification queue</h5>
      {loading ? (
        <div className="d-flex justify-content-center py-5">
          <Loader />
        </div>
      ) : (
        users.map((u) => (
          <Card key={u.id}>
            <div className="d-flex justify-content-between align-items-start">
              <div>
                <div className="fw-semibold">{u.name}</div>
                <div className="small text-muted">CNIC: {u.cnic}</div>
              </div>
              <div className="d-flex gap-2">
                <Button
                  variant={u.verified ? 'success' : 'primary'}
                  className="btn-sm rounded-lg"
                  onClick={() => setVerified(u.id, true)}
                >
                  Approve
                </Button>
                <Button
                  variant="outline-secondary"
                  className="btn-sm rounded-lg"
                  onClick={() => setVerified(u.id, false)}
                >
                  Reject
                </Button>
              </div>
            </div>
          </Card>
        ))
      )}
    </div>
  );
};

export default VerificationQueue;

