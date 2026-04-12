import api from './api.js';

/**
 * Simulated wallet payment — backend is source of truth for paymentStatus.
 * outcome: optional "success" | "failed" | "pending" (validated server-side).
 */
export async function simulatePayment({ amount, provider, outcome }) {
  const body = { amount: Number(amount), provider: provider || 'wallet' };
  if (outcome) body.outcome = outcome;
  const res = await api.post('/payments/simulate', body);
  return res.data;
}
