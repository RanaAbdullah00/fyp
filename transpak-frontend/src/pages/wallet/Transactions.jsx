import React, { useEffect, useState } from 'react';
import TransactionList from '../../components/wallet/TransactionList.jsx';
import { fetchWalletTransactions } from '../../services/walletApi.js';

function formatTxRow(r) {
  return {
    id: r.id,
    description: r.description || r.provider || 'Transaction',
    amount: r.amount,
    type: r.type,
    date: r.createdAt ? new Date(r.createdAt).toLocaleString() : '—'
  };
}

const Transactions = () => {
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const txs = await fetchWalletTransactions(100);
        if (!cancelled) setTransactions(Array.isArray(txs) ? txs.map(formatTxRow) : []);
      } catch {
        if (!cancelled) setTransactions([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="container py-3">
      <h5 className="mb-3">Transactions</h5>
      {loading ? <div className="small text-muted mb-2">Loading…</div> : null}
      <TransactionList transactions={transactions} />
    </div>
  );
};

export default Transactions;
