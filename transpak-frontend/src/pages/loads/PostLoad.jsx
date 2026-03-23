import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import PostLoadForm from '../../components/loadboard/PostLoadForm.jsx';
import Loader from '../../components/ui/Loader.jsx';
import { useAuth } from '../../hooks/useAuth.js';
import { useApi } from '../../hooks/useApi.js';
import { AppContext } from '../../context/AppContext.jsx';
import { notifySuccess, notifyError, notifyInfo } from '../../components/ui/ToastProvider.jsx';

// Screen for shippers to post new loads.
const PostLoad = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { request } = useApi();
  const appContext = React.useContext(AppContext);
  const addNotification = appContext?.addNotification || (() => {});

  useEffect(() => {
    if (user && user.profileComplete === false) {
      notifyInfo('Please complete your profile first to post loads.');
      navigate('/profile', { replace: true });
    }
  }, [user, navigate]);

  const handleSubmit = async (payload) => {
    try {
      const loadData = await request({
        url: '/loads/create',
        method: 'POST',
        data: {
          origin: payload.origin,
          destination: payload.destination,
          weight: Number(payload.weight),
          type: payload.vehicleType,
          price: Number(payload.expectedPrice),
          pickupDate: payload.pickupDate
        }
      });
      notifySuccess(`Load ${loadData?.code || 'L-' + Date.now()} posted! Bidding open.`);
      addNotification({
        type: 'load',
        message: `Your load ${payload.code || 'L-' + Date.now()} is now live for bidding!`
      });
      navigate('/loads/manage');
    } catch (error) {
      notifyError('Failed to post load. Please try again.');
    }
  };

  if (user && user.profileComplete === false) {
    return (
      <div className="container py-5 text-center">
        <Loader />
        <p className="mt-3 text-muted">Redirecting to profile...</p>
      </div>
    );
  }

  return (
    <div className="container py-3">
      <h5 className="mb-3">Post a new load</h5>
      <PostLoadForm onSubmit={handleSubmit} />
    </div>
  );
};

export default PostLoad;

