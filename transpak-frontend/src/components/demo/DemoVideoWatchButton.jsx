import React, { useCallback, useState } from 'react';
import DemoVideoModal from './DemoVideoModal.jsx';
import { fetchDemoVideoInfo } from '../../services/demoVideoService.js';
import { useLanguage } from '../../hooks/useLanguage.js';

/**
 * Opens official walkthrough modal. variant="authHeader" for login/register top bar; default on Help.
 */
const DemoVideoWatchButton = ({ className = '', variant = 'default' }) => {
  const { t } = useLanguage();
  const [open, setOpen] = useState(false);
  const [info, setInfo] = useState(null);

  const loadAndOpen = useCallback(async () => {
    try {
      const data = await fetchDemoVideoInfo();
      setInfo(data || {});
    } catch {
      setInfo({ hasVideo: false });
    }
    setOpen(true);
  }, []);

  const videoUrl = info?.hasVideo ? '/api/demo-video/stream' : null;
  const btnClass =
    variant === 'authHeader'
      ? `btn btn-sm rounded-pill tp-auth-v2__header-btn tp-auth-v2__header-btn--demo ${className}`.trim()
      : variant === 'compact'
        ? `btn btn-link btn-sm text-decoration-none p-0 align-baseline ${className}`.trim()
        : `btn btn-outline-primary btn-sm rounded-pill ${className}`.trim();

  return (
    <>
      <button type="button" className={btnClass} onClick={loadAndOpen}>
        {t('common.watchDemo')}
      </button>
      <DemoVideoModal
        open={open}
        onClose={() => setOpen(false)}
        videoUrl={videoUrl}
        mimeType={info?.mimeType}
        emptyMessage={t('common.demoVideoUnavailable')}
      />
    </>
  );
};

export default DemoVideoWatchButton;
