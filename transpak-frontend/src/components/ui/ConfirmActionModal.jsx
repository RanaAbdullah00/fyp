import React, { useState } from 'react';
import Button from './Button.jsx';
import { useLanguage } from '../../hooks/useLanguage.js';

const ConfirmActionModal = ({
  show,
  title,
  message,
  confirmText,
  cancelText,
  confirmVariant = 'primary',
  onConfirm,
  onClose
}) => {
  const { t } = useLanguage();
  const [busy, setBusy] = useState(false);

  if (!show) return null;

  const handleConfirm = async () => {
    try {
      setBusy(true);
      await onConfirm?.();
    } finally {
      setBusy(false);
      onClose?.();
    }
  };

  return (
    <div
      className="tp-modal-backdrop tp-blur-backdrop"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <div className="tp-modal-card p-4" style={{ maxWidth: 520 }} onClick={(e) => e.stopPropagation()}>
        <div className="d-flex align-items-center justify-content-between mb-2">
          <div className="fw-semibold">{title ?? t('ui.confirm.areYouSure')}</div>
          <button
            type="button"
            className="btn btn-sm btn-outline-secondary rounded-lg"
            onClick={onClose}
            aria-label={t('ui.button.close')}
          >
            ✕
          </button>
        </div>
        <p className="text-muted mb-4">{message ?? t('ui.confirm.areYouSure')}</p>
        <div className="d-flex gap-2 justify-content-end">
          <Button variant="outline-secondary" onClick={onClose} className="px-4">
            {cancelText ?? t('ui.button.cancel')}
          </Button>
          <Button variant={confirmVariant} onClick={handleConfirm} disabled={busy} className="px-4">
            {busy ? t('common.loading') : confirmText ?? t('ui.button.confirm')}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmActionModal;

