import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth.js';
import { useApi } from '../../hooks/useApi.js';
import { useLanguage } from '../../hooks/useLanguage.js';
import { dashboardPathForRole } from '../../utils/dashboardPath.js';
import { useReceivedRatingSummary } from '../../hooks/useReceivedRatingSummary.js';

/**
 * Profile “trust center” role summary: active role, role chips, lightweight stats (existing APIs only).
 */
const ProfileRolePanel = () => {
  const { user, setActiveRole } = useAuth();
  const { request } = useApi();
  const { t } = useLanguage();
  const navigate = useNavigate();
  const uid = user?.id || user?._id;
  const { avg, count } = useReceivedRatingSummary(uid);

  const roles = user?.roles?.length ? user.roles : [user?.activeRole].filter(Boolean);
  const activeRole = user?.activeRole ?? roles[0];
  const hasBothCommercial = roles.includes('shipper') && roles.includes('carrier');

  const [stats, setStats] = useState({
    loadsTotal: 0,
    loadsDone: 0,
    bidsTotal: 0,
    bidsAccepted: 0
  });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const next = { loadsTotal: 0, loadsDone: 0, bidsTotal: 0, bidsAccepted: 0 };
      try {
        const loads = await request({ url: '/loads/mine' });
        if (Array.isArray(loads)) {
          next.loadsTotal = loads.length;
          next.loadsDone = loads.filter((l) => {
            const s = String(l?.status || '').toLowerCase();
            return s === 'delivered' || s === 'closed';
          }).length;
        }
      } catch {
        /* not shipper or no access */
      }
      try {
        const bids = await request({ url: '/bids/mine' });
        const arr = Array.isArray(bids) ? bids : [];
        next.bidsTotal = arr.length;
        next.bidsAccepted = arr.filter((b) => b.status === 'accepted').length;
      } catch {
        /* not carrier */
      }
      if (!cancelled) setStats(next);
    })();
    return () => {
      cancelled = true;
    };
  }, [request]);

  const roleLabel = (r) => {
    if (r === 'shipper') return t('auth.shipper');
    if (r === 'carrier') return t('auth.carrier');
    if (r === 'admin') return t('common.admin');
    return r || t('common.emDash');
  };

  const handleSwitchRole = async () => {
    if (!hasBothCommercial || !activeRole) return;
    const target = activeRole === 'shipper' ? 'carrier' : activeRole === 'carrier' ? 'shipper' : null;
    if (!target || !roles.includes(target)) return;
    try {
      await setActiveRole(target);
      navigate(dashboardPathForRole(target), { replace: true });
    } catch {
      /* toast handled elsewhere if needed */
    }
  };

  const trustLine =
    count > 0 && avg != null
      ? t('profile.trustScoreLine', { avg: avg.toFixed(1), count })
      : t('profile.trustScoreNone');

  return (
    <div className="d-flex flex-column gap-3 tp-profile-role-panel">
      <div className="tp-profile-section rounded-4 p-3 border shadow-sm">
        <div className="small text-muted text-uppercase fw-semibold mb-2">
          {t('profile.activeWorkspace')}
        </div>
        <div className="d-flex flex-wrap align-items-center gap-2 mb-3">
          <span className="badge rounded-pill px-3 py-2 bg-primary tp-profile-active-role-badge">
            {roleLabel(activeRole)}
          </span>
          <span className="small text-muted">{t('profile.activeRoleHint')}</span>
        </div>
        <div className="small text-muted mb-1">{t('profile.rolesOnAccount')}</div>
        <div className="d-flex flex-wrap gap-2">
          {roles.map((r) => (
            <span
              key={r}
              className={`badge rounded-pill px-2 py-1 tp-profile-role-chip ${
                r === activeRole ? 'tp-profile-role-chip--active' : 'tp-profile-role-chip--idle'
              }`}
            >
              {roleLabel(r)}
            </span>
          ))}
        </div>
        {hasBothCommercial ? (
          <button
            type="button"
            className="btn btn-outline-primary btn-sm rounded-pill mt-3 w-100"
            onClick={handleSwitchRole}
          >
            {t('profile.switchRoleVisualCta')}
          </button>
        ) : null}
        <p className="small text-muted mt-2 mb-0">{t('profile.switchRoleVisualHint')}</p>
      </div>

      <div className="tp-profile-section rounded-4 p-3 border shadow-sm">
        <div className="small text-muted text-uppercase fw-semibold mb-2">{t('profile.activitySnapshot')}</div>
        <div className="row g-2 small">
          <div className="col-6">
            <div className="text-muted">{t('profile.statLoadsPosted')}</div>
            <div className="fw-semibold fs-6">{stats.loadsTotal}</div>
          </div>
          <div className="col-6">
            <div className="text-muted">{t('profile.statLoadsCompleted')}</div>
            <div className="fw-semibold fs-6">{stats.loadsDone}</div>
          </div>
          <div className="col-6">
            <div className="text-muted">{t('profile.statBidsPlaced')}</div>
            <div className="fw-semibold fs-6">{stats.bidsTotal}</div>
          </div>
          <div className="col-6">
            <div className="text-muted">{t('profile.statBidsAccepted')}</div>
            <div className="fw-semibold fs-6">{stats.bidsAccepted}</div>
          </div>
        </div>
      </div>

      <div className="tp-profile-section rounded-4 p-3 border shadow-sm">
        <div className="small text-muted text-uppercase fw-semibold mb-1">{t('profile.trustLayer')}</div>
        <p className="mb-0 small text-body">{trustLine}</p>
      </div>
    </div>
  );
};

export default ProfileRolePanel;
