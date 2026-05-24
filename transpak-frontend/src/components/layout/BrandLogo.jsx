import React from 'react';

/** TransPak TP mark — italic T (contrast) + P (green). Used site-wide. */
export const TpMark = ({ compact = false, className = '' }) => (
  <span
    className={`tp-brand-mark ${compact ? 'tp-brand-mark--compact' : ''} ${className}`.trim()}
    aria-hidden="true"
  >
    <span className="tp-brand-mark__t">T</span>
    <span className="tp-brand-mark__p">P</span>
  </span>
);

/**
 * TransPak branding — consistent TP mark + optional wordmark.
 */
const BrandLogo = ({ className = '', onClick, title = 'TransPak', variant = 'full' }) => {
  const isMark = variant === 'mark';
  const isAuth = variant === 'auth';

  const wordmark = (
    <span className={`tp-brand-logo__wordmark ${isAuth ? 'tp-brand-logo__wordmark--auth' : ''}`}>
      <span className="tp-brand-logo__trans">TRANS</span>
      <span className="tp-brand-logo__pak">PAK</span>
    </span>
  );

  return (
    <div
      dir="ltr"
      className={`tp-brand-logo tp-brand-logo--ltr d-flex ${
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
      <TpMark compact={isMark || isAuth} />
      {isMark ? null : wordmark}
      {!isMark && !isAuth ? <span className="tp-brand-logo__rule" aria-hidden="true" /> : null}
      {isAuth ? <span className="tp-brand-logo__rule tp-brand-logo__rule--vertical d-none d-sm-inline" aria-hidden="true" /> : null}
    </div>
  );
};

export default BrandLogo;
