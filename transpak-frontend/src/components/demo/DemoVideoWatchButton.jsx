import React, { useEffect, useState } from 'react';
import Button from '../ui/Button.jsx';
import DemoVideoModal from './DemoVideoModal.jsx';
import { fetchDemoVideoInfo } from '../../services/demoVideoService.js';

const DemoVideoWatchButton = ({ className = '' }) => {
  const [info, setInfo] = useState(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await fetchDemoVideoInfo();
        if (!cancelled) setInfo(data);
      } catch {
        if (!cancelled) setInfo({ hasVideo: false });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (!info?.hasVideo) return null;

  const videoUrl = '/api/demo-video/stream';

  return (
    <>
      <Button type="button" variant="outline-success" size="sm" className={className} onClick={() => setOpen(true)}>
        Watch demo
      </Button>
      <DemoVideoModal
        open={open}
        onClose={() => setOpen(false)}
        videoUrl={videoUrl}
        mimeType={info.mimeType || 'video/mp4'}
      />
    </>
  );
};

export default DemoVideoWatchButton;
