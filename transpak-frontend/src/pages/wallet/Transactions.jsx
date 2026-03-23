import React from 'react';
import TransactionList from '../../components/wallet/TransactionList.jsx';

// Dedicated transactions screen if you want to deep-dive beyond the wallet summary.
const Transactions = () => {
  const transactions = [
    {
      id: 1,
      description: 'Payment to PakTrans Logistics · PK-INV-001',
      amount: 120000,
      type: 'debit',
      date: 'Today, 10:20 AM'
    },
    {
      id: 2,
      description: 'Wallet top-up',
      amount: 300000,
      type: 'credit',
      date: 'Yesterday, 3:10 PM'
    }
  ];

  return (
    <div className="container py-3">
      <h5 className="mb-3">Transactions</h5>
      <TransactionList transactions={transactions} />
    </div>
  );
};

export default Transactions;

