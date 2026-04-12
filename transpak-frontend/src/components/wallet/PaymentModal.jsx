import React, { useState, useEffect } from 'react';
import Modal from '../ui/Modal.jsx';
import Button from '../ui/Button.jsx';

// Modal used to simulate payment between shipper and carrier wallets.
const PaymentModal = ({ onClose, onConfirm, maxAmount, defaultAmount, initialOutcome = '' }) => {
  const [amount, setAmount] = useState(defaultAmount != null ? String(defaultAmount) : '');
  const [provider, setProvider] = useState('easypaisa');
  const [outcome, setOutcome] = useState(initialOutcome);
  const safeMax = Number(maxAmount ?? 0);

  useEffect(() => {
    if (defaultAmount != null) setAmount(String(defaultAmount));
  }, [defaultAmount]);

  const handleConfirm = () => {
    onConfirm?.({
      amount: Number(amount),
      provider,
      outcome: outcome || undefined
    });
  };

  return (
    <Modal
      title="Confirm payment"
      onClose={onClose}
      actions={[
        <Button key="cancel" variant="outline-secondary" onClick={onClose}>
          Cancel
        </Button>,
        <Button
          key="pay"
          variant="primary"
          onClick={handleConfirm}
          disabled={!amount}
        >
          Pay
        </Button>
      ]}
    >
      <div className="mb-2 small text-muted">
        Simulate a wallet payment from shipper to carrier using a local provider.
      </div>
      <div className="mb-2">
        <label className="form-label small">Amount (PKR)</label>
        <input
          type="number"
          className="form-control form-control-sm rounded-3"
          placeholder={`Max ${safeMax.toLocaleString()}`}
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
        />
      </div>
      <div className="mb-2">
        <label className="form-label small">Provider</label>
        <select
          className="form-select form-select-sm rounded-3"
          value={provider}
          onChange={(e) => setProvider(e.target.value)}
        >
          <option value="easypaisa">Easypaisa</option>
          <option value="jazzcash">JazzCash</option>
        </select>
      </div>
      <div className="mb-2">
        <label className="form-label small">Test outcome (optional)</label>
        <select
          className="form-select form-select-sm rounded-3"
          value={outcome}
          onChange={(e) => setOutcome(e.target.value)}
        >
          <option value="">Default (success)</option>
          <option value="success">success</option>
          <option value="pending">pending</option>
          <option value="failed">failed</option>
        </select>
      </div>
    </Modal>
  );
};

export default PaymentModal;

