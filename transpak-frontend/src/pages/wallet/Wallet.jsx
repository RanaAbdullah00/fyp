import React, { useCallback, useEffect, useMemo, useState } from 'react';
import WalletCard from '../../components/wallet/WalletCard.jsx';
import PaymentModal from '../../components/wallet/PaymentModal.jsx';
import TransactionList from '../../components/wallet/TransactionList.jsx';
import { useAuth } from '../../hooks/useAuth.js';
import { simulatePayment } from '../../services/paymentService.js';
import { fetchWalletSummary, fetchWalletTransactions } from '../../services/walletApi.js';
import { notifySuccess, notifyError } from '../../components/ui/ToastProvider.jsx';

function formatTxRow(r) {
  return {
    id: r.id,
    description: r.description || r.provider || 'Transaction',
    amount: r.amount,
    type: r.type,
    date: r.createdAt ? new Date(r.createdAt).toLocaleString() : '—'
  };
}

const Wallet = () => {
  const { user } = useAuth();
  const activeRole = user?.activeRole ?? user?.roles?.[0] ?? 'shipper';
  const [showPayment, setShowPayment] = useState(false);
  const [balance, setBalance] = useState(0);
  const [retryPayload, setRetryPayload] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const [sum, txs] = await Promise.all([fetchWalletSummary(), fetchWalletTransactions(40)]);
      if (typeof sum?.balance === 'number') setBalance(sum.balance);
      setTransactions(Array.isArray(txs) ? txs.map(formatTxRow) : []);
    } catch {
      setBalance(0);
      setTransactions([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const ledgerSum = useMemo(() => {
    const type = activeRole === 'carrier' ? 'credit' : 'debit';
    return transactions
      .filter((x) => x.type === type)
      .reduce((s, x) => s + (Number(x.amount) || 0), 0);
  }, [transactions, activeRole]);

  const paymentAmountCap = useMemo(() => {
    const b = Math.abs(Number(balance) || 0);
    if (b <= 0) return 500_000;
    return Math.min(50_000_000, Math.max(10_000, Math.ceil(b * 25)));
  }, [balance]);

  const handleConfirm = async ({ amount, provider, outcome }) => {
    try {
      const data = await simulatePayment({ amount, provider, outcome });
      const ps = data?.paymentStatus;
      if (ps === 'success') {
        await refresh();
        setRetryPayload(null);
        notifySuccess('Payment completed');
        setShowPayment(false);
        return;
      }
      if (ps === 'failed') {
        setRetryPayload({ amount, provider });
        notifyError(data?.message || 'Payment failed');
        setShowPayment(false);
        return;
      }
      if (ps === 'pending') {
        notifySuccess(data?.message || 'Payment pending');
        setShowPayment(false);
        return;
      }
      notifyError('Unexpected payment response');
    } catch (e) {
      notifyError(e?.response?.data?.message || e?.message || 'Payment request failed');
    }
  };

  return (
    <div className="container py-3">
      <h5 className="mb-3">Wallet</h5>
      {loading ? <div className="small text-muted mb-2">Loading wallet…</div> : null}
      <div className="row g-2 mb-2">
        <div className="col-12 col-md-6">
          <div className="card tp-wallet-card p-3 card-hover">
            <div className="small opacity-75">{activeRole === 'carrier' ? 'Earnings' : 'Spending'} (ledger)</div>
            <div className="h4 mb-0">{ledgerSum.toLocaleString()} PKR</div>
          </div>
        </div>
        <div className="col-12 col-md-6">
          <div className="card p-3 card-hover">
            <div className="small text-muted">Balance</div>
            <div className="h4 mb-0">{balance.toLocaleString()} PKR</div>
          </div>
        </div>
      </div>
      <WalletCard role={activeRole} balance={balance} />
      <button
        type="button"
        className="btn btn-primary w-100 rounded-pill mt-2"
        onClick={() => setShowPayment(true)}
      >
        {activeRole === 'carrier' ? 'Simulate receiving' : 'Simulate payment'}
      </button>
      {retryPayload && (
        <button
          type="button"
          className="btn btn-outline-danger w-100 rounded-pill mt-2"
          onClick={() => setShowPayment(true)}
        >
          Retry failed payment
        </button>
      )}
      <TransactionList transactions={transactions} />
      {showPayment && (
        <PaymentModal
          maxAmount={paymentAmountCap}
          defaultAmount={retryPayload?.amount}
          onClose={() => setShowPayment(false)}
          onConfirm={handleConfirm}
        />
      )}
    </div>
  );
};

export default Wallet;
