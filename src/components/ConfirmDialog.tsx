import { useEffect } from 'react'

interface Props {
  title: string
  copy: string
  confirmLabel: string
  titleId?: string
  copyId?: string
  onCancel: () => void
  onConfirm: () => void
}

export function ConfirmDialog({
  title,
  copy,
  confirmLabel,
  titleId = 'confirm-dialog-title',
  copyId = 'confirm-dialog-copy',
  onCancel,
  onConfirm,
}: Props) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onCancel()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onCancel])

  return (
    <div className="modal-backdrop" onClick={onCancel}>
      <div
        className="confirm-dialog"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={copyId}
        onClick={(event) => event.stopPropagation()}
      >
        <h3 id={titleId}>{title}</h3>
        <p id={copyId}>{copy}</p>
        <div className="confirm-dialog-actions">
          <button type="button" className="secondary-btn" autoFocus onClick={onCancel}>
            Cancel
          </button>
          <button type="button" className="danger-btn" onClick={onConfirm}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
