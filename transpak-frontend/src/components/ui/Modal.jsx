import React, { useEffect } from 'react';

const Modal = ({ open, title, onClose, children, size = 'md' }) => {
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key === 'Escape') onClose?.();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  const maxWidth = size === 'lg' ? 720 : size === 'sm' ? 420 : 560;

  return (
    <div className="tp-modal-backdrop tp-blur-backdrop" role="dialog" aria-modal="true" onClick={onClose}>
      <div
        className="tp-modal-card"
        style={{ maxWidth, maxHeight: '80vh', overflowY: 'auto' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="d-flex align-items-center justify-content-between mb-2">
          <button type="button" className="btn btn-sm btn-outline-secondary rounded-lg" onClick={onClose} aria-label="Close">
            ✕
          </button>
          <div className="fw-semibold">{title}</div>
          <div style={{ width: 36 }} />
        </div>
        {children}
      </div>
    </div>
  );
};

export default Modal;
