import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Button from '../ui/Button.jsx';
import Loader from '../ui/Loader.jsx';
import { useAuth } from '../../hooks/useAuth.js';
import { loginApi } from '../../services/authService.js';
import { notifySuccess, notifyError } from '../ui/ToastProvider.jsx';
import { useLanguage } from '../../hooks/useLanguage.js';
import { unwrapResponseData, unwrapErrorMessage } from '../../utils/unwrapApi.js';
import { dashboardPathForRole } from '../../utils/dashboardPath.js';
import { FaEnvelope, FaLock } from 'react-icons/fa';

const LoginForm = () => {
  const navigate = useNavigate();
  const { login } = useAuth();
  const { t, isUrdu } = useLanguage();
  const [form, setForm] = useState({ email: '', password: '' });
  const [uiRolePref, setUiRolePref] = useState(''); // UI hint only; admin determined by backend role
  const [loading, setLoading] = useState(false);

  React.useEffect(() => {
    const handler = () => setUiRolePref('');
    window.addEventListener('tp_login_reset_role', handler);
    return () => window.removeEventListener('tp_login_reset_role', handler);
  }, []);

  const handleChange = (e) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    // clear previous toast handled automatically
    try {
      const res = await loginApi({
        email: form.email,
        password: form.password,
        roleHint: uiRolePref ? uiRolePref : undefined
      });
      const payload = unwrapResponseData(res) || {};
      const { token, user, currentRole } = payload;
      if (token) localStorage.setItem('transpak_token', token);
      if (user) login(payload);
      notifySuccess(t('auth.welcomeBack'));
      const roleToNavigate = currentRole || user?.activeRole || user?.role;
      navigate(dashboardPathForRole(roleToNavigate), { replace: true });
    } catch (err) {
      const raw =
        unwrapErrorMessage(err) ||
        err?.message ||
        'Invalid credentials';
      const translated =
        raw === 'Invalid credentials'
          ? t('errors.invalidCredentials')
          : raw === 'Account is blocked'
          ? t('errors.accountBlocked')
          : raw;
      notifyError(translated);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="mt-3">
      {/* error toast replaces alert */}
      <div className="tp-role-selector mb-3" role="group" aria-label={t('auth.role')}>
        <input
          type="radio"
          className="btn-check"
          name="uiRolePref"
          id="ui-role-shipper"
          autoComplete="off"
          value="shipper"
          checked={uiRolePref === 'shipper'}
          onChange={(e) => setUiRolePref(e.target.value)}
        />
        <label className="btn btn-outline-primary" htmlFor="ui-role-shipper">
          {t('auth.shipper')}
        </label>
        <input
          type="radio"
          className="btn-check"
          name="uiRolePref"
          id="ui-role-carrier"
          autoComplete="off"
          value="carrier"
          checked={uiRolePref === 'carrier'}
          onChange={(e) => setUiRolePref(e.target.value)}
        />
        <label className="btn btn-outline-primary" htmlFor="ui-role-carrier">
          {t('auth.carrier')}
        </label>
      </div>
      <div className="mb-2">
        <label className="form-label small">{t('auth.email')}</label>
        <div className="input-group input-group-sm">
          <span className="input-group-text tp-input-group-addon">
            <FaEnvelope className="tp-input-icon" />
          </span>
          <input
            type="email"
            name="email"
            className={`form-control rounded-3 ${isUrdu ? 'text-end' : ''}`}
            placeholder={t('auth.emailPlaceholder')}
            value={form.email}
            onChange={handleChange}
            required
          />
        </div>
      </div>
      <div className="mb-3">
        <label className="form-label small">{t('auth.password')}</label>
        <div className="input-group input-group-sm">
          <span className="input-group-text tp-input-group-addon">
            <FaLock className="tp-input-icon" />
          </span>
          <input
            type="password"
            name="password"
            className={`form-control rounded-3 ${isUrdu ? 'text-end' : ''}`}
            placeholder={t('auth.passwordPlaceholder')}
            value={form.password}
            onChange={handleChange}
            required
          />
        </div>
      </div>
      <Button
        variant="primary"
        className="w-100 py-2 d-flex justify-content-center align-items-center rounded-lg"
        type="submit"
        disabled={loading}
      >
        {loading ? <Loader light /> : t('auth.signInButton')}
      </Button>
    </form>
  );
};

export default LoginForm;

