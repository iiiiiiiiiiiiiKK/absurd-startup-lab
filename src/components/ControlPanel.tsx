import { CATEGORY_LIST } from '../data/categories';
import { MODE_LIST, SPICE_LIST } from '../data/modes';
import type { CategoryId, ModeId, SpiceLevel, StoreShape } from '../lib/types';

interface Props {
  settings: StoreShape['settings'];
  currentName: string | null;
  onMode: (m: ModeId) => void;
  onSpice: (s: SpiceLevel) => void;
  onCategory: (c: CategoryId | 'random') => void;
  onToggleLockName: () => void;
  lockNameOn: boolean;
  onGenerate: () => void;
  onGenerateCategory: (c: CategoryId) => void;
}

const SPICE_ORDER: SpiceLevel[] = ['mild', 'heavy', 'extreme'];

export function ControlPanel({
  settings,
  currentName,
  onMode,
  onSpice,
  onCategory,
  onToggleLockName,
  lockNameOn,
  onGenerate,
  onGenerateCategory,
}: Props) {
  const spiceIndex = SPICE_ORDER.indexOf(settings.spice);
  const spice = SPICE_LIST[spiceIndex];

  return (
    <section className="console" aria-label="生成控制台" data-testid="console">
      <div className="console-head">
        <span className="console-title">// 生成控制台</span>
        <span className="tag" data-testid="console-combo">
          {MODE_LIST.length} 模式 × {CATEGORY_LIST.length} 赛道 × 3 档荒诞
        </span>
      </div>

      {/* 生成模式 */}
      <div className="control-group">
        <div className="control-label">
          <span>生成模式</span>
          <span className="control-hint">决定文案语气与结构</span>
        </div>
        <div className="mode-grid" role="group" aria-label="生成模式">
          {MODE_LIST.map((m) => (
            <button
              key={m.id}
              className="mode-btn"
              aria-pressed={settings.mode === m.id}
              onClick={() => onMode(m.id)}
              data-testid={`mode-${m.id}`}
              title={m.desc}
            >
              <div className="mode-btn-name">{m.label}</div>
              <div className="mode-btn-desc">{m.desc}</div>
            </button>
          ))}
        </div>
      </div>

      {/* 荒诞程度 */}
      <div className="control-group">
        <div className="control-label">
          <span>荒诞程度</span>
          <span className="control-hint">轻度 → 极限</span>
        </div>
        <div className="spice-row">
          <input
            className="spice"
            type="range"
            min={0}
            max={2}
            step={1}
            value={spiceIndex}
            aria-label="荒诞程度"
            aria-valuetext={spice.label}
            data-testid="spice-slider"
            onChange={(e) => {
              const next = SPICE_ORDER[Number(e.target.value)];
              if (next) onSpice(next);
            }}
          />
          <span className="spice-value" data-testid="spice-value">
            {spice.label}
          </span>
        </div>
        <div className="spice-desc" data-testid="spice-desc">
          {spice.desc}
        </div>
      </div>

      {/* 创业类别 */}
      <div className="control-group">
        <div className="control-label">
          <span>创业类别</span>
          <span className="control-hint">点选即按类别生成</span>
        </div>
        <div className="cat-grid" role="group" aria-label="创业类别">
          <button
            className="cat-chip"
            aria-pressed={settings.category === 'random'}
            onClick={() => onCategory('random')}
            data-testid="cat-random"
          >
            🎲 随机
          </button>
          {CATEGORY_LIST.map((c) => (
            <button
              key={c.id}
              className="cat-chip"
              aria-pressed={settings.category === c.id}
              onClick={() => {
                onCategory(c.id);
                onGenerateCategory(c.id);
              }}
              title={c.blurb}
              data-testid={`cat-${c.id}`}
            >
              {c.emoji} {c.label}
            </button>
          ))}
        </div>
      </div>

      {/* 锁定 */}
      <div className="control-group">
        <label className="lock-row">
          <input
            type="checkbox"
            checked={lockNameOn}
            onChange={onToggleLockName}
            data-testid="lock-name"
          />
          <span>锁定项目名称后重新生成</span>
          {lockNameOn && currentName ? (
            <span className="lock-name" data-testid="locked-name">
              {currentName}
            </span>
          ) : null}
        </label>
      </div>

      <button className="generate-btn" onClick={onGenerate} data-testid="generate">
        ⚡ 一键随机生成
      </button>
      <button
        className="generate-btn-secondary"
        onClick={() => {
          if (settings.category === 'random') onGenerate();
          else onGenerateCategory(settings.category);
        }}
        data-testid="generate-category"
      >
        {settings.category === 'random'
          ? '当前为随机类别 · 点上方标签可指定'
          : `按「${CATEGORY_LIST.find((c) => c.id === settings.category)?.label}」再生成一个`}
      </button>
    </section>
  );
}
