import React, { useEffect } from 'react';
import Modal from '../ui/Modal.jsx';

const DemoVideoModal = ({ open, onClose, videoUrl, mimeType }) => {
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key === 'Escape') onClose?.();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <Modal open={open} onClose={onClose} title="TransPak demo">
      <div className="ratio ratio-16x9 bg-dark rounded-2 overflow-hidden">
        {videoUrl ? (
          <video key={videoUrl} className="w-100 h-100" controls playsInline preload="metadata">
            <source src={videoUrl} type={mimeType || 'video/mp4'} />
            Your browser does not support embedded video.
          </video>
        ) : (
          <div className="d-flex align-items-center justify-content-center text-white small p-3">No video URL</div>
        )}
      </div>
      <p className="small text-muted mt-2 mb-0">Official TransPak walkthrough (admin-managed).</p>
    </Modal>
  );
};

export default DemoVideoModal;
