import React from 'react';
import StatsCards from '../../components/dashboard/StatsCards.jsx';
import ActivityFeed from '../../components/dashboard/ActivityFeed.jsx';
import AnalyticsChart from '../../components/dashboard/AnalyticsChart.jsx';

// High-level admin overview of platform metrics.
const AdminDashboard = () => {
  const stats = [
    { label: 'Total shippers', value: 120 },
    { label: 'Total carriers', value: 85 },
    { label: 'Active disputes', value: 3 },
    { label: 'GMV (PKR)', value: '32M', subLabel: 'Last 30 days' }
  ];

  const activities = [
    { id: 1, message: 'New shipper registered: Alpha FMCG.', time: '1 hr ago' },
    { id: 2, message: 'Carrier profile verified: Pak Logistics.', time: '3 hrs ago' }
  ];

  const chartData = [
    { name: 'Week 1', value: 6 },
    { name: 'Week 2', value: 9 },
    { name: 'Week 3', value: 7 },
    { name: 'Week 4', value: 11 }
  ];

  return (
    <div className="container py-3">
      <h5 className="mb-3">Admin dashboard</h5>
      <StatsCards stats={stats} />
      <div className="mt-3 row g-2">
        <div className="col-12 col-lg-6">
          <AnalyticsChart data={chartData} label="New users per week" />
        </div>
        <div className="col-12 col-lg-6">
          <ActivityFeed activities={activities} />
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;

