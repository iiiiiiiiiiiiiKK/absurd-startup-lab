import { getCategory } from '../data/categories';
import { MODES, SPICE } from '../data/modes';
import { ALL_FIELD_LABELS, EXTRA_FIELD_META, FIELD_META } from '../lib/fields';
import type { FieldKey, StoredProject } from '../lib/types';

interface Props {
  project: StoredProject;
  locks: FieldKey[];
  busy: boolean;
  aiAvailable: boolean;
  onReroll: (f: FieldKey) => void;
  onToggleLock: (f: FieldKey) => void;
  onFavorite: () => void;
  onDelete: () => void;
  onCopyAll: () => void;
  onCopyTweet: () => void;
  onExportMd: () => void;
  onExportJson: () => void;
  onPoster: () => void;
  onAngles: () => void;
  onAiEnhance: () => void;
  onRegenerate: () => void;
  onOpenHistory: () => void;
}

function FieldActions({
  field,
  locked,
  onReroll,
  onToggleLock,
  busy,
}: {
  field: FieldKey;
  locked: boolean;
  onReroll: (f: FieldKey) => void;
  onToggleLock: (f: FieldKey) => void;
  busy: boolean;
}) {
  return (
    <div className="field-actions">
      <button
        className="btn btn-ghost btn-icon"
        onClick={() => onToggleLock(field)}
        aria-pressed={locked}
        title={locked ? `解锁「${ALL_FIELD_LABELS[field]}」` : `锁定「${ALL_FIELD_LABELS[field]}」`}
        aria-label={locked ? '解锁该字段' : '锁定该字段'}
        data-testid={`lock-${field}`}
        style={locked ? { background: 'rgba(255,77,141,0.14)', color: 'var(--accent-ink)' } : undefined}
      >
        {locked ? '🔒' : '🔓'}
      </button>
      <button
        className="btn btn-ghost btn-icon"
        onClick={() => onReroll(field)}
        disabled={busy}
        title={`重新生成「${ALL_FIELD_LABELS[field]}」`}
        aria-label={`重新生成${ALL_FIELD_LABELS[field]}`}
        data-testid={`reroll-${field}`}
      >
        ↻
      </button>
    </div>
  );
}

