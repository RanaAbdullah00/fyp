import { useState, useCallback } from 'react';
import api from '../services/api.js';
import { unwrapBody } from '../utils/unwrapApi.js';
import { fallbackLoads, fallbackBids, fallbackNotifications, fallbackTracking } from '../mocks/fallbackData.js';

export const useApi = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const getFallback = (config) => {
    const url = String(config?.url || '');
    const method = String(config?.method || 'GET').toUpperCase();
    if (method === 'GET' && url.includes('/loads')) return fallbackLoads;
    if (method === 'GET' && url.includes('/bids')) return fallbackBids;
    if (method === 'GET' && url.includes('/notifications')) return fallbackNotifications;
    if (method === 'GET' && url.includes('/shipments/track')) return fallbackTracking;
    if (method === 'PUT' && url.includes('/bids/') && (url.endsWith('/accept') || url.endsWith('/reject') || url.endsWith('/suggest') || url.includes('/accept-suggestion') || url.includes('/reject-suggestion') || url.includes('/suggest-carrier'))) {
      return { ok: true };
    }
    if (method === 'POST' && (url.includes('/bids') || url.includes('/loads'))) {
      return { ok: true, id: Date.now() };
    }
    return null;
  };

  const request = useCallback(async (config) => {
    setLoading(true);
    setError(null);
    try {
      const response = await api(config);
      return unwrapBody(response.data);
    } catch (err) {
      setError(
        err.response?.data?.message ||
          err.response?.data?.error ||
          err.message ||
          'Request failed'
      );
      const fallback = getFallback(config);
      if (fallback !== null) return fallback;
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  return { request, loading, error };
};

