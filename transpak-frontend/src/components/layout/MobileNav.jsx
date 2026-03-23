import React from 'react';
import { NavLink } from 'react-router-dom';
import { FaHome, FaListUl, FaWallet, FaTruck, FaTools } from 'react-icons/fa';
import { useAuth } from '../../hooks/useAuth.js';
import { useLanguage } from '../../hooks/useLanguage.js';

const mobileNavClass = ({ isActive }) =>
  `nav-link d-flex flex-column align-items-center small rounded-0 py-2 ${isActive ? 'mobile-nav-active' : ''}`;

const MobileNav = () => {
  const { user } = useAuth();
  const { t, isUrdu } = useLanguage();

  const activeRole = user?.activeRole || user?.role;
  const dashboardPath = activeRole === 'carrier' ? '/dashboard/carrier' : activeRole === 'admin' ? '/dashboard/admin' : '/dashboard/shipper';

  const roleSlot =
    activeRole === 'carrier'
      ? { to: '/fleet', icon: <FaTools />, label: t('common.fleet') }
      : activeRole === 'shipper'
      ? { to: '/loads/manage', icon: <FaTools />, label: t('common.manage') }
      : { to: '/notifications', icon: <FaTools />, label: t('common.admin') };

  const loadsPath = activeRole === 'shipper' ? '/loads/manage' : '/loads';
  const trackPath = activeRole === 'shipper' ? '/bids' : '/shipments/tracking';

  return (
    <nav className={`mobile-bottom-nav d-md-none ${isUrdu ? 'tp-rtl' : ''}`}>
      <div className="nav nav-pills nav-fill border-top mobile-nav-inner">
        <NavLink to={dashboardPath} className={mobileNavClass} end>
          <FaHome />
          <span>{t('common.home')}</span>
        </NavLink>
        <NavLink to={loadsPath} className={mobileNavClass} end={loadsPath === '/loads'}>
          <FaListUl />
          <span>{t('common.loads')}</span>
        </NavLink>
        <NavLink to={trackPath} className={mobileNavClass} end={trackPath === '/bids'}>
          <FaTruck />
          <span>{t('common.track')}</span>
        </NavLink>
        <NavLink to="/wallet" className={mobileNavClass}>
          <FaWallet />
          <span>{t('common.wallet')}</span>
        </NavLink>
        <NavLink to={roleSlot.to} className={mobileNavClass}>
          {roleSlot.icon}
          <span>{roleSlot.label}</span>
        </NavLink>
      </div>
    </nav>
  );
};

export default MobileNav;

