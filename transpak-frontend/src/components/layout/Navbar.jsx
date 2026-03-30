import React, { useState } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { FaBars, FaBell } from 'react-icons/fa';
import { useAuth } from '../../hooks/useAuth.js';
import { AppContext } from '../../context/AppContext.jsx';
import MobileDrawer from './MobileDrawer.jsx';
import BrandLogo from './BrandLogo.jsx';
import { useLanguage } from '../../hooks/useLanguage.js';
import { dashboardPathForRole } from '../../utils/dashboardPath.js';
import { notifyError } from '../ui/ToastProvider.jsx';
import { unwrapErrorMessage } from '../../utils/unwrapApi.js';

const Navbar = () => {
  const navigate = useNavigate();
  const { t, isUrdu } = useLanguage();
  const { user, setActiveRole } = useAuth();
  const app = React.useContext(AppContext);
  const unreadCount = Array.isArray(app?.notifications) ? app.notifications.filter((n) => !n.read).length : 0;
  const [drawerOpen, setDrawerOpen] = useState(false);
  const roles = user?.roles || (user?.role ? [user.role] : []);
  const activeRole = user?.activeRole || user?.role;

  const hasShipper = roles.includes('shipper');
  const hasCarrier = roles.includes('carrier');

  const targetRole = (() => {
    if (!activeRole) return null;
    if (activeRole === 'shipper') return hasCarrier ? 'carrier' : 'carrier';
    if (activeRole === 'carrier') return hasShipper ? 'shipper' : 'shipper';
    // admin or unknown: pick the role that is missing (if only one exists).
    if (hasShipper && !hasCarrier) return 'carrier';
    if (hasCarrier && !hasShipper) return 'shipper';
    if (hasShipper && hasCarrier) return 'carrier';
    return null;
  })();

  const canSwitch = Boolean(hasShipper || hasCarrier) && Boolean(targetRole);

  const handleSwitchAccount = () => {
    if (!user || !targetRole) return;

    const otherRoleExists = roles.includes(targetRole);
    const originalRole = activeRole;

    if (otherRoleExists) {
      // Optimistic role update ensures the UI/dashboard feels instant.
      setActiveRole(targetRole).catch((err) => {
        notifyError(unwrapErrorMessage(err) || t('errors.generic'));
        if (originalRole) navigate(dashboardPathForRole(originalRole), { replace: true });
      });
      navigate(dashboardPathForRole(targetRole), { replace: true });
      return;
    }

    // Missing the other role: route to role creation.
    navigate('/register', {
      replace: true,
      state: {
        upgradeRole: targetRole,
        prefill: {
          name: user?.name || '',
          email: user?.email || '',
          phone: user?.phone || '',
          cnic: user?.cnic || ''
        }
      }
    });
  };

  return (
    <>
      <nav
        className={`navbar navbar-light bg-white shadow-sm sticky-top d-flex d-md-none navbar-custom ${isUrdu ? 'tp-rtl' : ''}`}
      >
        <div className="container-fluid px-3 d-flex justify-content-between align-items-center">
          <button
            type="button"
            className="btn btn-outline-secondary btn-sm rounded-lg"
            onClick={() => setDrawerOpen(true)}
            aria-label={t('nav.openMenu')}
          >
            <FaBars />
          </button>
          <Link to="/" className="navbar-brand fw-bold mb-0">
            <BrandLogo />
          </Link>
          {user && (
            <div className="d-flex align-items-center gap-2">
              <NavLink
                to="/notifications"
                className="btn btn-outline-secondary btn-sm rounded-lg position-relative d-flex align-items-center justify-content-center"
                aria-label={t('nav.notificationsAria')}
              >
                <FaBell size={14} />
                {unreadCount > 0 && (
                  <span className="position-absolute top-0 start-100 translate-middle badge rounded-pill bg-danger" style={{ fontSize: 9 }}>
                    {unreadCount}
                  </span>
                )}
              </NavLink>
              {canSwitch && (
                <button
                  type="button"
                  className="btn btn-outline-success btn-sm rounded-lg px-2 text-nowrap"
                  onClick={handleSwitchAccount}
                  title={t('nav.switchAccount')}
                >
                  {t('nav.switchAccount')}
                </button>
              )}
            </div>
          )}
        </div>
      </nav>
      <nav
        className={`navbar navbar-expand-md navbar-light bg-white shadow-sm sticky-top d-none d-md-flex navbar-custom ${isUrdu ? 'tp-rtl' : ''}`}
      >
        <div className="container-fluid px-3">
          <Link to="/" className="navbar-brand d-flex align-items-center fw-bold">
            <BrandLogo />
          </Link>

          <div className="d-flex align-items-center gap-2 flex-wrap justify-content-end">
            {user ? (
              <>
                <NavLink
                  to="/notifications"
                  className="btn btn-outline-secondary btn-sm rounded-lg position-relative d-flex align-items-center gap-1"
                  aria-label={t('nav.notificationsAria')}
                >
                  <FaBell size={14} />
                  {unreadCount > 0 && (
                    <span className="badge rounded-pill bg-danger" style={{ fontSize: 9 }}>{unreadCount}</span>
                  )}
                </NavLink>
                {canSwitch && (
                  <button
                    type="button"
                    className="btn btn-outline-success btn-sm rounded-lg px-3"
                    onClick={handleSwitchAccount}
                    title={t('nav.switchAccount')}
                  >
                    {t('nav.switchAccount')}
                  </button>
                )}
              </>
            ) : (
              <>
                <Link to="/login" className="btn btn-primary btn-sm px-3 rounded-lg">
                  {t('nav.login')}
                </Link>
              </>
            )}
          </div>
        </div>
      </nav>
      <MobileDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} />
    </>
  );
};

export default Navbar;
