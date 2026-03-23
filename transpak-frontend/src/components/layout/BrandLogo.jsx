import React from 'react';
import { FaTruck, FaShip, FaPlane } from 'react-icons/fa';

/**
 * Brand mark: TRANSPAK (all caps) + truck, cargo ship, airplane — same size, centered, theme green.
 * No gradients, taglines, or heavy animation.
 */
const BrandLogo = ({ className = '', onClick, title = 'TransPak' }) => {
  return (
    <div
      className={`tp-brand-logo d-flex flex-column align-items-center justify-content-center ${className}`}
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
      <span className="tp-brand-logo__text">TRANSPAK</span>
      <div className="tp-brand-logo__icons" aria-hidden="true">
        <FaTruck className="tp-brand-logo__icon" />
        <FaShip className="tp-brand-logo__icon" />
        <FaPlane className="tp-brand-logo__icon" />
      </div>
    </div>
  );
};

export default BrandLogo;
