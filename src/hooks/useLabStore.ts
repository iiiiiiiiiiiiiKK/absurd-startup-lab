import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { generateProject, regenerateAll, regenerateField, signatureOf } from '../lib/generate';
import {
  emptyStore,
  loadStore,
  pruneProjects,
  pushSignature,
  removeProject,
  sanitizeProject,
  saveStore,
  toggleFavorite,
  upsertProject,
} from '../lib/storage';
import { enhanceProject, fetchAiStatus, applyPatch } from '../lib/ai';
import type { AiStatus } from '../lib/ai';
import type {
  CategoryId,
  FieldKey,
  ModeId,
  Project,
  SpiceLevel,
  StoredProject,
  StoreShape,
} from '../lib/types';

export interface Toast {
  id: number;
  text: string;
  tone: 'ok' | 'warn' | 'info';
}

const PERSIST_DELAY = 120;

/** 把「当前锁定的字段」取成 { name: '...', tagline: '...' } 形式传给生成器 */
function pickLocked(project: Project, locks: FieldKey[]): Partial<Record<FieldKey, string | string[]>> {
  const out: Partial<Record<FieldKey, string | string[]>> = {};
  for (const key of locks) {
    const value = project[key];
    if (typeof value === 'string') out[key] = value;
    else if (Array.isArray(value)) out[key] = [...value];
  }
  return out;
}

