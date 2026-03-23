import React from 'react';
import Card from '../ui/Card.jsx';

// Tabular view of wallet transactions.
const TransactionList = ({ transactions }) => {
  if (!transactions.length) {
    return (
      <p className="text-center text-muted small mt-3">
        No transactions yet.
      </p>
    );
  }

  return (
    <Card>
      <h6 className="mb-2">Recent transactions</h6>
      <ul className="list-group list-group-flush small">
        {transactions.map((tx) => (
          <li
            key={tx.id}
            className="list-group-item px-0 d-flex justify-content-between align-items-center"
          >
            <div>
              <div className="fw-semibold">{tx.description}</div>
              <div className="text-muted">{tx.date}</div>
            </div>
            <div
              className={
                tx.type === 'credit' ? 'text-success fw-semibold' : 'text-danger fw-semibold'
              }
            >
              {tx.type === 'credit' ? '+' : '-'}
              {tx.amount.toLocaleString()} PKR
            </div>
          </li>
        ))}
      </ul>
    </Card>
  );
};

export default TransactionList;

