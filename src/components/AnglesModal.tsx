import { useMemo, useState } from 'react';
import { Modal } from './Modal';
import { buildPromoAngles, copyText } from '../lib/export';
import type { Project } from '../lib/types';

interface Props {
  project: Project;
  onClose: () => void;
  onToast: (text: string, tone?: 'ok' | 'warn' | 'info') => void;
}

export function AnglesModal({ project, onClose, onToast }: Props) {
  const angles = useMemo(() => buildPromoAngles(project), [project]);
  const [copied, setCopied] = useState<string | null>(null);

  async function handleCopy(key: string, text: string) {
    const ok = await copyText(text);
    if (ok) {
      setCopied(key);
      onToast('已复制到剪贴板', 'ok');
      window.setTimeout(() => setCopied((c) => (c === key ? null : c)), 1800);
    } else {
      onToast('复制失败，请手动选择文本', 'warn');
    }
  }

  return (
    <Modal onClose={onClose} title="X 推广文案 · 5 个角度" labelledBy="angles-title" width={620}>
      <div className="angle-list">
        {angles.map((a) => (
          <div className="angle" key={a.key} data-testid={`angle-${a.key}`}>
            <div className="angle-head">
              <span className="angle-title">{a.label}</span>
              <span className="angle-hint">{a.hint}</span>
              <span className="tag">{a.text.length}/280</span>
              <button
                className="btn btn-sm"
                onClick={() => handleCopy(a.key, a.text)}
                data-testid={`angle-copy-${a.key}`}
              >
                {copied === a.key ? '✓ 已复制' : '复制'}
              </button>
            </div>
            <pre className="angle-text">{a.text}</pre>
          </div>
        ))}
      </div>
    </Modal>
  );
}