export function useLabStore() {
  const [store, setStore] = useState<StoreShape>(() => emptyStore());
  const [hydrated, setHydrated] = useState(false);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [ai, setAi] = useState<AiStatus>({ available: false, reason: 'unknown' });
  const [busy, setBusy] = useState(false);
  const saveTimer = useRef<number | null>(null);
  const toastSeq = useRef(0);

  /* ---------------- 初始化：从 localStorage 恢复 ---------------- */
  useEffect(() => {
    const loaded = loadStore();
    // 固定 ID 恢复：支持 #ASL-XXXX-XXXX 或 ?id=ASL-XXXX-XXXX 深链
    const params = new URLSearchParams(window.location.search);
    const hash = window.location.hash.replace(/^#\/?/, '').trim();
    const wanted = (params.get('id') ?? hash).toUpperCase();
    if (wanted && /^ASL-[A-Z2-9]{4}-[A-Z2-9]{4}$/.test(wanted)) {
      const found = loaded.projects.find((p) => p.id === wanted);
      if (found) loaded.currentId = found.id;
    } else if (!loaded.currentId && loaded.projects.length > 0) {
      loaded.currentId = loaded.projects[0].id;
    }
    setStore(loaded);
    setHydrated(true);
  }, []);

  /* ---------------- 当前项目 ID 同步到 URL（可分享 / 可恢复） ---------------- */
  useEffect(() => {
    if (!hydrated) return;
    const next = store.currentId ? `#${store.currentId}` : '';
    if (window.location.hash !== next) {
      window.history.replaceState(null, '', next || window.location.pathname + window.location.search);
    }
  }, [store.currentId, hydrated]);

  /* ---------------- 支持在页面内直接改 hash 跳到另一个项目 ---------------- */
  useEffect(() => {
    if (!hydrated) return;
    const onHash = () => {
      const wanted = window.location.hash.replace(/^#\/?/, '').trim().toUpperCase();
      if (!/^ASL-[A-Z2-9]{4}-[A-Z2-9]{4}$/.test(wanted)) return;
      setStore((prev) => (prev.projects.some((p) => p.id === wanted) ? { ...prev, currentId: wanted } : prev));
    };
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, [hydrated]);

  /* ---------------- 持久化：防抖写盘 ---------------- */
  useEffect(() => {
    if (!hydrated) return;
    if (saveTimer.current !== null) window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(() => {
      const outcome = saveStore(store);
      if (!outcome.ok && outcome.reason === 'quota') {
        pushToast('本地存储空间不足，已自动清理最旧的历史记录', 'warn');
        setStore((prev) => ({ ...prev, projects: pruneProjects(prev.projects, 40) }));
      }
    }, PERSIST_DELAY);
    return () => {
      if (saveTimer.current !== null) window.clearTimeout(saveTimer.current);
    };
    // pushToast 为稳定引用
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [store, hydrated]);

  /* ---------------- AI 状态探测（失败静默） ---------------- */
  useEffect(() => {
    let alive = true;
    fetchAiStatus()
      .then((status) => {
        if (alive) setAi(status);
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, []);

  const pushToast = useCallback((text: string, tone: Toast['tone'] = 'info') => {
    toastSeq.current += 1;
    const id = toastSeq.current;
    setToasts((prev) => [...prev.slice(-2), { id, text, tone }]);
    window.setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3200);
  }, []);

  const dismissToast = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const current = useMemo<StoredProject | null>(() => {
    if (!store.currentId) return null;
    return store.projects.find((p) => p.id === store.currentId) ?? null;
  }, [store.currentId, store.projects]);

  const setSettings = useCallback(
    (patch: Partial<StoreShape['settings']>) => {
      setStore((prev) => ({ ...prev, settings: { ...prev.settings, ...patch } }));
    },
    [],
  );

  const commitProject = useCallback((project: Project, opts: { toast?: string } = {}) => {
    setStore((prev) => {
      const projects = upsertProject(prev.projects, project);
      return {
        ...prev,
        projects: pruneProjects(projects),
        currentId: project.id,
        recentSignatures: pushSignature(prev.recentSignatures, signatureOf(project)),
      };
    });
    if (opts.toast) pushToast(opts.toast, 'ok');
  }, [pushToast]);

  /* ---------------- 一键生成 / 按类别生成 ---------------- */
  const generate = useCallback(
    (overrides: { mode?: ModeId; spice?: SpiceLevel; category?: CategoryId | 'random' } = {}) => {
      const mode = overrides.mode ?? store.settings.mode;
      const spice = overrides.spice ?? store.settings.spice;
      const category = overrides.category ?? store.settings.category;
      const existingIds = store.projects.map((p) => p.id);
      const locked = current ? pickLocked(current, store.settings.locks) : undefined;

      const result = generateProject({
        mode,
        spice,
        category,
        existingIds,
        recentSignatures: store.recentSignatures,
        locked,
      });
      commitProject(result.project, {
        toast: result.duplicateAvoided ? '已避开近期重复，换了一个新组合' : undefined,
      });
      return result.project;
    },
    [store.settings, store.projects, store.recentSignatures, current, commitProject],
  );

  /* ---------------- 整体重新生成（保留 ID） ---------------- */
  const regenerate = useCallback(
    (opts: { mode?: ModeId; spice?: SpiceLevel; category?: CategoryId | 'random' } = {}) => {
      if (!current) return null;
      const locked = pickLocked(current, store.settings.locks);
      // 默认跟随控制台当前设置，这样「切模式/推滑块 → 换一个」立即生效
      const nextCategory =
        opts.category ?? (store.settings.category === 'random' ? current.category : store.settings.category);
      const result = regenerateAll(current, {
        mode: opts.mode ?? store.settings.mode,
        spice: opts.spice ?? store.settings.spice,
        category: nextCategory,
        locked,
        existingIds: store.projects.map((p) => p.id),
        recentSignatures: store.recentSignatures,
      });
      commitProject(result.project, { toast: `已重新生成（${result.project.id}）` });
      return result.project;
    },
    [
      current,
      store.settings.locks,
      store.settings.mode,
      store.settings.spice,
      store.settings.category,
      store.projects,
      store.recentSignatures,
      commitProject,
    ],
  );

  /* ---------------- 单字段重新生成 ---------------- */
  const rerollField = useCallback(
    (field: FieldKey): Project | null => {
      if (!current) return null;
      const locked = pickLocked(current, store.settings.locks);
      const next = regenerateField(current, field, {
        mode: current.mode,
        spice: current.spice,
        locked,
      });
      commitProject(next, { toast: '该字段已重新生成' });
      return next;
    },
    [current, store.settings.locks, commitProject],
  );

  const toggleLock = useCallback((field: FieldKey) => {
    setStore((prev) => {
      const has = prev.settings.locks.includes(field);
      return {
        ...prev,
        settings: {
          ...prev.settings,
          locks: has
            ? prev.settings.locks.filter((f) => f !== field)
            : [...prev.settings.locks, field],
        },
      };
    });
  }, []);

  /* ---------------- 可选 AI 增强 ---------------- */
  const aiEnhance = useCallback(async () => {
    if (!current || busy) return null;
    if (!ai.available) {
      pushToast('AI 增强未启用：未检测到服务端 Key（本地生成完全可用）', 'warn');
      return null;
    }
    setBusy(true);
    try {
      // AI 只允许覆盖文案字段，metrics / id 等由前端锁死
      const res = await enhanceProject(current);
      if (!res || Object.keys(res.patch).length === 0) {
        pushToast('AI 未返回可用内容，已保留本地结果', 'warn');
        return null;
      }
      const next = applyPatch(current, res.patch);
      commitProject(next, { toast: `已用 ${res.model ?? 'AI'} 增强文案` });
      return next;
    } finally {
      setBusy(false);
    }
  }, [current, ai.available, busy, commitProject, pushToast]);

  /** 导入 JSON：把导出文件重新变回项目（含同 ID 覆盖） */
  const importProject = useCallback(
    (raw: unknown) => {
      const sanitized = sanitizeProject(raw);
      const metricsOk =
        sanitized &&
        sanitized.metrics &&
        typeof sanitized.metrics.assumption === 'string' &&
        ['tam', 'users', 'revenue', 'funding'].every((k) => typeof (sanitized.metrics as never)[k] === 'string');
      if (!sanitized || !metricsOk) {
        pushToast('文件格式不正确，无法导入', 'warn');
        return false;
      }
      commitProject(sanitized as unknown as Project, { toast: `已恢复项目 ${sanitized.id}` });
      return true;
    },
    [commitProject, pushToast],
  );

  const favorite = useCallback((id: string) => {
    setStore((prev) => ({ ...prev, projects: toggleFavorite(prev.projects, id) }));
  }, []);

  const remove = useCallback(
    (id: string) => {
      setStore((prev) => {
        const projects = removeProject(prev.projects, id);
        return {
          ...prev,
          projects,
          currentId: prev.currentId === id ? (projects[0]?.id ?? null) : prev.currentId,
        };
      });
      pushToast('已从历史中删除', 'info');
    },
    [pushToast],
  );

  const select = useCallback((id: string) => {
    setStore((prev) => ({ ...prev, currentId: id }));
  }, []);

  const clearAll = useCallback(() => {
    setStore((prev) => ({ ...prev, projects: prev.projects.filter((p) => p.favorite), currentId: null }));
    pushToast('已清空未收藏的历史项目', 'info');
  }, [pushToast]);

  const favorites = useMemo(() => store.projects.filter((p) => p.favorite), [store.projects]);

  return {
    store,
    hydrated,
    current,
    favorites,
    toasts,
    ai,
    busy,
    setSettings,
    generate,
    regenerate,
    rerollField,
    toggleLock,
    aiEnhance,
    importProject,
    favorite,
    remove,
    select,
    clearAll,
    pushToast,
    dismissToast,
  };
}
