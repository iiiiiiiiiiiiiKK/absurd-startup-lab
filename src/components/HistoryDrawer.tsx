import { getCategory } from '../data/categories';
import { MODES, SPICE } from '../data/modes';
import type { StoredProject } from '../lib/types';

interface Props {
  projects: StoredProject[];
  currentId: string | null;
  onSelect: (id: string) => void;
  onFavorite: (id: string) => void;
  onDelete: (id: string) => void;
  onClose: () => void;
  onClear: () => void;
  onExport: (p: StoredProject) => void;
}

function relTime(ts: number): string {
  const diff = Date.now() - ts;
  if (diff < 60_000) return '刚刚';
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)} 分钟前`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)} 小时前`;
  const d = new Date(ts);
  return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(
    d.getMinutes(),
  ).padStart(2, '0')}`;
}

export function HistoryDrawer({
  projects,
  currentId,
  onSelect,
  onFavorite,
  onDelete,
  onClose,
  onClear,
  onExport,
}: Props) {
  const sorted = [...projects].sort((a, b) => b.savedAt - a.savedAt);
  const favCount = projects.filter((p) => p.favorite).length;

  return (
    <div
      className="drawer-backdrop"
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      data-testid="history-backdrop"
    >
      <aside
        className="drawer"
        role="dialog"
        aria-modal="true"
        aria-label="历史与收藏"
        data-testid="history-drawer"
      >
        <div className="drawer-head">
          <div className="drawer-title">
            历史记录 <span className="tag">{projects.length}</span>{' '}
            <span className="tag">★ {favCount}</span>
          </div>
          <button className="btn btn-sm" onClick={onClear} data-testid="history-clear">
            清空非收藏
          </button>
          <button className="btn btn-sm" onClick={onClose} aria-label="关闭历史" data-testid="history-close">
            ✕
          </button>
        </div>
        <div className="drawer-body">
          {sorted.length === 0 ? (
            <p style={{ color: 'var(--ink-mute)', fontSize: 13 }}>
              还没有历史项目。生成第一个之后会自动保存在本地浏览器里，刷新也不会丢。
            </p>
          ) : (
            sorted.map((p) => {
              const cat = getCategory(p.category);
              return (
                <div
                  key={p.id}
                  className={`history-item${p.id === currentId ? ' is-current' : ''}`}
                  data-testid={`history-item-${p.id}`}
                >
                  <div className="history-name">
                    {p.favorite ? <span className="star">★</span> : null}
                    <span>{p.name}</span>
                  </div>
                  <div className="history-tagline">{p.tagline}</div>
                  <div className="history-meta">
                    <span className="tag tag-id">{p.id}</span>
                    <span className="tag">
                      {cat.emoji} {cat.label}
                    </span>
                    <span className="tag">{MODES[p.mode].short}</span>
                    <span className="tag">荒诞 {SPICE[p.spice].label}</span>
                    <span className="tag">{relTime(p.savedAt)}</span>
                  </div>
                  <div className="history-actions">
                    <button className="btn btn-sm" onClick={() => onSelect(p.id)} data-testid={`history-open-${p.id}`}>
                      打开
                    </button>
                    <button
                      className="btn btn-sm"
                      onClick={() => onFavorite(p.id)}
                      data-testid={`history-fav-${p.id}`}
                    >
                      {p.favorite ? '★ 取消收藏' : '☆ 收藏'}
                    </button>
                    <button className="btn btn-sm" onClick={() => onExport(p)} data-testid={`history-md-${p.id}`}>
                      导出 MD
                    </button>
                    <button
                      className="btn btn-ghost btn-sm"
                      onClick={() => onDelete(p.id)}
                      data-testid={`history-del-${p.id}`}
                    >
                      删除
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </aside>
    </div>
  );
}
