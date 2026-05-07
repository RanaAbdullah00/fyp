import React, { useEffect, useMemo, useState } from 'react';
import StatsCards from '../../components/dashboard/StatsCards.jsx';
import ActivityFeed from '../../components/dashboard/ActivityFeed.jsx';
import AnalyticsChart from '../../components/dashboard/AnalyticsChart.jsx';
import { useApi } from '../../hooks/useApi.js';
// High-level admin overview of platform metrics.
const AdminDashboard = () => {
  const { request } = useApi();
  const [statsRow, setStatsRow] = useState(null);
  const activities = [];
  const chartData = [];

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await request({ method: 'GET', url: '/admin/stats' });
        if (!cancelled) setStatsRow(data || null);
      } catch {
        if (!cancelled) setStatsRow(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [request]);

  const stats = useMemo(() => {
    if (!statsRow) {
      return [
        { label: 'Users', value: '—' },
        { label: 'Loads', value: '—' },
        { label: 'Bookings', value: '—' },
        { label: 'Active shipments', value: '—' }
      ];
    }
    return [
      { label: 'Users', value: statsRow.totalUsers ?? 0 },
      { label: 'Loads', value: statsRow.totalLoads ?? 0 },
      { label: 'Bookings', value: statsRow.totalBookings ?? 0 },
      { label: 'Active shipments', value: statsRow.activeShipments ?? 0 }
    ];
  }, [statsRow]);

  return (
    <div className="container py-3">
      <h5 className="mb-3">Admin dashboard</h5>
      <StatsCards stats={stats} />
      <div className="mt-3 row g-2">
        <div className="col-12 col-lg-6">
          <AnalyticsChart data={chartData} label="New users per week" emptyHint="Analytics will appear as the platform gets real usage." />
        </div>
        <div className="col-12 col-lg-6">
          <ActivityFeed activities={activities} />
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;

