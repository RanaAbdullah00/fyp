import React from 'react';
import { NavLink } from 'react-router-dom';
import { FaTachometerAlt, FaPlusCircle, FaTruck, FaWallet, FaListUl, FaGavel, FaCheckCircle, FaUserShield, FaExclamationTriangle, FaShippingFast, FaCog, FaSignOutAlt } from 'react-icons/fa';
import { useLanguage } from '../../hooks/useLanguage.js';
import { useAuth } from '../../hooks/useAuth.js';
import LogoutConfirmModal from '../ui/LogoutConfirmModal.jsx';

const navLinkClass = ({ isActive }) =>
  `nav-link d-flex align-items-center gap-2 rounded-lg px-3 py-2 mb-1 ${isActive ? 'active' : ''}`;

const Sidebar = () => {
  const { user } = useAuth();
  const { t } = useLanguage();
  const [showLogoutModal, setShowLogoutModal] = React.useState(false);

  const activeRole = user?.activeRole || user?.role;
  const isAdmin = activeRole === 'admin';
  const isCarrier = activeRole === 'carrier';
  const isShipper = activeRole === 'shipper';

  const dashboardPath = isShipper ? '/dashboard/shipper' : isCarrier ? '/dashboard/carrier' : '/dashboard/admin';

  return (
    <aside className="d-none d-md-block sidebar-fixed sidebar-aside d-flex flex-column">
      <nav className="nav flex-column p-3 small flex-grow-1">
        {user && (
          <div className="d-flex align-items-center gap-2 mb-3 px-2">
            <div
              className="rounded-circle overflow-hidden border flex-shrink-0"
              style={{ width: 36, height: 36, borderColor: 'var(--pak-border)' }}
            >
              {user.profileImage ? (
                <img src={user.profileImage} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : (
                <div className="w-100 h-100 d-flex align-items-center justify-content-center bg-light text-muted" style={{ fontSize: 14 }}>{user.name?.[0]?.toUpperCase() || '?'}</div>
              )}
            </div>
            <div className="flex-grow-1 min-w-0">
              <div className="fw-semibold text-truncate small">{user.name || 'User'}</div>
              {user.profileComplete && <span className="badge bg-success" style={{ fontSize: 9 }}>✓</span>}
            </div>
          </div>
        )}
        <NavLink to={dashboardPath} className={navLinkClass} end>
          <FaTachometerAlt />
          {t('common.dashboard')}
        </NavLink>
        {isShipper && (
          <>
            <NavLink to="/loads/post" className={navLinkClass}>
              <FaPlusCircle />
              {t('pages.loads.postLoad')}
            </NavLink>
            <NavLink to="/loads/manage" className={navLinkClass}>
              <FaListUl />
              {t('pages.loads.manageLoads')}
            </NavLink>
            <NavLink to="/bids" className={navLinkClass} end>
              <FaGavel />
              {t('pages.bids.management')}
            </NavLink>
            <NavLink to="/bids/approve" className={navLinkClass}>
              <FaCheckCircle />
              {t('pages.bids.approveCarrier')}
            </NavLink>
          </>
        )}
        {isCarrier && (
          <>
            <NavLink to="/loads" className={navLinkClass}>
              <FaListUl />
              {t('common.loads')}
            </NavLink>
            <NavLink to="/bids/mine" className={navLinkClass}>
              <FaGavel />
              {t('pages.bids.management')}
            </NavLink>
            <NavLink to="/fleet" className={navLinkClass}>
              <FaTruck />
              {t('common.fleet')}
            </NavLink>
            <NavLink to="/carrier/truck-details" className={navLinkClass}>
              <FaTruck />
              Truck details
            </NavLink>
          </>
        )}
        {isAdmin && (
          <>
            <NavLink to="/admin/dashboard" className={navLinkClass}>
              <FaTachometerAlt />
              Admin Dashboard
            </NavLink>
            <NavLink to="/admin/users" className={navLinkClass}>
              <FaUserShield />
              Users
            </NavLink>
            <NavLink to="/admin/loads" className={navLinkClass}>
              <FaListUl />
              Loads
            </NavLink>
            <NavLink to="/admin/verification" className={navLinkClass}>
              <FaUserShield />
              Verification
            </NavLink>
            <NavLink to="/admin/disputes" className={navLinkClass}>
              <FaExclamationTriangle />
              Disputes
            </NavLink>
            <NavLink to="/admin/shipments" className={navLinkClass}>
              <FaShippingFast />
              Shipments
            </NavLink>
          </>
        )}
        <NavLink to="/wallet" className={navLinkClass}>
          <FaWallet />
          {t('common.wallet')}
        </NavLink>
        <NavLink to="/settings" className={navLinkClass}>
          <FaCog />
          Settings
        </NavLink>
      </nav>
      <div className="p-3 mt-auto border-top" style={{ borderColor: 'var(--pak-border) !important' }}>
        <button
          type="button"
          className="btn btn-outline-danger w-100 d-flex align-items-center justify-content-center gap-2 rounded-lg py-2"
          onClick={() => setShowLogoutModal(true)}
        >
          <FaSignOutAlt size={14} />
          Logout
        </button>
      </div>
      <LogoutConfirmModal show={showLogoutModal} onClose={() => setShowLogoutModal(false)} />
    </aside>
  );
};

export default Sidebar;

