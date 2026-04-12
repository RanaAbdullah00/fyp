import React, { useEffect, useState } from 'react';
import Loader from '../../components/ui/Loader.jsx';
import { useApi } from '../../hooks/useApi.js';
const AdminDashboardPage = () => {
  const { request, loading } = useApi();
  const [stats, setStats] = useState(null);

  useEffect(() => {
    (async () => {
      const data = await request({ url: '/admin/stats' });
      setStats(data);
    })();
  }, [request]);

  const cards = [
    { label: 'Total users', value: stats?.totalUsers ?? '—', subLabel: 'Registered' },
    { label: 'Total shipments', value: stats?.totalShipments ?? stats?.totalLoads ?? '—', subLabel: 'Load records' },
    { label: 'Active shipments', value: stats?.activeShipments ?? '—', subLabel: 'Assigned + in transit' },
    { label: 'Total bids', value: stats?.totalBids ?? '—', subLabel: 'Placed' },
    { label: 'Total reviews', value: stats?.totalReviews ?? '—', subLabel: 'Ratings stored' }
  ];

  return (
    <div className="container py-3">
      <h5 className="mb-4">Admin dashboard</h5>
      {loading && !stats ? (
        <div className="d-flex justify-content-center py-5">
          <Loader />
        </div>
      ) : (
        <div className="row g-3">
          {cards.map((c, i) => (
            <div key={i} className="col-12 col-md-6 col-xl-4">
              <div className="card border-0 shadow-sm h-100 rounded-3 overflow-hidden">
                <div className="card-body py-4">
                  <div className="text-muted small text-uppercase mb-1">{c.subLabel}</div>
                  <div className="h4 fw-bold mb-0">{c.value}</div>
                  <div className="small fw-semibold mt-1">{c.label}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default AdminDashboardPage;

