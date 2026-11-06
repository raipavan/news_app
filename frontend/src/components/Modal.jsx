import { useEffect } from 'react';

export default function Modal({ open, onClose, title, children, footer, width }) {
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (event) => {
      if (event.key === 'Escape') onClose?.();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div
      className="modal-backdrop open"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose?.();
      }}
    >
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-label={typeof title === 'string' ? title : undefined}
        style={width ? { width: `min(${width}px, 100%)` } : undefined}
      >
        {title ? <h3>{title}</h3> : null}
        <div className="modal-body">{children}</div>
        {footer ? <div className="modal-actions between">{footer}</div> : null}
      </div>
    </div>
  );
}
