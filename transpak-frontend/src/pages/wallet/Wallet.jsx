import React, { useState } from 'react';
import WalletCard from '../../components/wallet/WalletCard.jsx';
import PaymentModal from '../../components/wallet/PaymentModal.jsx';
import TransactionList from '../../components/wallet/TransactionList.jsx';
import { useAuth } from '../../hooks/useAuth.js';

// Wallet overview with balance and quick payment simulation.
const Wallet = () => {
  const { user } = useAuth();
  const activeRole = user?.activeRole || user?.role || 'shipper';
  const [showPayment, setShowPayment] = useState(false);
  const [balance, setBalance] = useState(500000);
  const [transactions, setTransactions] = useState([
    {
      id: 1,
      description: 'Payment to Carrier · PK-INV-001',
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
  ]);

  const handleConfirm = ({ amount, provider }) => {
    // Shippers send money; carriers receive money (demo simulation).
    const direction = activeRole === 'carrier' ? 'credit' : 'debit';
    setBalance((b) => (direction === 'credit' ? b + amount : b - amount));
    setTransactions((prev) => [
      {
        id: Date.now(),
        description:
          activeRole === 'carrier'
            ? `Received via ${provider}`
            : `Payment via ${provider}`,
        amount,
        type: direction,
        date: 'Just now'
      },
      ...prev
    ]);
    setShowPayment(false);
  };

  return (
    <div className="container py-3">
      <h5 className="mb-3">Wallet</h5>
      <div className="row g-2 mb-2">
        <div className="col-12 col-md-6">
          <div className="card tp-wallet-card p-3 card-hover">
            <div className="small opacity-75">{activeRole === 'carrier' ? 'Earnings' : 'Spending'} (30 days)</div>
            <div className="h4 mb-0">{activeRole === 'carrier' ? '312,000' : '184,000'} PKR</div>
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
      <TransactionList transactions={transactions} />
      {showPayment && (
        <PaymentModal
          maxAmount={balance}
          onClose={() => setShowPayment(false)}
          onConfirm={handleConfirm}
        />
      )}
    </div>
  );
};

export default Wallet;

