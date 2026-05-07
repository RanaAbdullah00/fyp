import React from 'react';
import Card from '../ui/Card.jsx';

// Stream of recent activity events.
const ActivityFeed = ({ activities }) => {
  const list = Array.isArray(activities) ? activities : [];
  return (
    <Card>
      <h6 className="mb-2">Recent activity</h6>
      {list.length ? (
        <ul className="list-unstyled mb-0 small">
          {list.map((act) => (
            <li key={act.id} className="mb-2">
              <div>{act.message}</div>
              <div className="text-muted">{act.time}</div>
            </li>
          ))}
        </ul>
      ) : (
        <div className="text-muted small tp-empty-state">
          No recent activity yet.
          <div className="mt-1">Updates will appear when loads, bids, or shipments change.</div>
        </div>
      )}
    </Card>
  );
};

export default ActivityFeed;

