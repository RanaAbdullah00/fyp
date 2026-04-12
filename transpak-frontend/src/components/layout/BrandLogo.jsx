import React from 'react';
import { FaTruck, FaShip, FaPlane } from 'react-icons/fa';

/**
 * Brand mark: full = wordmark + icons; mark = icon-only; auth = enterprise wordmark in auth card.
 */
const BrandLogo = ({ className = '', onClick, title = 'TransPak', variant = 'full' }) => {
  const isMark = variant === 'mark';
  const isAuth = variant === 'auth';
  return (
    <div
      className={`tp-brand-logo d-flex ${
        isMark
          ? 'flex-row align-items-center tp-brand-logo--mark'
          : isAuth
          ? 'flex-row align-items-center justify-content-start flex-wrap gap-2 tp-brand-logo--auth tp-brand-logo--auth-inline'
          : 'flex-column align-items-center justify-content-center'
      } ${className}`}
      onClick={onClick}
      onKeyDown={(e) => {
        if (onClick && (e.key === 'Enter' || e.key === ' ')) {
          e.preventDefault();
          onClick(e);
        }
      }}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      aria-label={title}
    >
      {!isMark ? (
        <span className={`tp-brand-logo__text ${isAuth ? 'tp-brand-logo__text--auth' : ''}`}>TRANSPAK</span>
      ) : null}
      {!isMark && !isAuth ? <span className="tp-brand-logo__rule" aria-hidden="true" /> : null}
      {isAuth ? <span className="tp-brand-logo__rule tp-brand-logo__rule--vertical d-none d-sm-inline" aria-hidden="true" /> : null}
      <div
        className={`tp-brand-logo__icons ${isMark ? 'tp-brand-logo__icons--mark' : ''} ${isAuth ? 'tp-brand-logo__icons--auth' : ''}`}
        aria-hidden="true"
      >
        <FaTruck className="tp-brand-logo__icon" />
        <FaShip className="tp-brand-logo__icon" />
        <FaPlane className="tp-brand-logo__icon" />
      </div>
    </div>
  );
};

export default BrandLogo;
