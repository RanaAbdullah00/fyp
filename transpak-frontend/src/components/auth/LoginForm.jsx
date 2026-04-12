import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Button from '../ui/Button.jsx';
import Loader from '../ui/Loader.jsx';
import RoleSelector from './RoleSelector.jsx';
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
  const [uiRolePref, setUiRolePref] = useState('');
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
    if (!uiRolePref) {
      notifyError(t('errors.roleRequired'));
      return;
    }
    setLoading(true);
    try {
      const res = await loginApi({
        email: form.email,
        password: form.password,
        roleHint: uiRolePref
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
    <form onSubmit={handleSubmit} className="tp-auth-login-form mt-3">
      <RoleSelector value={uiRolePref} onChange={setUiRolePref} />
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
        disabled={loading || !uiRolePref}
      >
        {loading ? <Loader light /> : t('auth.signInButton')}
      </Button>
    </form>
  );
};

export default LoginForm;
