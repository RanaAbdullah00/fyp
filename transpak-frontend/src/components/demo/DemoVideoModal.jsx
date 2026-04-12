import React from 'react';
import Modal from '../ui/Modal.jsx';
import { useLanguage } from '../../hooks/useLanguage.js';

const STREAM_PATH = '/api/demo-video/stream';

const DemoVideoModal = ({ open, onClose, videoUrl, mimeType, emptyMessage }) => {
  const { t } = useLanguage();
  const src = videoUrl || (open ? STREAM_PATH : null);

  return (
    <Modal open={open} onClose={onClose} title={t('common.watchDemo')} size="lg">
      {src ? (
        <video
          key={src}
          className="w-100 rounded-3"
          style={{ maxHeight: '56vh', background: '#000' }}
          controls
          playsInline
          preload="metadata"
        >
          <source src={src} type={mimeType || 'video/mp4'} />
        </video>
      ) : (
        <p className="small text-muted mb-0">{emptyMessage || t('common.demoVideoUnavailable')}</p>
      )}
      <p className="small text-muted mt-2 mb-0">{t('common.demoVideoFooter')}</p>
    </Modal>
  );
};

export default DemoVideoModal;
