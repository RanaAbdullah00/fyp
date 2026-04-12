import api from './api.js';

export async function fetchWalletSummary() {
  const res = await api.get('/wallet/summary');
  return res.data;
}

export async function fetchWalletTransactions(limit = 50) {
  const res = await api.get('/wallet/transactions', { params: { limit } });
  return res.data;
}
