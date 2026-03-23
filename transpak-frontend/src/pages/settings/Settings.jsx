import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Card from '../../components/ui/Card.jsx';
import Button from '../../components/ui/Button.jsx';
import { useAuth } from '../../hooks/useAuth.js';
import { useTheme } from '../../hooks/useTheme.js';
import { FaSun, FaMoon, FaQuestionCircle } from 'react-icons/fa';
import { useLanguage } from '../../hooks/useLanguage.js';
import LanguageToggle from '../../components/ui/LanguageToggle.jsx';

const Settings = () => {
  const { t, isUrdu } = useLanguage();
  const { logout } = useAuth();
  const { darkMode, toggleDarkMode } = useTheme();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login', { replace: true });
  };

  return (
    <div className={`container py-3 ${isUrdu ? 'tp-rtl' : ''}`}>
      <h5 className="mb-3">{t('common.settings')}</h5>
      <Card className="p-3">
        <div className="list-group list-group-flush">
          <Link className="list-group-item list-group-item-action d-flex align-items-center gap-2" to="/profile">
            {t('common.profile')}
          </Link>
          <Link className="list-group-item list-group-item-action d-flex align-items-center gap-2" to="/support#faq">
            <FaQuestionCircle size={14} />
            {t('common.faqHelp')}
          </Link>
          <div className="list-group-item d-flex align-items-center justify-content-between">
            <span className="text-muted small">{t('auth.language')}</span>
            <LanguageToggle />
          </div>
          <div className="list-group-item d-flex align-items-center justify-content-between">
            <span className="d-flex align-items-center gap-2">
              {darkMode ? <FaMoon size={14} /> : <FaSun size={14} />}
              {t('common.darkMode')}
            </span>
            <button
              type="button"
              className={`btn btn-sm ${darkMode ? 'btn-outline-light' : 'btn-outline-secondary'}`}
              onClick={toggleDarkMode}
              aria-label={darkMode ? 'Switch to light' : 'Switch to dark'}
            >
              {darkMode ? t('common.light') : t('common.dark')}
            </button>
          </div>
          <div className="list-group-item">
            <Button
              variant="outline-danger"
              className="w-100"
              onClick={handleLogout}
            >
              {t('common.logout')}
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
};

export default Settings;
