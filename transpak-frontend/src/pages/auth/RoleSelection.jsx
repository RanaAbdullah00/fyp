import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Button from '../../components/ui/Button.jsx';
import { useAuth } from '../../hooks/useAuth.js';
import { useLanguage } from '../../hooks/useLanguage.js';
import { dashboardPathForRole } from '../../utils/dashboardPath.js';
import { notifyError } from '../../components/ui/ToastProvider.jsx';
import { unwrapErrorMessage } from '../../utils/unwrapApi.js';

const RoleSelection = () => {
  const navigate = useNavigate();
  const { user, setActiveRole } = useAuth();
  const { t } = useLanguage();

  const roles = useMemo(() => {
    if (!user) return [];
    return Array.isArray(user.roles) && user.roles.length
      ? user.roles
      : [user.activeRole].filter(Boolean);
  }, [user]);

  const hasShipper = roles.includes('shipper');
  const hasCarrier = roles.includes('carrier');
  const dualRole = hasShipper && hasCarrier;

  const activeRole = user?.activeRole ?? user?.roles?.[0] ?? null;
  const targetRole = useMemo(() => {
    if (!dualRole) return null;
    if (activeRole === 'shipper' && hasCarrier) return 'carrier';
    if (activeRole === 'carrier' && hasShipper) return 'shipper';
    // Fallback: choose the role that is not the current activeRole.
    return hasShipper ? 'shipper' : hasCarrier ? 'carrier' : null;
  }, [dualRole, activeRole, hasShipper, hasCarrier]);

  const [switching, setSwitching] = useState(false);

  useEffect(() => {
    if (!user) return;
    if (roles.length === 0) {
      navigate('/register', {
        replace: true,
        state: {
          prefill: {
            name: user.name || '',
            email: user.email || '',
            phone: user.phone || '',
            cnic: user.cnic || ''
          }
        }
      });
      return;
    }
    if (roles.length === 1) {
      navigate(dashboardPathForRole(roles[0]), { replace: true });
    }
  }, [user, roles, navigate]);

  if (!user) return null;
  if (!roles.length) return null;
  if (!dualRole && roles.length === 1) return null;

  const handleSwitch = async () => {
    if (!targetRole) return;
    setSwitching(true);
    try {
      if (roles.includes(targetRole)) {
        await setActiveRole(targetRole);
        navigate(dashboardPathForRole(targetRole), { replace: true });
      } else {
        navigate('/register', {
          replace: true,
          state: {
            upgradeRole: targetRole,
            prefill: {
              name: user.name || '',
              email: user.email || '',
              phone: user.phone || '',
              cnic: user.cnic || ''
            }
          }
        });
      }
    } catch (err) {
      notifyError(unwrapErrorMessage(err) || t('errors.generic'));
    } finally {
      setSwitching(false);
    }
  };

  if (!dualRole) return null;

  return (
    <div className="container py-4 tp-auth-page">
      <div className="d-flex justify-content-center">
        <Button variant="primary" className="w-100 py-2" onClick={handleSwitch} disabled={switching}>
          {t('nav.switchAccount')}
        </Button>
      </div>
    </div>
  );
};

export default RoleSelection;
