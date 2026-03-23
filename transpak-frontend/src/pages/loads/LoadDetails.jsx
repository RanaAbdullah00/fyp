import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import LoadCard from '../../components/loadboard/LoadCard.jsx';
import BidList from '../../components/loadboard/BidList.jsx';
import Loader from '../../components/ui/Loader.jsx';
import { useAuth } from '../../hooks/useAuth.js';
import { useApi } from '../../hooks/useApi.js';
import { notifyError, notifySuccess } from '../../components/ui/ToastProvider.jsx';
import { normalizeLoads, normalizeBids } from '../../adapters/normalize.js';

// Detail view for a specific load with bids.
const LoadDetails = () => {
  const { id } = useParams();
  const { user } = useAuth();
  const { request } = useApi();

  const [load, setLoad] = useState(null);
  const [bids, setBids] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchLoad = async () => {
      try {
        const loads = await request({ url: '/loads' });
        const normalizedLoads = normalizeLoads(loads);
        const currentLoad = normalizedLoads.find((l) => String(l.id) === String(id));
        setLoad(currentLoad);
        const allBids = await request({ url: '/bids' });
        const normalizedBids = normalizeBids(allBids);
        const loadBids = normalizedBids.filter((b) => String(b.loadId) === String(currentLoad?.id));
        setBids(loadBids);
      } catch (error) {
        notifyError('Load not found');
      } finally {
        setLoading(false);
      }
    };
    fetchLoad();
  }, [id, request]);

  const handleAccept = async (bid) => {
    try {
      await request({ method: 'PUT', url: `/bids/${bid.id}/accept` });
      setBids((prev) =>
        prev.map((b) => (b.id === bid.id ? { ...b, status: 'accepted' } : { ...b, status: b.status === 'accepted' ? 'accepted' : 'rejected' }))
      );
      notifySuccess('Bid accepted! Shipment assigned.');
    } catch (error) {
      notifyError(error?.response?.data?.error || 'Failed to accept bid');
    }
  };

  const handleReject = async (bid) => {
    try {
      await request({ method: 'PUT', url: `/bids/${bid.id}/reject` });
      setBids((prev) => prev.map((b) => (b.id === bid.id ? { ...b, status: 'rejected' } : b)));
      notifySuccess('Bid rejected.');
    } catch (error) {
      notifyError(error?.response?.data?.error || 'Failed to reject bid');
    }
  };

  const handleSuggest = async (bid, amount) => {
    try {
      await request({ method: 'PUT', url: `/bids/${bid.id}/suggest`, data: { amount } });
      setBids((prev) =>
        prev.map((b) =>
          b.id === bid.id ? { ...b, status: 'suggested', suggestedAmount: amount, suggestedBy: 'shipper' } : b
        )
      );
      notifySuccess(`Suggested rate of ${Number(amount).toLocaleString()} PKR sent.`);
    } catch (error) {
      notifyError(error?.response?.data?.error || 'Suggest failed');
    }
  };

  if (loading) return <Loader />;
  if (!load) return <div>No load found</div>;

  const activeRole = user?.activeRole || user?.role;
  const isOwner = activeRole === 'shipper';
  const approvedBid = bids.find((b) => b.status === 'accepted');

  return (
    <div className="container py-3">
      <nav aria-label="breadcrumb">
        <ol className="breadcrumb">
          <li className="breadcrumb-item"><Link to="/loads">Loads</Link></li>
          <li className="breadcrumb-item active">Load {load.code}</li>
        </ol>
      </nav>
      <h5 className="mb-3">Load {load.code}</h5>
      <LoadCard load={load} />
      
      {isOwner && (
        <>
          <h6 className="mt-4 mb-2">Bids ({bids.length})</h6>
          <BidList
            bids={bids}
            mode="shipper"
            onAccept={handleAccept}
            onReject={handleReject}
            onSuggest={handleSuggest}
          />
          {approvedBid && (
            <div className="alert alert-success mt-3">
              <strong>{approvedBid.carrierName}</strong> selected. Shipment assigned.
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default LoadDetails;

