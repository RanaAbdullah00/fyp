import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Loader from '../../components/ui/Loader.jsx';
import BidList from '../../components/loadboard/BidList.jsx';
import { useApi } from '../../hooks/useApi.js';
import { useAuth } from '../../hooks/useAuth.js';
import { normalizeBids } from '../../adapters/normalize.js';
import { notifyError, notifySuccess } from '../../components/ui/ToastProvider.jsx';
import { useLanguage } from '../../hooks/useLanguage.js';
import { unwrapErrorMessage } from '../../utils/unwrapApi.js';

const isTruckComplete = (t) =>
  t && (t.engineNumber || t.truckNumber) && (t.truckCardFrontImage || t.truckFrontImage) && (t.truckCardBackImage || t.truckBackImage);

const MyBids = () => {
  const { t, isUrdu } = useLanguage();
  const { user } = useAuth();
  const profileComplete = user?.profileComplete === true;
  const { request, loading } = useApi();
  const [bids, setBids] = useState([]);
  const [trucks, setTrucks] = useState([]);

  const fetchTrucks = useCallback(async () => {
    try {
      const data = await request({ method: 'GET', url: '/trucks/mine' });
      setTrucks(Array.isArray(data) ? data : []);
    } catch {
      setTrucks([]);
    }
  }, [request]);

  const trucksComplete = trucks.length > 0 && trucks.some(isTruckComplete);

  const fetchBidsData = useCallback(async () => {
    try {
      const data = await request({ method: 'GET', url: '/bids/mine' });
      setBids(normalizeBids(data));
    } catch (err) {
      notifyError(t('pages.bids.loadBidsFailed'));
      setBids([]);
    }
  }, [request]);

  useEffect(() => {
    fetchBidsData();
  }, [fetchBidsData]);

  useEffect(() => {
    const interval = setInterval(fetchBidsData, 8000);
    return () => clearInterval(interval);
  }, [fetchBidsData]);

  useEffect(() => {
    fetchTrucks();
  }, [fetchTrucks]);

  const actionsDisabled = !profileComplete || !trucksComplete;

  const handleAcceptSuggestion = async (bid) => {
    try {
      await request({ method: 'PUT', url: `/bids/${bid.id}/accept-suggestion` });
      notifySuccess(t('pages.bids.suggestionAccepted'));
      fetchBidsData();
    } catch (err) {
      notifyError(unwrapErrorMessage(err) || t('pages.bids.acceptSuggestionFailed'));
    }
  };

  const handleRejectSuggestion = async (bid) => {
    try {
      await request({ method: 'PUT', url: `/bids/${bid.id}/reject-suggestion` });
      notifySuccess(t('pages.bids.suggestionRejected'));
      fetchBidsData();
    } catch (err) {
      notifyError(unwrapErrorMessage(err) || t('pages.bids.rejectSuggestionFailed'));
    }
  };

  const handleSuggest = async (bid, amount) => {
    try {
      await request({ method: 'PUT', url: `/bids/${bid.id}/suggest-carrier`, data: { amount } });
      notifySuccess(t('pages.bids.suggestSent', { amount: Number(amount).toLocaleString() }));
      fetchBidsData();
    } catch (err) {
      notifyError(unwrapErrorMessage(err) || t('pages.bids.suggestFailed'));
    }
  };

  return (
    <div className={`container py-3 ${isUrdu ? 'tp-rtl' : ''}`}>
      <h5 className="mb-3">{t('pages.bids.myBidsTitle')}</h5>
      {loading ? (
        <div className="d-flex justify-content-center py-5">
          <Loader />
        </div>
      ) : (
        <>
          {actionsDisabled && (bids.some((b) => b.status === 'suggested') || bids.some((b) => b.status === 'pending')) && (
            <div className="alert alert-warning mb-3">
              {t('pages.bids.completeProfilePrefix')}{' '}
              <Link to="/profile" className="alert-link">
                {t('common.profile')}
              </Link>{' '}
              {t('pages.bids.completeProfileAnd')}{' '}
              <Link to="/carrier/truck-details" className="alert-link">
                {t('nav.truckDetails')}
              </Link>{' '}
              {t('pages.bids.completeProfileSuffix')}
            </div>
          )}
          <BidList
            bids={bids}
            mode="carrier"
            onAcceptSuggestion={handleAcceptSuggestion}
            onRejectSuggestion={handleRejectSuggestion}
            onSuggest={handleSuggest}
            actionsDisabled={actionsDisabled}
          />
        </>
      )}
    </div>
  );
};

export default MyBids;

