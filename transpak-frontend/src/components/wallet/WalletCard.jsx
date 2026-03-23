import React from 'react';
import Card from '../ui/Card.jsx';
import Badge from '../ui/Badge.jsx';

// Displays wallet balance and basic info.
const WalletCard = ({ role, balance }) => (
  <Card className="tp-wallet-card text-center">
    <div className="small text-muted text-uppercase mb-1">
      {role} wallet balance
    </div>
    <div className="h3 mb-1">{Number(balance ?? 0).toLocaleString()} PKR</div>
    <Badge variant="success">Available</Badge>
  </Card>
);

export default WalletCard;

