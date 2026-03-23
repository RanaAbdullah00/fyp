import React from 'react';
import { useLanguage } from '../../hooks/useLanguage.js';

// Selector used on the registration screen to choose between shipper/carrier.
const RoleSelector = ({ value, onChange }) => {
  const { t, isUrdu } = useLanguage();

  return (
    <div
      className={`tp-role-selector mb-3 ${isUrdu ? 'tp-rtl' : ''}`}
      role="group"
      aria-label={t('auth.role')}
    >
      <input
        type="radio"
        className="btn-check"
        name="role"
        id="role-shipper"
        autoComplete="off"
        value="shipper"
        checked={value === 'shipper'}
        onChange={(e) => onChange(e.target.value)}
      />
      <label className="btn btn-outline-primary" htmlFor="role-shipper">
        {t('auth.shipper')}
      </label>

      <input
        type="radio"
        className="btn-check"
        name="role"
        id="role-carrier"
        autoComplete="off"
        value="carrier"
        checked={value === 'carrier'}
        onChange={(e) => onChange(e.target.value)}
      />
      <label className="btn btn-outline-primary" htmlFor="role-carrier">
        {t('auth.carrier')}
      </label>
    </div>
  );
};

export default RoleSelector;

