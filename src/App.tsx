import { useCallback, useMemo, useState } from 'react';
import { ControlPanel } from './components/ControlPanel';
import { ProposalView } from './components/ProposalView';
import { HistoryDrawer } from './components/HistoryDrawer';
import { PosterModal } from './components/PosterModal';
import { AnglesModal } from './components/AnglesModal';
import { useLabStore } from './hooks/useLabStore';
import { CATEGORY_LIST } from './data/categories';
import { MODES } from './data/modes';
import {
  copyText,
  downloadJson,
  downloadMarkdown,
  toMarkdown,
  toPlainText,
} from './lib/export';
import { materialStats } from './lib/generate';
import type { CategoryId, FieldKey, ModeId, SpiceLevel, StoredProject } from './lib/types';

const STATS = materialStats();
const TOTAL_COMBOS = STATS.reduce((sum, c) => sum + c.combos, 0);

export function App() {
  const lab = useLabStore();
  const [historyOpen, setHistoryOpen] = useState(false);
  const [posterOpen, setPosterOpen] = useState(false);
  const [anglesOpen, setAnglesOpen] = useState(false);

  const { store, current, hydrated, toasts, setSettings } = lab;
  const locks = store.settings.locks;

  const handleCopyAll = useCallback(async () => {
    if (!current) return;
    const ok = await copyText(toMarkdown(current));
    lab.pushToast(ok ? '完整创业计划已复制（Markdown）' : '复制失败，请手动选择', ok ? 'ok' : 'warn');
  }, [current, lab]);

  const handleCopyTweet = useCallback(async () => {
    if (!current) return;
    const ok = await copyText(current.tweet);
    lab.pushToast(ok ? 'X 文案已复制' : '复制失败，请手动选择', ok ? 'ok' : 'warn');
  }, [current, lab]);

  const handleExportMd = useCallback(() => {
    if (!current) return;
    downloadMarkdown(current);
    lab.pushToast('Markdown 已导出', 'ok');
  }, [current, lab]);

  const handleExportJson = useCallback(() => {
    if (!current) return;
    downloadJson(current);
    lab.pushToast('JSON 已导出', 'ok');
  }, [current, lab]);

  const handleSelect = useCallback(
    (id: string) => {
      lab.select(id);
      setHistoryOpen(false);
    },
    [lab],
  );

  const mode = MODES[store.settings.mode];

  const exampleCards = useMemo(
    () => [
      { name: '「明天再做」', desc: '帮拖延症规划明天要做的事，并把所有未完成事项自动延期。' },
      { name: '「你说得对」', desc: '一个只会同意你的 AI，用来结束所有没有结论的争论。' },
      { name: '「周一预测器」', desc: '根据你的日历预测周一会崩在哪一刻，并提前发出警告。' },
      { name: '「冷静期」', desc: '把冲动消费的那 3 秒，拉长到 3 分钟。' },
    ],
    [],
  );

  return (
    <div className="shell" data-mode={current?.mode ?? store.settings.mode} data-testid="shell">
      <header className="topbar">
        <div className="brand">
          <div className="brand-mark" aria-hidden="true">
            🧪
          </div>
          <div className="brand-text">
            <div className="brand-title">离谱创业模拟器</div>
            <div className="brand-sub">Absurd Startup Lab</div>
          </div>
        </div>
        <div className="topbar-spacer" />
        <div className="topbar-actions">
          <span className="tag" data-testid="ai-state" title={lab.ai.reason ?? ''}>
            {lab.ai.available ? `AI 增强已启用${lab.ai.model ? ` · ${lab.ai.model}` : ''}` : '本地生成模式（无需 Key）'}
          </span>
          <button className="btn btn-sm" onClick={() => setHistoryOpen(true)} data-testid="open-history">
            📚 历史 {store.projects.length > 0 ? `(${store.projects.length})` : ''}
          </button>
          <label className="btn btn-sm" style={{ cursor: 'pointer' }} data-testid="import-label">
            📥 恢复
            <input
              type="file"
              accept="application/json,.json"
              className="sr-only"
              data-testid="import-input"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                e.target.value = '';
                if (!file) return;
                try {
                  const text = await file.text();
                  lab.importProject(JSON.parse(text));
                } catch {
                  lab.pushToast('无法解析该文件', 'warn');
                }
              }}
            />
          </label>
          {current ? (
            <button
              className="btn btn-sm"
              onClick={() => lab.regenerate({ mode: store.settings.mode, spice: store.settings.spice })}
              data-testid="top-regenerate"
            >
              ↻ 再来一个
            </button>
          ) : null}
          <a
            className="x-link"
            href="https://x.com/0xkillcoin"
            target="_blank"
            rel="noopener noreferrer"
            title="作者 X：@0xkillcoin"
            aria-label="作者 X：@0xkillcoin"
            data-testid="author-x"
          >
            𝕏
          </a>
        </div>
      </header>

      <div className="hero">
        <div className="hero-copy">
          <div className="eyebrow">
            <span className="eyebrow-dot" />
            IDEA WORKBENCH · 无 Key 可用
          </div>
          <h1>
            下一个改变世界的项目，
            <br />
            <em>可能很荒唐。</em>
          </h1>
          <p className="hero-lead">
            选一个赛道、挑一种语气、推一下荒诞程度，点生成。
            你会得到一份结构完整、逻辑自洽、并且真的可以拿去讲三分钟的创业提案——
            包含目标用户、痛点、方案、功能、收费、获客、最离谱的卖点、投资人会问什么，
            以及创始人最不愿回答的那个问题。
          </p>
          <div className="hero-stats">
            <div className="stat">
              <div className="stat-num" data-testid="stat-combos">
                {TOTAL_COMBOS.toLocaleString('en-US')}
              </div>
              <div className="stat-label">素材组合数</div>
            </div>
            <div className="stat">
              <div className="stat-num">{CATEGORY_LIST.length}</div>
              <div className="stat-label">独立赛道模板</div>
            </div>
            <div className="stat">
              <div className="stat-num">{Object.keys(MODES).length}</div>
              <div className="stat-label">生成模式</div>
            </div>
            <div className="stat">
              <div className="stat-num">0</div>
              <div className="stat-label">需要 API Key</div>
            </div>
          </div>
        </div>

        <ControlPanel
          settings={store.settings}
          currentName={current?.name ?? null}
          onMode={(m: ModeId) => setSettings({ mode: m })}
          onSpice={(s: SpiceLevel) => setSettings({ spice: s })}
          onCategory={(c: CategoryId | 'random') => setSettings({ category: c })}
          onToggleLockName={() => lab.toggleLock('name')}
          lockNameOn={locks.includes('name')}
          onGenerate={() => lab.generate()}
          onGenerateCategory={(c: CategoryId) => lab.generate({ category: c })}
        />
      </div>

      <main className="stage">
        {!hydrated ? (
          <div className="empty-state">
            <p className="empty-text">正在读取本地历史…</p>
          </div>
        ) : current ? (
          <ProposalView
            project={current}
            locks={locks}
            busy={lab.busy}
            aiAvailable={lab.ai.available}
            onReroll={(f: FieldKey) => lab.rerollField(f)}
            onToggleLock={(f: FieldKey) => lab.toggleLock(f)}
            onFavorite={() => lab.favorite(current.id)}
            onDelete={() => lab.remove(current.id)}
            onCopyAll={handleCopyAll}
            onCopyTweet={handleCopyTweet}
            onExportMd={handleExportMd}
            onExportJson={handleExportJson}
            onPoster={() => setPosterOpen(true)}
            onAngles={() => setAnglesOpen(true)}
            onAiEnhance={() => void lab.aiEnhance()}
            onRegenerate={() => lab.regenerate()}
            onOpenHistory={() => setHistoryOpen(true)}
          />
        ) : (
          <div className="empty-state" data-testid="empty-state">
            <h2 className="empty-title">工作台已就绪，等你按下生成</h2>
            <p className="empty-text">
              当前模式：<strong>{mode.label}</strong>。{mode.desc}
              先在右侧挑一个赛道，或直接点「一键随机生成」。
            </p>
            <div className="empty-samples">
              {exampleCards.map((c) => (
                <div className="sample-card" key={c.name}>
                  <div className="sample-name">{c.name}</div>
                  <div className="sample-desc">{c.desc}</div>
                </div>
              ))}
            </div>
            <button
              className="btn btn-primary"
              style={{ marginTop: 20 }}
              onClick={() => lab.generate()}
              data-testid="empty-generate"
            >
              ⚡ 立即生成第一份提案
            </button>
          </div>
        )}
      </main>

      <div className="disclaimer">
        <span aria-hidden="true">📌</span>
        <span>
          本站生成的所有项目、公司、数据均为虚构。文中出现的用户规模、收入与融资金额一律为
          <strong> 模拟假设</strong>，不构成任何商业、投资或法律建议。若输出涉及真实存在的组织或人物，纯属巧合。
        </span>
      </div>

      <footer className="footer">
        <span>离谱创业模拟器 · Absurd Startup Lab</span>
        <span>·</span>
        <span>纯前端生成引擎，无 Key 可用</span>
        <span>·</span>
        <span>数据保存在你自己的浏览器里</span>
        <span>·</span>
        <a
          className="footer-link"
          href="https://x.com/0xkillcoin"
          target="_blank"
          rel="noopener noreferrer"
          data-testid="footer-x"
        >
          作者 𝕏 @0xkillcoin
        </a>
        <span>·</span>
        <button
          className="btn btn-ghost btn-sm"
          onClick={() => {
            const text = current ? toPlainText(current) : '';
            void copyText(text).then((ok) => lab.pushToast(ok ? '已复制' : '暂无内容可复制', ok ? 'ok' : 'warn'));
          }}
        >
          复制纯文本
        </button>
      </footer>

      {/* 移动端固定操作条 */}
      <div className="mobile-bar">
        <button className="btn btn-primary" onClick={() => lab.generate()} data-testid="mobile-generate">
          ⚡ 快速生成
        </button>
        <button
          className="btn"
          onClick={handleCopyAll}
          disabled={!current}
          data-testid="mobile-copy"
        >
          📋 复制计划
        </button>
        <button className="btn" onClick={() => setHistoryOpen(true)} aria-label="历史">
          📚
        </button>
      </div>

      {historyOpen ? (
        <HistoryDrawer
          projects={store.projects}
          currentId={store.currentId}
          onSelect={handleSelect}
          onFavorite={(id) => lab.favorite(id)}
          onDelete={(id) => lab.remove(id)}
          onClose={() => setHistoryOpen(false)}
          onClear={() => lab.clearAll()}
          onExport={(p: StoredProject) => {
            downloadMarkdown(p);
            lab.pushToast('Markdown 已导出', 'ok');
          }}
        />
      ) : null}

      {posterOpen && current ? (
        <PosterModal
          project={current}
          onClose={() => setPosterOpen(false)}
          onToast={(t, tone) => lab.pushToast(t, tone)}
        />
      ) : null}

      {anglesOpen && current ? (
        <AnglesModal
          project={current}
          onClose={() => setAnglesOpen(false)}
          onToast={(t, tone) => lab.pushToast(t, tone)}
        />
      ) : null}

      <div className="toast-stack" aria-live="polite" data-testid="toast-stack">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`toast toast-${t.tone}`}
            onClick={() => lab.dismissToast(t.id)}
            data-testid="toast"
          >
            {t.text}
          </div>
        ))}
      </div>
    </div>
  );
}
