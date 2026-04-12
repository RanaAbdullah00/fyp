import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '../../hooks/useLanguage.js';
import LoadList from '../../components/loadboard/LoadList.jsx';
import PaymentModal from '../../components/wallet/PaymentModal.jsx';
import { useAuth } from '../../hooks/useAuth.js';
import { useApi } from '../../hooks/useApi.js';
import Loader from '../../components/ui/Loader.jsx';
import { notifyError } from '../../components/ui/ToastProvider.jsx';
import { normalizeLoads } from '../../adapters/normalize.js';

const MOCK_LOADS = [
  {
    id: 'mock_1',
    code: 'L-201',
    cargo: 'Textile rolls',
    origin: 'Lahore',
    destination: 'Karachi',
    weight: 18,
    vehicleType: 'Trailer',
    distance: 1210,
    expectedPrice: 160000,
    pickupDate: 'Today',
    status: 'open'
  },
  {
    id: 'mock_2',
    code: 'L-202',
    cargo: 'Rice bags',
    origin: 'Multan',
    destination: 'Islamabad',
    weight: 12,
    vehicleType: 'Truck',
    distance: 540,
    expectedPrice: 78000,
    pickupDate: 'Tomorrow',
    status: 'open'
  }
];

// Marketplace-style list of loads with filters.
const AvailableLoads = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [showPayment, setShowPayment] = useState(false);
  const [selectedLoad, setSelectedLoad] = useState(null);

  const [filters, setFilters] = useState({
    origin: '',
    destination: '',
    vehicleType: '',
    city: '',
    minPrice: '',
    maxPrice: ''
  });
  const [loads, setLoads] = useState([]);

  const { request, loading: apiLoading, error: apiError } = useApi();

  useEffect(() => {
    const fetchAvailableLoads = async () => {
      try {
        const params = {
          origin: filters.origin,
          destination: filters.destination,
          vehicleType: filters.vehicleType,
          city: filters.city,
          minPrice: filters.minPrice,
          maxPrice: filters.maxPrice
        };
        const data = await request({
          method: 'GET',
          url: '/loads',
          params
        });
        setLoads(normalizeLoads(data));
      } catch (err) {
        notifyError('Failed to load available loads');
        setLoads(MOCK_LOADS);
      }
    };

    fetchAvailableLoads();
  }, [filters, request]);

  const handleBid = (load) => {
    const activeRole = user?.activeRole || user?.role;
    if (activeRole === 'carrier') {
      navigate('/bids/place', { state: { load } });
      return;
    }
    setSelectedLoad(load);
    setShowPayment(true);
  };

  const handlePaymentConfirm = (data) => {
    console.log('Simulated bid & payment', selectedLoad, data);
    setShowPayment(false);
    alert(`Simulated payment of ${data.amount} PKR via ${data.provider} for load ${selectedLoad?.code}.`);
  };

  const handleFilterChange = (e) => {
    setFilters((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const { t } = useLanguage();

  return (
    <div className="container py-3">
      <h5 className="mb-3">{t('pages.loads.availableLoads')}</h5>
      <div className="tp-filter-card mb-2">
        <div className="row g-2">
          <div className="col-6">
            <input
              name="origin"
              className="form-control form-control-sm rounded-3"
              placeholder={t('pages.loads.origin')}
              value={filters.origin}
              onChange={handleFilterChange}
            />
          </div>
          <div className="col-6">
            <input
              name="destination"
              className="form-control form-control-sm rounded-3"
              placeholder={t('pages.loads.destination')}
              value={filters.destination}
              onChange={handleFilterChange}
            />
          </div>
          <div className="col-12">
            <select
              name="vehicleType"
              className="form-select form-select-sm rounded-3"
              value={filters.vehicleType}
              onChange={handleFilterChange}
            >
              <option value="">{t('pages.loads.vehicleType')}</option>
              <option>Truck</option>
              <option>Trailer</option>
              <option>Container</option>
              <option>Flatbed</option>
            </select>
          </div>
          <div className="col-12">
            <input
              name="city"
              className="form-control form-control-sm rounded-3"
              placeholder={t('pages.loads.city')}
              value={filters.city}
              onChange={handleFilterChange}
            />
          </div>
          <div className="col-6">
            <input
              name="minPrice"
              type="number"
              min="0"
              className="form-control form-control-sm rounded-3"
              placeholder={t('pages.loads.minPrice')}
              value={filters.minPrice}
              onChange={handleFilterChange}
            />
          </div>
          <div className="col-6">
            <input
              name="maxPrice"
              type="number"
              min="0"
              className="form-control form-control-sm rounded-3"
              placeholder={t('pages.loads.maxPrice')}
              value={filters.maxPrice}
              onChange={handleFilterChange}
            />
          </div>
        </div>
      </div>
      {apiLoading ? (
        <div className="d-flex justify-content-center py-5">
          <Loader />
        </div>
      ) : (
        <LoadList loads={loads} onBid={handleBid} />
      )}
      {showPayment && selectedLoad && (
        <PaymentModal
          maxAmount={selectedLoad.expectedPrice}
          onClose={() => setShowPayment(false)}
          onConfirm={handlePaymentConfirm}
        />
      )}
    </div>
  );
};

export default AvailableLoads;

