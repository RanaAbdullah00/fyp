import React from 'react';
import LanguageToggle from '../ui/LanguageToggle.jsx';
import DemoVideoWatchButton from '../demo/DemoVideoWatchButton.jsx';

/**
 * Global auth bar: language + watch demo (only on login/register). Not inside the form card.
 */
const AuthHeaderActions = () => (
  <div className="tp-auth-v2__actions d-flex align-items-center gap-2 flex-wrap justify-content-end">
    <LanguageToggle className="tp-auth-v2__header-btn" />
    <DemoVideoWatchButton variant="authHeader" />
  </div>
);

export default AuthHeaderActions;
