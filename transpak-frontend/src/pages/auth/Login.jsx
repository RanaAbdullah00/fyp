import React from 'react';
import { Link } from 'react-router-dom';
import LoginForm from '../../components/auth/LoginForm.jsx';
import { useLanguage } from '../../hooks/useLanguage.js';
import BrandLogo from '../../components/layout/BrandLogo.jsx';
import LanguageToggle from '../../components/ui/LanguageToggle.jsx';

// Login screen: hero + form (logistics theme, lightweight CSS only).
const Login = () => {
  const { t, isUrdu } = useLanguage();

  return (
    <div className={`tp-auth-shell min-vh-100 d-flex flex-column ${isUrdu ? 'tp-rtl' : ''}`}>
      <div className="flex-grow-1 d-flex align-items-stretch">
        <div className="row g-0 w-100 mx-0 flex-grow-1">
          <div className="col-lg-5 tp-auth-hero d-none d-lg-flex flex-column justify-content-between p-4 p-xl-5 text-white">
            <div>
              <div className="tp-route-lines mb-4" aria-hidden />
              <h1 className="display-4 fw-bold lh-1 mb-3 tp-hero-mark">TRANSPAK</h1>
              <p className="lead fs-6 opacity-90 mb-0">{t('auth.welcomeSubtitle')}</p>
            </div>
            <div className="small opacity-75">Pakistan · digital freight exchange</div>
          </div>
          <div className="col-12 col-lg-7 tp-auth-form-wrap d-flex flex-column">
            <div className="container py-4 flex-grow-1 d-flex flex-column justify-content-center tp-auth-page">
              <div className="mx-auto w-100" style={{ maxWidth: 420 }}>
                <div className="d-flex justify-content-end mb-2">
                  <LanguageToggle />
                </div>
                <div className="d-lg-none tp-auth-hero-compact rounded-3 p-3 mb-3 text-center text-white">
                  <div className="fs-2 fw-bold tp-hero-mark mb-0">TRANSPAK</div>
                </div>
                <div className="text-center mb-4">
                  <BrandLogo
                    className="auth-logo mb-2"
                    onClick={() => window.dispatchEvent(new CustomEvent('tp_login_reset_role'))}
                  />
                  <h4 className="fw-bold">{t('auth.welcomeTitle')}</h4>
                  <p className="text-muted small mb-0">{t('auth.welcomeSubtitle')}</p>
                </div>
                <LoginForm />
                <p className="small text-center mt-3 mb-0">
                  {t('auth.newToTranspak')} <Link to="/register">{t('auth.createAccount')}</Link>
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