export function ProposalView(props: Props) {
  const { project: p, locks, busy } = props;
  const cat = getCategory(p.category);
  const mode = MODES[p.mode];
  const spice = SPICE[p.spice];
  const isLocked = (f: FieldKey) => locks.includes(f);

  const common = {
    onReroll: props.onReroll,
    onToggleLock: props.onToggleLock,
    busy,
  };

  return (
    <article className="proposal" data-testid="proposal" data-project-id={p.id} data-mode={p.mode}>
      <header className="proposal-top">
        <div className="proposal-meta">
          <span className="tag tag-mode" data-testid="proposal-mode">
            {mode.label}
          </span>
          <span className="tag tag-spice" data-testid="proposal-spice">
            荒诞 · {spice.label}
          </span>
          <span className="tag">
            {cat.emoji} {cat.label}
          </span>
          <span className="tag tag-id" data-testid="proposal-id" title="项目固定 ID，可用于保存与恢复">
            {p.id}
          </span>
          <span className="tag">v{p.revision}</span>
          {p.favorite ? <span className="tag">★ 已收藏</span> : null}
          {p.aiEnhanced ? <span className="tag">AI 增强</span> : null}
        </div>

        {/* 名称与口号：各自可重生成 / 锁定 */}
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
          <h2 className="proposal-name" data-testid="proposal-name">
            {p.name}
          </h2>
          <FieldActions field="name" locked={isLocked('name')} {...common} />
        </div>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
          <p className="proposal-tagline" data-testid="proposal-tagline">
            {p.tagline}
          </p>
          <FieldActions field="tagline" locked={isLocked('tagline')} {...common} />
        </div>

        <div className="proposal-actions">
          <button className="btn btn-primary btn-sm" onClick={props.onCopyAll} data-testid="copy-all">
            📋 复制完整计划
          </button>
          <button className="btn btn-sm" onClick={props.onPoster} data-testid="poster">
            🖼️ 生成海报
          </button>
          <button className="btn btn-sm" onClick={props.onAngles} data-testid="angles">
            🐦 X 推广角度
          </button>
          <button className="btn btn-sm" onClick={props.onExportMd} data-testid="export-md">
            ⬇️ Markdown
          </button>
          <button className="btn btn-sm" onClick={props.onExportJson} data-testid="export-json">
            ⬇️ JSON
          </button>
          <button
            className="btn btn-sm"
            onClick={props.onFavorite}
            aria-pressed={p.favorite}
            data-testid="favorite"
          >
            {p.favorite ? '★ 已收藏' : '☆ 收藏'}
          </button>
          <button
            className="btn btn-sm"
            onClick={props.onAiEnhance}
            disabled={busy}
            title={props.aiAvailable ? '调用服务端 AI 增强文案' : '未配置服务端 Key，本地生成仍然可用'}
            data-testid="ai-enhance"
          >
            ✨ AI 增强{props.aiAvailable ? '' : '（未启用）'}
          </button>
          <button className="btn btn-sm btn-accent" onClick={props.onRegenerate} data-testid="regenerate">
            ↻ 换一个（保留 ID）
          </button>
          <button className="btn btn-ghost btn-sm" onClick={props.onDelete} data-testid="delete">
            删除
          </button>
        </div>
      </header>

      <div className="proposal-body">
        {FIELD_META.map((f) => (
          <section
            className="field"
            key={f.key}
            data-testid={`field-${f.key}`}
            data-locked={isLocked(f.key) ? '1' : '0'}
          >
            <div className="field-head">
              <span className="field-label">{f.label}</span>
              {isLocked(f.key) ? <span className="tag">已锁定</span> : null}
              <FieldActions field={f.key} locked={isLocked(f.key)} {...common} />
            </div>
            <div className="field-body">
              {f.key === 'features' ? (
                <ul className="field-list">
                  {p.features.map((item, i) => (
                    <li key={`${f.key}-${i}`} data-testid={`feature-${i}`}>
                      {item}
                    </li>
                  ))}
                </ul>
              ) : f.key === 'tweet' ? (
                <>
                  <pre className="tweet-box" data-testid="tweet-text">
                    {p.tweet}
                  </pre>
                  <button
                    className="btn btn-sm"
                    style={{ marginTop: 8 }}
                    onClick={props.onCopyTweet}
                    data-testid="copy-tweet"
                  >
                    复制这条
                  </button>
                </>
              ) : (
                <p data-testid={`text-${f.key}`}>
                  {(p as unknown as Record<FieldKey, string>)[f.key]}
                </p>
              )}
            </div>
          </section>
        ))}

        <div className="field-row-2">
          {EXTRA_FIELD_META.map((f) => (
            <section
              className="field"
              key={f.key}
              data-testid={`field-${f.key}`}
              data-locked={isLocked(f.key) ? '1' : '0'}
            >
              <div className="field-head">
                <span className="field-label">{f.label}</span>
                {isLocked(f.key) ? <span className="tag">已锁定</span> : null}
                <FieldActions field={f.key} locked={isLocked(f.key)} {...common} />
              </div>
              <div className="field-body">
                {f.key === 'investorQuestions' ? (
                  <ul className="field-list">
                    {p.investorQuestions.map((q, i) => (
                      <li key={`q-${i}`} data-testid={`investor-q-${i}`}>
                        {q}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <blockquote className="field-quote" data-testid="founder-dread">
                    {p.founderDread}
                  </blockquote>
                )}
              </div>
            </section>
          ))}
        </div>

        {/* 模拟数据：强制标注 */}
        <div className="metrics-box" data-testid="metrics">
          <div className="metrics-title">⚠️ 模拟假设 · 非真实商业数据</div>
          <p className="metrics-note">{p.metrics.assumption}</p>
          <div className="metrics-grid">
            <div className="metric">{p.metrics.tam}</div>
            <div className="metric">{p.metrics.users}</div>
            <div className="metric">{p.metrics.revenue}</div>
            <div className="metric">{p.metrics.funding}</div>
          </div>
        </div>
      </div>
    </article>
  );
}
