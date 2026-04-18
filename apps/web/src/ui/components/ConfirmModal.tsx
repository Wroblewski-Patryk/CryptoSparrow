'use client';

import { useOptionalI18n } from '@/i18n/useOptionalI18n';

type ConfirmModalProps = {
  open: boolean;
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  confirmVariant?: 'primary' | 'error';
  pending?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

export default function ConfirmModal({
  open,
  title,
  description,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  confirmVariant = 'primary',
  pending = false,
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  const { t } = useOptionalI18n();

  if (!open) return null;

  return (
    <dialog className='modal modal-open' aria-modal='true' role='dialog'>
      <div className='modal-box'>
        <h3 className='font-bold text-lg mb-2'>{title}</h3>
        {description ? <p className='mb-4 text-sm opacity-80'>{description}</p> : null}
        <div className='modal-action'>
          <button type='button' className='btn' onClick={onCancel} disabled={pending}>
            {cancelLabel}
          </button>
          <button
            type='button'
            className={`btn ${confirmVariant === 'error' ? 'btn-error' : 'btn-primary'}`}
            onClick={onConfirm}
            disabled={pending}
          >
            {pending ? '...' : confirmLabel}
          </button>
        </div>
      </div>
      <div
        className='modal-backdrop'
        role='button'
        aria-label={t('public.a11y.closeModal')}
        tabIndex={0}
        onClick={onCancel}
        onKeyDown={() => onCancel()}
      />
    </dialog>
  );
}
