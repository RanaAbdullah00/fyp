import React, { useEffect, useMemo, useRef, useState } from 'react';
import { FaBell } from 'react-icons/fa';
import NotificationItem from './NotificationItem.jsx';
import Button from '../ui/Button.jsx';
import { AppContext } from '../../context/AppContext.jsx';
import { useAuth } from '../../hooks/useAuth.js';
import api from '../../services/api.js';
import { useLanguage } from '../../hooks/useLanguage.js';
import { notificationsForUser } from '../../utils/notificationScope.js';

function startOfDay(d) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x.getTime();
}

const NotificationDropdown = ({ className = '' }) => {
  const { t, isUrdu } = useLanguage();
  const { user } = useAuth();
  const app = React.useContext(AppContext);
  const [open, setOpen] = useState(false);
  const [serverUnread, setServerUnread] = useState(0);
  const rootRef = useRef(null);

  const allNotifications = useMemo(
    () => (Array.isArray(app?.notifications) ? app.notifications : []),
    [app?.notifications]
  );
  const notifications = useMemo(
    () => notificationsForUser(allNotifications, user),
    [allNotifications, user]
  );
  const markNotificationRead = app?.markNotificationRead || (() => {});
  const refetchNotifications = app?.refetchNotifications;

  const contextUnread = notifications.filter((n) => !(n.read || n.isRead)).length;
  const unreadCount = allNotifications.length ? contextUnread : serverUnread;

  useEffect(() => {
    const load = async () => {
      if (!user) {
        setServerUnread(0);
        return;
      }
      try {
        const res = await api.get('/notifications/unread-count', { skipGlobalErrorToast: true });
        const n = typeof res.data?.count === 'number' ? res.data.count : 0;
        setServerUnread(n);
      } catch {
        setServerUnread(0);
      }
    };
    load();
    const onRead = () => load();
    window.addEventListener('tp_notifications_read', onRead);
    return () => window.removeEventListener('tp_notifications_read', onRead);
  }, [user, user?.activeRole, allNotifications.length]);

  useEffect(() => {
    if (!open) return undefined;
    const onDoc = (e) => {
      if (rootRef.current && !rootRef.current.contains(e.target)) setOpen(false);
    };
    const onEsc = (e) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onEsc);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onEsc);
    };
  }, [open]);

  const sorted = useMemo(
    () =>
      [...notifications].sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      ),
    [notifications]
  );

  const { today, older } = useMemo(() => {
    const t0 = startOfDay(new Date());
    const a = [];
    const b = [];
    sorted.forEach((n) => {
      const ts = new Date(n.createdAt).getTime();
      if (!Number.isFinite(ts)) {
        b.push(n);
        return;
      }
      if (startOfDay(new Date(n.createdAt)) === t0) a.push(n);
      else b.push(n);
    });
    return { today: a, older: b };
  }, [sorted]);

  const markAllRead = async () => {
    try {
      await api.patch('/notifications/read-all');
      sorted.forEach((n) => markNotificationRead(n.id || n._id));
      await refetchNotifications?.();
      window.dispatchEvent(new CustomEvent('tp_notifications_read'));
    } catch {
      /* ignore */
    }
  };

  const handleOpen = (n) => {
    markNotificationRead(n._id || n.id);
    const id = String(n.id || n._id || '');
    if (id) {
      api
        .patch(`/notifications/${id}/read`)
        .then(() => {
          window.dispatchEvent(new CustomEvent('tp_notifications_read'));
          return refetchNotifications?.();
        })
        .catch(() => {});
    }
  };

  const renderGroup = (label, items) => {
    if (!items.length) return null;
    return (
      <section className="tp-notif-group mb-2" aria-label={label}>
        <h6 className="tp-notif-group__title small fw-semibold text-body text-uppercase px-2 mb-1">{label}</h6>
        <div className="tp-notif-group__list">
          {items.map((n) => (
            <NotificationItem
              key={String(n._id || n.id || `${n.message}-${n.createdAt}`)}
              notification={n}
              onClick={() => handleOpen(n)}
            />
          ))}
        </div>
      </section>
    );
  };

  return (
    <div className={`tp-notif-dropdown position-relative ${className}`} ref={rootRef}>
      <button
        type="button"
        className="btn btn-outline-secondary btn-sm rounded-lg position-relative d-flex align-items-center justify-content-center gap-1"
        aria-label={t('nav.notificationsAria')}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <FaBell size={14} />
        {unreadCount > 0 ? (
          <span className="badge rounded-pill bg-danger tp-badge-xs">{unreadCount > 99 ? '99+' : unreadCount}</span>
        ) : null}
      </button>
      {open ? (
        <div
          className={`tp-notif-dropdown__panel shadow-lg rounded-3 border ${isUrdu ? 'tp-rtl' : ''}`}
          role="dialog"
          aria-label={t('common.notifications')}
        >
          <div className="d-flex justify-content-between align-items-center gap-2 px-3 py-2 border-bottom tp-border-theme">
            <span className="fw-semibold small">{t('common.notifications')}</span>
            {contextUnread > 0 ? (
              <Button variant="outline-primary" size="sm" className="rounded-lg py-0 px-2" onClick={markAllRead}>
                {t('pages.notificationsPanel.markAllRead')}
              </Button>
            ) : null}
          </div>
          <div className="tp-notif-dropdown__scroll px-2 py-2">
            {!sorted.length ? (
              <div className="text-center small py-4 px-2 tp-empty-state">
                <div className="fw-semibold mb-1 text-body">{t('pages.notificationsPanel.emptyTitle')}</div>
                <div className="text-muted">{t('pages.notificationsPanel.emptyBody')}</div>
              </div>
            ) : (
              <>
                {renderGroup(t('pages.notificationsPanel.groupToday'), today)}
                {renderGroup(t('pages.notificationsPanel.groupEarlier'), older)}
              </>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default NotificationDropdown;
