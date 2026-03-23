import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Card from '../../components/ui/Card.jsx';
import Button from '../../components/ui/Button.jsx';
import RoleSelector from '../../components/auth/RoleSelector.jsx';
import { useAuth } from '../../hooks/useAuth.js';

// Role selection page used when a user needs to choose a role after onboarding.
// In production, you would persist this to the backend profile.
const RoleSelection = () => {
  const navigate = useNavigate();
  const { user, login } = useAuth();
  const [role, setRole] = useState(user?.activeRole || user?.role || 'shipper');

  const handleContinue = () => {
    const existingRoles = Array.isArray(user?.roles) ? user.roles : [user?.role].filter(Boolean);
    if (existingRoles.length <= 1) {
      // If only one role exists, do not show this page (safety)
      if (existingRoles[0] === 'carrier') navigate('/dashboard/carrier', { replace: true });
      else if (existingRoles[0] === 'admin') navigate('/dashboard/admin', { replace: true });
      else navigate('/dashboard/shipper', { replace: true });
      return;
    }
    const updated = {
      ...(user || { id: 'u1', name: 'Demo User', email: 'demo@transpak.pk' }),
      activeRole: role,
      roles: existingRoles
    };
    login(updated);

    if (role === 'carrier') navigate('/dashboard/carrier', { replace: true });
    else if (role === 'admin') navigate('/dashboard/admin', { replace: true });
    else navigate('/dashboard/shipper', { replace: true });
  };

  return (
    <div className="container py-4 tp-auth-page">
      <h4 className="fw-bold text-center mb-2">Select your role</h4>
      <p className="text-muted small text-center mb-3">
        This helps TransPak show the right tools for you.
      </p>
      <Card>
        <RoleSelector value={role} onChange={setRole} />
        <Button variant="primary" className="w-100 py-2" onClick={handleContinue}>
          Continue
        </Button>
      </Card>
    </div>
  );
};

export default RoleSelection;

