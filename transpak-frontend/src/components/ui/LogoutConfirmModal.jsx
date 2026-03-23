import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth.js';
import { useLanguage } from '../../hooks/useLanguage.js';

const LogoutConfirmModal = ({ show, onClose }) => {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const { t } = useLanguage();

  if (!show) return null;

  const handleYes = () => {
    logout();
    localStorage.removeItem('transpak_token');
    onClose();
    navigate('/login', { replace: true });
  };

  return (
    <div className="tp-modal-backdrop" onClick={onClose} role="button" tabIndex={0} onKeyDown={(e) => e.key === 'Escape' && onClose()}>
      <div className="tp-modal-card p-4" onClick={(e) => e.stopPropagation()}>
        <h5 className="mb-3 fw-semibold">Logout</h5>
        <p className="text-muted mb-4">Are you sure you want to logout?</p>
        <div className="d-flex gap-2 justify-content-end">
          <button type="button" className="btn btn-outline-secondary rounded-lg px-4" onClick={onClose}>
            No
          </button>
          <button type="button" className="btn btn-primary rounded-lg px-4" onClick={handleYes}>
            Yes
          </button>
        </div>
      </div>
    </div>
  );
};

export default LogoutConfirmModal;
