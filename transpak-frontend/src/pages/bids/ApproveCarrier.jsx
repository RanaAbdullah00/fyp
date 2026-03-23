import React, { useState } from 'react';
import Card from '../../components/ui/Card.jsx';
import Button from '../../components/ui/Button.jsx';
import Badge from '../../components/ui/Badge.jsx';

// Shipper screen to approve a carrier for a load (verification + assignment step).
// In production, approval would call an endpoint like POST /loads/:id/assign.
const ApproveCarrier = () => {
  const [approvedId, setApprovedId] = useState(null);

  const candidates = [
    {
      id: 1,
      name: 'PakTrans Logistics',
      rating: 4.6,
      verified: true,
      fleetSize: 18,
      bid: 83000
    },
    {
      id: 2,
      name: 'Alpha Carriers',
      rating: 4.2,
      verified: false,
      fleetSize: 9,
      bid: 80000
    }
  ];

  const handleApprove = (carrierId) => {
    setApprovedId(carrierId);
    alert('Carrier approved (demo).');
  };

  return (
    <div className="container py-3">
      <h5 className="mb-3">Approve carrier</h5>
      {candidates.map((c) => (
        <Card key={c.id}>
          <div className="d-flex justify-content-between align-items-start">
            <div>
              <h6 className="mb-1">{c.name}</h6>
              <div className="small text-muted">
                Rating: {c.rating} · Fleet: {c.fleetSize}
              </div>
              <div className="small mt-1">
                Bid: <span className="fw-semibold">{c.bid.toLocaleString()} PKR</span>
              </div>
            </div>
            <div className="text-end">
              <Badge variant={c.verified ? 'success' : 'warning'}>
                {c.verified ? 'Verified' : 'Unverified'}
              </Badge>
            </div>
          </div>

          <div className="d-flex justify-content-end mt-2">
            <Button
              variant={approvedId === c.id ? 'success' : 'primary'}
              className="btn-sm px-3"
              onClick={() => handleApprove(c.id)}
              disabled={approvedId !== null && approvedId !== c.id}
            >
              {approvedId === c.id ? 'Approved' : 'Approve'}
            </Button>
          </div>
        </Card>
      ))}
    </div>
  );
};

export default ApproveCarrier;

