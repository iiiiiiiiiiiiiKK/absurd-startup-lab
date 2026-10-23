import { useEffect, useMemo, useState } from 'react';
import { Modal } from './Modal';
import { POSTER_SIZES, canvasToBlob, renderPosterCanvas } from '../lib/poster';
import type { PosterSize } from '../lib/poster';
import type { Project } from '../lib/types';

interface Props {
  project: Project;
  onClose: () => void;
  onToast: (text: string, tone?: 'ok' | 'warn' | 'info') => void;
}

export function PosterModal({ project, onClose, onToast }: Props) {
  const [sizeKey, setSizeKey] = useState<PosterSize['key']>('portrait');
  const [preview, setPreview] = useState<string>('');
  const [downloading, setDownloading] = useState(false);

  const size = POSTER_SIZES[sizeKey];

  useEffect(() => {
    let alive = true;
    // 等一帧，确保自定义字体（PingFang / 雅黑）就用系统字体渲染，避免首帧字体回退
    const timer = window.setTimeout(() => {
      try {
        const canvas = renderPosterCanvas(project, sizeKey);
        if (alive) setPreview(canvas.toDataURL('image/png'));
      } catch {
        if (alive) setPreview('');
      }
    }, 30);
    return () => {
      alive = false;
      window.clearTimeout(timer);
    };
  }, [project, sizeKey]);

  const meta = useMemo(() => `${size.width} × ${size.height}`, [size]);

  async function handleDownload() {
    if (downloading) return;
    setDownloading(true);
    try {
      const canvas = renderPosterCanvas(project, sizeKey);
      const blob = await canvasToBlob(canvas);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${project.id}_poster_${sizeKey}.png`;
      a.rel = 'noopener';
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 8000);
      onToast('海报已开始下载（PNG）', 'ok');
    } catch {
      onToast('海报生成失败，请重试', 'warn');
    } finally {
      setDownloading(false);
    }
  }

  return (
    <Modal onClose={onClose} title={`项目海报 · ${meta}`} labelledBy="poster-title" width={560}>
      <div className="poster-wrap">
        <div className="seg" role="group" aria-label="海报尺寸">
          <button
            aria-pressed={sizeKey === 'portrait'}
            onClick={() => setSizeKey('portrait')}
            data-testid="poster-portrait"
          >
            竖版 1080×1440
          </button>
          <button
            aria-pressed={sizeKey === 'wide'}
            onClick={() => setSizeKey('wide')}
            data-testid="poster-wide"
          >
            横版 1200×675
          </button>
        </div>

        {preview ? (
          <img
            className="poster-preview"
            src={preview}
            alt={`${project.name} 项目海报预览`}
            data-testid="poster-preview"
          />
        ) : (
          <p style={{ fontSize: 13, color: 'var(--ink-mute)' }}>正在渲染海报…</p>
        )}

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button className="btn btn-primary" onClick={handleDownload} disabled={downloading} data-testid="poster-download">
            {downloading ? '导出中…' : '⬇️ 下载 PNG'}
          </button>
          <a
            className="btn"
            href={preview || undefined}
            download={`${project.id}_poster_${sizeKey}.png`}
            data-testid="poster-download-link"
            aria-disabled={!preview}
          >
            另存为图片
          </a>
          <button className="btn btn-ghost" onClick={onClose}>
            关闭
          </button>
        </div>
        <p style={{ fontSize: 11.5, color: 'var(--ink-mute)', margin: 0 }}>
          海报内已固定标注「模拟假设，非真实商业数据」，导出后可安全分享。
        </p>
      </div>
    </Modal>
  );
}
