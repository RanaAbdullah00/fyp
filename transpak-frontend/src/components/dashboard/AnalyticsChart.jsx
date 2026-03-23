import React from 'react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid
} from 'recharts';
import Card from '../ui/Card.jsx';

// Simple line chart visualising shipment or revenue trends.
const AnalyticsChart = ({ data, label }) => (
  <Card>
    <h6 className="mb-2">{label}</h6>
    <div style={{ width: '100%', height: 200 }}>
      <ResponsiveContainer>
        <LineChart data={data} margin={{ top: 10, right: 10, bottom: 0, left: -20 }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="name" tick={{ fontSize: 10 }} />
          <YAxis tick={{ fontSize: 10 }} />
          <Tooltip />
          <Line
            type="monotone"
            dataKey="value"
            stroke="#16a34a"
            strokeWidth={2}
            dot={{ r: 3, fill: '#16a34a' }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  </Card>
);

export default AnalyticsChart;

