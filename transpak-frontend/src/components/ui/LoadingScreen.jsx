import React from 'react';
import BrandLogo from '../layout/BrandLogo.jsx';

// Full-screen loading UI to prevent blank screens during async gates.
const LoadingScreen = ({ message = 'Loading…' }) => {
  return (
    <div className="tp-loading-screen">
      <div className="tp-loading-card">
        <BrandLogo className="tp-loading-logo" />
        <div className="small text-muted mt-2">{message}</div>
      </div>
    </div>
  );
};

export default LoadingScreen;

