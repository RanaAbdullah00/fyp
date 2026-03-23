import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import Card from '../../components/ui/Card.jsx';
import Button from '../../components/ui/Button.jsx';
import LoadCard from '../../components/loadboard/LoadCard.jsx';
import { useAuth } from '../../hooks/useAuth.js';
import { useApi } from '../../hooks/useApi.js';
import { notifySuccess, notifyError, notifyInfo } from '../../components/ui/ToastProvider.jsx';

// Carrier bid placement page. Expects "load" object from AvailableLoads route state.
const PlaceBid = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const load = location.state?.load;
  const { request, loading } = useApi();

  // Profile gate - skip in demo if no profileComplete
  useEffect(() => {
    if (user && user.profileComplete === false) {
      notifyInfo('Please complete your carrier profile (truck details) first.');
      navigate('/profile', { replace: true });
    }
  }, [user, navigate]);

  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState('PKR');
  const [transitTime, setTransitTime] = useState(2);
  const [note, setNote] = useState('');

  // Pre-fill competitive bid (10% below expected)
  useEffect(() => {
    if (load?.expectedPrice) {
      setAmount((load.expectedPrice * 0.9).toFixed(0));
    }
  }, [load]);

  if (!load) {
    return (
      <div className="container py-3">
        <h5 className="mb-3 text-muted">Place bid</h5>
        <Card className="p-4 text-center">
          <p className="small text-muted mb-3">
            No load selected. Browse <Link to="/loads">Available Loads</Link> and click "Place bid".
          </p>
          <Button variant="primary" onClick={() => navigate('/loads')}>
            Browse Loads
          </Button>
        </Card>
      </div>
    );
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const bidPayload = {
        loadId: load.id,
        carrierId: user.id,
        loadCode: load.code,
        amount: Number(amount),
        currency,
        transitTime,
        note,
        createdAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + parseInt(load.deadlineHours || 2) * 60 * 60 * 1000).toISOString()
      };
      
      const response = await request({
        url: '/bids',
        method: 'POST',
        data: bidPayload
      });
      
      notifySuccess(`Bid placed on ${load.code}!`);
      navigate('/loads');
    } catch (error) {
      notifyError('Bid failed: ' + (error.message || 'Try again'));
    }
  };

  const isValidBid = Number(amount) > 0 && transitTime >= 1;

  return (
    <div className="container py-3">
      <nav aria-label="breadcrumb">
        <ol className="breadcrumb small">
          <li className="breadcrumb-item"><a href="/loads">Loads</a></li>
          <li className="breadcrumb-item active">Place Bid</li>
        </ol>
      </nav>
      
      <div className="row g-4">
        <div className="col-lg-7">
          <h5 className="mb-3">
            Bid on <strong>{load.code}</strong> 
            <span className="badge bg-info ms-2">{load.cargo}</span>
          </h5>
          <LoadCard load={load} />
        </div>
        
        <div className="col-lg-5">
          <Card className="p-4 h-100">
            <h6 className="mb-3">Your Bid Details</h6>
            
            <form onSubmit={handleSubmit}>
              <div className="mb-3">
                <label className="form-label fw-semibold small">Bid Amount (PKR) *</label>
                <div className="input-group input-group-lg">
                  <span className="input-group-text">PKR</span>
                  <input
                    type="number"
                    className={`form-control form-control-lg ${amount && Number(amount) < load.expectedPrice * 0.85 ? 'border-success' : ''}`}
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="Enter competitive bid"
                    required
                    min="1000"
                  />
                </div>
                <small className="text-muted">
                  Expected: {load.expectedPrice?.toLocaleString()} PKR
                </small>
              </div>

              <div className="row g-3 mb-4">
                <div className="col-md-6">
                  <label className="form-label fw-semibold small">Transit Time *</label>
                  <input
                    type="number"
                    className="form-control form-control-lg"
                    value={transitTime}
                    onChange={(e) => setTransitTime(Number(e.target.value))}
                    min="1"
                    max="7"
                    required
                  />
                  <small className="text-muted">{transitTime} day{transitTime !== 1 ? 's' : ''}</small>
                </div>
                <div className="col-md-6">
                  <label className="form-label small">Currency</label>
                  <select className="form-select form-select-lg" value={currency} onChange={(e) => setCurrency(e.target.value)}>
                    <option value="PKR">PKR</option>
                  </select>
                </div>
                <div className="col-md-6">
                  <label className="form-label small">Your Truck</label>
                  <select className="form-select form-select-lg" disabled>
                    <option>{user.truckReg || 'LEA-4567'} ({user.truckCapacity || load.weight}t)</option>
                  </select>
                </div>
              </div>

              <div className="mb-4">
                <label className="form-label fw-semibold small">Additional Notes</label>
                <textarea
                  className="form-control form-control-lg"
                  rows="3"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Special requirements, availability windows, equipment notes..."
                  maxLength="500"
                />
                <small className="text-muted">{note.length}/500</small>
              </div>

              <Button 
                variant="success" 
                className="w-100 py-3 fw-bold fs-5 shadow-sm"
                type="submit"
                disabled={!isValidBid || loading}
              >
                {isValidBid ? `Place ${Number(amount).toLocaleString()} ${currency} Bid` : 'Enter valid amount'}
                <br />
                <small className="fw-normal opacity-75">Bid expires in 2 hours</small>
              </Button>
            </form>

            <div className="mt-4 pt-3 border-top small text-muted text-center">
              <strong>Bid valid for 2 hours</strong> from submission. You can place new bids on other loads.
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default PlaceBid;
