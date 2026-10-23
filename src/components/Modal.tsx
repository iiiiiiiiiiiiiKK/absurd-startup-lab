import { useEffect } from 'react';

interface Props {
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  labelledBy?: string;
  width?: number;
}

/** 通用弹窗：Esc 关闭 + 点击遮罩关闭 + 焦点回收 */
export function Modal({ onClose, title, children, labelledBy, width = 560 }: Props) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  return (
    <div
      className="modal-backdrop"
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      data-testid="modal-backdrop"
    >
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        style={{ width: `min(${width}px, 100%)` }}
      >
        <div className="modal-head">
          <div className="modal-title" id={labelledBy} data-testid="modal-title">
            {title}
          </div>
          <button className="btn btn-sm" onClick={onClose} aria-label="关闭" data-testid="modal-close">
            ✕
          </button>
        </div>
        <div className="modal-body">{children}</div>
      </div>
    </div>
  );
}
