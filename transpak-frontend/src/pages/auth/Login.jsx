import React from 'react';
import { Link } from 'react-router-dom';
import LoginForm from '../../components/auth/LoginForm.jsx';
import LanguageToggle from '../../components/ui/LanguageToggle.jsx';
import { useLanguage } from '../../hooks/useLanguage.js';
import BrandLogo from '../../components/layout/BrandLogo.jsx';

// Login screen designed for mobile-first layout.
const Login = () => {
  const { t, isUrdu } = useLanguage();

  return (
    <div className={`container py-4 tp-auth-page ${isUrdu ? 'tp-rtl' : ''}`}>
      <div className="d-flex justify-content-end mb-2 gap-2">
        <LanguageToggle />
      </div>
      <div className="text-center mb-4">
        <BrandLogo className="auth-logo mb-2" onClick={() => window.dispatchEvent(new CustomEvent('tp_login_reset_role'))} />
        <h4 className="fw-bold">{t('auth.welcomeTitle')}</h4>
        <p className="text-muted small mb-0">{t('auth.welcomeSubtitle')}</p>
      </div>
      <LoginForm />
      <p className="small text-center mt-3">
        {t('auth.newToTranspak')} <Link to="/register">{t('auth.createAccount')}</Link>
      </p>
    </div>
  );
};

export default Login;

