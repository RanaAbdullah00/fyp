import React, { useMemo, useState } from 'react';
import { Link, NavLink } from 'react-router-dom';
import { FaBars, FaBell } from 'react-icons/fa';
import { useAuth } from '../../hooks/useAuth.js';
import { AppContext } from '../../context/AppContext.jsx';
import MobileDrawer from './MobileDrawer.jsx';
import BrandLogo from './BrandLogo.jsx';
import Modal from '../ui/Modal.jsx';
import RegisterForm from '../auth/RegisterForm.jsx';
import { useLanguage } from '../../hooks/useLanguage.js';
import LanguageToggle from '../ui/LanguageToggle.jsx';

const Navbar = () => {
  const { t, isUrdu } = useLanguage();
  const { user, setActiveRole } = useAuth();
  const app = React.useContext(AppContext);
  const unreadCount = Array.isArray(app?.notifications) ? app.notifications.filter((n) => !n.read).length : 0;
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const roles = user?.roles || (user?.role ? [user.role] : []);
  const activeRole = user?.activeRole || user?.role;

  const hasShipper = roles.includes('shipper');
  const hasCarrier = roles.includes('carrier');
  const dualRole = hasShipper && hasCarrier;
  const nextUpgradeRole = useMemo(() => {
    if (!user) return null;
    if (dualRole) return null;
    if (hasShipper) return 'carrier';
    if (hasCarrier) return 'shipper';
    return null;
  }, [user, dualRole, hasShipper, hasCarrier]);

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
            <NavLink
              to="/notifications"
              className="btn btn-outline-secondary btn-sm rounded-lg position-relative"
              aria-label={t('nav.notificationsAria')}
            >
              <FaBell size={16} />
              {unreadCount > 0 && (
                <span className="position-absolute top-0 start-100 translate-middle badge rounded-pill bg-danger" style={{ fontSize: 9 }}>
                  {unreadCount}
                </span>
              )}
            </NavLink>
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
            <LanguageToggle className="d-none d-sm-inline-flex" />
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
                {dualRole && (
                  <div className="d-flex gap-2 tp-role-selector" role="group" aria-label={t('nav.roleSwitchAria')} style={{ maxWidth: 280 }}>
                    <button
                      type="button"
                      className={`btn btn-sm ${activeRole === 'shipper' ? 'btn-primary' : 'btn-outline-primary'} rounded-lg flex-fill`}
                      onClick={() => setActiveRole('shipper')}
                    >
                      {t('nav.shipperShort')}
                    </button>
                    <button
                      type="button"
                      className={`btn btn-sm ${activeRole === 'carrier' ? 'btn-primary' : 'btn-outline-primary'} rounded-lg flex-fill`}
                      onClick={() => setActiveRole('carrier')}
                    >
                      {t('nav.carrierShort')}
                    </button>
                  </div>
                )}
                {!dualRole && nextUpgradeRole && (
                  <button
                    type="button"
                    className="btn btn-outline-success btn-sm rounded-lg px-3"
                    onClick={() => setUpgradeOpen(true)}
                    title={t('nav.createAnotherRoleTitle')}
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
      <Modal
        open={upgradeOpen}
        title={t('nav.switchAccountModalTitle')}
        onClose={() => setUpgradeOpen(false)}
        size="lg"
      >
        <div className="small text-muted mb-2">
          {t('nav.switchAccountHint', {
            role: nextUpgradeRole === 'carrier' ? t('auth.carrier') : t('auth.shipper')
          })}
        </div>
        <RegisterForm
          upgradeRole={nextUpgradeRole}
          prefill={{
            name: user?.name || '',
            email: user?.email || '',
            phone: user?.phone || '',
            cnic: user?.cnic || ''
          }}
          onDone={() => setUpgradeOpen(false)}
        />
        <div className="d-flex gap-2 mt-3">
          <button type="button" className="btn btn-outline-secondary flex-grow-1" onClick={() => setUpgradeOpen(false)}>
            {t('nav.cancel')}
          </button>
        </div>
      </Modal>
    </>
  );
};

export default Navbar;
