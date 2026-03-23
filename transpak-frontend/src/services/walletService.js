import api from './api.js';

// Wallet and payment related API calls.
export const fetchWallet = () =>
  api.get('/wallet');

export const payFromWallet = (payload) =>
  api.post('/wallet/pay', payload);

