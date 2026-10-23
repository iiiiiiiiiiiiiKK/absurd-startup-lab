import type { ModeId, Project, SpiceLevel, StoredProject, StoreShape, CategoryId } from './types';
import { FIELD_KEYS } from './types';
import { CATEGORY_IDS } from '../data/categories';

export const STORAGE_KEY = 'asl.store.v1';
/** 历史上限：超过后自动丢弃最旧的未收藏项 */
export const MAX_HISTORY = 120;
const MAX_SIGNATURES = 40;

export function emptyStore(): StoreShape {
  return {
    version: 1,
    projects: [],
    settings: { mode: 'spoof', spice: 'heavy', category: 'random', locks: [] },
    currentId: null,
    recentSignatures: [],
  };
}

function isObj(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

const VALID_MODES: ModeId[] = ['spoof', 'corporate', 'indie', 'ai', 'netculture', 'serious'];
const VALID_SPICE: SpiceLevel[] = ['mild', 'heavy', 'extreme'];

/** 严格校验：任何损坏数据都不应让页面白屏，只丢弃该条 */
export function sanitizeProject(raw: unknown): StoredProject | null {
  if (!isObj(raw)) return null;
  const required = [
    'id',
    'name',
    'tagline',
    'targetUsers',
    'painPoints',
    'solution',
    'pricing',
    'acquisition',
    'wildestHook',
    'tweet',
    'founderDread',
  ];
  for (const k of required) {
    if (typeof raw[k] !== 'string' || (raw[k] as string).trim() === '') return null;
  }
  if (!/^ASL-[A-Z2-9]{4}-[A-Z2-9]{4}$/.test(raw.id as string)) return null;
  if (!VALID_MODES.includes(raw.mode as ModeId)) return null;
  if (!VALID_SPICE.includes(raw.spice as SpiceLevel)) return null;
  if (!CATEGORY_IDS.includes(raw.category as CategoryId)) return null;
  if (!Array.isArray(raw.features) || raw.features.length === 0) return null;
  if (!Array.isArray(raw.investorQuestions) || raw.investorQuestions.length === 0) return null;
  if (!isObj(raw.metrics) || typeof (raw.metrics as Record<string, unknown>).assumption !== 'string') {
    return null;
  }
  return {
    ...(raw as unknown as StoredProject),
    favorite: raw.favorite === true,
    savedAt: typeof raw.savedAt === 'number' ? raw.savedAt : Date.now(),
    revision: typeof raw.revision === 'number' ? raw.revision : 1,
  };
}

export function sanitizeStore(raw: unknown): StoreShape {
  const base = emptyStore();
  if (!isObj(raw)) return base;

  const projects: StoredProject[] = [];
  const seen = new Set<string>();
  if (Array.isArray(raw.projects)) {
    for (const item of raw.projects) {
      const p = sanitizeProject(item);
      if (p && !seen.has(p.id)) {
        seen.add(p.id);
        projects.push(p);
      }
    }
  }

  const settings = isObj(raw.settings) ? raw.settings : {};
  const mode = VALID_MODES.includes(settings.mode as ModeId) ? (settings.mode as ModeId) : base.settings.mode;
  const spice = VALID_SPICE.includes(settings.spice as SpiceLevel)
    ? (settings.spice as SpiceLevel)
    : base.settings.spice;
  const category =
    settings.category === 'random' || CATEGORY_IDS.includes(settings.category as CategoryId)
      ? (settings.category as CategoryId | 'random')
      : 'random';

  const currentId = typeof raw.currentId === 'string' && seen.has(raw.currentId) ? raw.currentId : null;

  const recentSignatures = Array.isArray(raw.recentSignatures)
    ? raw.recentSignatures.filter((s): s is string => typeof s === 'string').slice(-MAX_SIGNATURES)
    : [];

  const locksRaw = Array.isArray(settings.locks) ? settings.locks : [];
  const locks = FIELD_KEYS.filter((k) => locksRaw.includes(k));

  return {
    version: 1,
    projects,
    settings: { mode, spice, category, locks },
    currentId,
    recentSignatures,
  };
}

function storage(): Storage | null {
  try {
    if (typeof localStorage === 'undefined') return null;
    // 触发一次探测，Safari 隐私模式下 setItem 会抛错
    const probe = '__asl_probe__';
    localStorage.setItem(probe, '1');
    localStorage.removeItem(probe);
    return localStorage;
  } catch {
    return null;
  }
}

export function loadStore(): StoreShape {
  const ls = storage();
  if (!ls) return emptyStore();
  try {
    const raw = ls.getItem(STORAGE_KEY);
    if (!raw) return emptyStore();
    return sanitizeStore(JSON.parse(raw));
  } catch {
    return emptyStore();
  }
}

export type SaveOutcome = { ok: true } | { ok: false; reason: 'quota' | 'unavailable' };

export function saveStore(store: StoreShape): SaveOutcome {
  const ls = storage();
  if (!ls) return { ok: false, reason: 'unavailable' };
  try {
    ls.setItem(STORAGE_KEY, JSON.stringify(store));
    return { ok: true };
  } catch {
    return { ok: false, reason: 'quota' };
  }
}

/** 裁剪历史：保留全部收藏 + 最近的未收藏项 */
export function pruneProjects(list: StoredProject[], max = MAX_HISTORY): StoredProject[] {
  if (list.length <= max) return list;
  const sorted = [...list].sort((a, b) => b.savedAt - a.savedAt);
  const favorites = sorted.filter((p) => p.favorite);
  const rest = sorted.filter((p) => !p.favorite);
  return [...favorites, ...rest.slice(0, Math.max(0, max - favorites.length))];
}

export function toStored(project: Project, favorite = false, savedAt = Date.now()): StoredProject {
  return { ...project, favorite, savedAt };
}

/** 更新或插入（按 ID） */
export function upsertProject(list: StoredProject[], project: Project): StoredProject[] {
  const idx = list.findIndex((p) => p.id === project.id);
  if (idx >= 0) {
    const next = [...list];
    next[idx] = { ...project, favorite: list[idx].favorite, savedAt: Date.now() };
    return next;
  }
  return [toStored(project), ...list];
}

export function toggleFavorite(list: StoredProject[], id: string): StoredProject[] {
  return list.map((p) => (p.id === id ? { ...p, favorite: !p.favorite } : p));
}

export function removeProject(list: StoredProject[], id: string): StoredProject[] {
  return list.filter((p) => p.id !== id);
}

export function pushSignature(list: string[], sig: string): string[] {
  return [...list.filter((s) => s !== sig), sig].slice(-MAX_SIGNATURES);
}
