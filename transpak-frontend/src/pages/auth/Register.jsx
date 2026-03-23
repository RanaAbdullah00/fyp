import React from 'react';
import { Link } from 'react-router-dom';
import RegisterForm from '../../components/auth/RegisterForm.jsx';
import LanguageToggle from '../../components/ui/LanguageToggle.jsx';
import { useLanguage } from '../../hooks/useLanguage.js';
import BrandLogo from '../../components/layout/BrandLogo.jsx';

// Registration screen with role selection.
const Register = () => {
  const { t, isUrdu } = useLanguage();

  return (
    <div className={`container py-4 tp-auth-page ${isUrdu ? 'tp-rtl' : ''}`}>
      <div className="d-flex justify-content-end mb-2 gap-2">
        <LanguageToggle />
      </div>
      <div className="text-center mb-4">
        <BrandLogo
          className="auth-logo mb-2"
          onClick={() => window.dispatchEvent(new CustomEvent('tp_register_reset_role'))}
        />
        <h4 className="fw-bold">{t('auth.registerTitle')}</h4>
        <p className="text-muted small mb-0">{t('auth.registerSubtitle')}</p>
      </div>
      <RegisterForm />
      <p className="small text-center mt-3">
        {t('auth.alreadyHaveAccount')} <Link to="/login">{t('auth.signIn')}</Link>
      </p>
    </div>
  );
};

export default Register;

