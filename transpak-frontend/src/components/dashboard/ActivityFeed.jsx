import React from 'react';
import Card from '../ui/Card.jsx';

// Stream of recent activity events.
const ActivityFeed = ({ activities }) => (
  <Card>
    <h6 className="mb-2">Recent activity</h6>
    <ul className="list-unstyled mb-0 small">
      {activities.map((act) => (
        <li key={act.id} className="mb-2">
          <div>{act.message}</div>
          <div className="text-muted">{act.time}</div>
        </li>
      ))}
    </ul>
  </Card>
);

export default ActivityFeed;

