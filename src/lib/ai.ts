import type { Project } from './types';

/**
 * 可选 AI 增强适配器。
 *
 * 设计原则（硬约束）：
 *  1. 前端永远不接触 API Key；Key 只存在于服务端环境变量。
 *  2. 没有服务端时，适配器静默降级，返回 null，主流程完全不受影响。
 *  3. 服务端返回的结构必须经过本地校验，任何非法字段一律丢弃，
 *     避免 AI 输出破坏「模拟数据声明」等合规文案。
 */

export interface AiStatus {
  available: boolean;
  provider?: string;
  model?: string;
  reason?: string;
}

/** 可被 AI 增强的字段（不包含 metrics，防止模型编造真实数据） */
export const AI_FIELDS = [
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
] as const;

export type AiField = (typeof AI_FIELDS)[number];

const ENDPOINT_STATUS = './api/ai-status';
const ENDPOINT_GENERATE = './api/ai-enhance';

function timeoutSignal(ms: number): AbortSignal | undefined {
  try {
    return AbortSignal.timeout(ms);
  } catch {
    const ctrl = new AbortController();
    setTimeout(() => ctrl.abort(), ms);
    return ctrl.signal;
  }
}

export async function fetchAiStatus(fetchImpl: typeof fetch = fetch): Promise<AiStatus> {
  try {
    const res = await fetchImpl(ENDPOINT_STATUS, {
      method: 'GET',
      headers: { accept: 'application/json' },
      signal: timeoutSignal(4000),
    });
    if (!res.ok) return { available: false, reason: `status ${res.status}` };
    const data = (await res.json()) as Partial<AiStatus>;
    return {
      available: data.available === true,
      provider: typeof data.provider === 'string' ? data.provider : undefined,
      model: typeof data.model === 'string' ? data.model : undefined,
      reason: typeof data.reason === 'string' ? data.reason : undefined,
    };
  } catch (err) {
    return { available: false, reason: err instanceof Error ? err.message : 'network error' };
  }
}

interface EnhancePayload {
  mode: string;
  spice: string;
  category: string;
  fields: readonly AiField[];
  project: Pick<Project, 'name' | 'tagline' | 'targetUsers' | 'painPoints' | 'wildestHook'>;
}

export interface EnhanceResult {
  patch: Partial<Record<AiField, string>>;
  model?: string;
}

/**
 * 请求服务端增强。返回的 patch 只包含合法字符串字段，
 * 且长度被限制在合理区间（避免超长内容撑破排版）。
 */
export async function enhanceProject(
  p: Project,
  fields: readonly AiField[] = AI_FIELDS,
  fetchImpl: typeof fetch = fetch,
): Promise<EnhanceResult | null> {
  const payload: EnhancePayload = {
    mode: p.mode,
    spice: p.spice,
    category: p.category,
    fields,
    project: {
      name: p.name,
      tagline: p.tagline,
      targetUsers: p.targetUsers,
      painPoints: p.painPoints,
      wildestHook: p.wildestHook,
    },
  };

  try {
    const res = await fetchImpl(ENDPOINT_GENERATE, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
      signal: timeoutSignal(20000),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { patch?: unknown; model?: unknown };
    return { patch: sanitizePatch(data.patch), model: typeof data.model === 'string' ? data.model : undefined };
  } catch {
    return null;
  }
}

const FIELD_LIMITS: Record<AiField, number> = {
  name: 24,
  tagline: 60,
  targetUsers: 320,
  painPoints: 320,
  solution: 520,
  pricing: 260,
  acquisition: 260,
  wildestHook: 260,
  tweet: 280,
  founderDread: 160,
};

export function sanitizePatch(raw: unknown): Partial<Record<AiField, string>> {
  const out: Partial<Record<AiField, string>> = {};
  if (typeof raw !== 'object' || raw === null) return out;
  for (const key of AI_FIELDS) {
    const value = (raw as Record<string, unknown>)[key];
    if (typeof value !== 'string') continue;
    const trimmed = value.trim();
    if (trimmed.length < 2) continue;
    out[key] = trimmed.slice(0, FIELD_LIMITS[key]);
  }
  return out;
}

/** 把 patch 合并进项目，同时强制保留模拟数据声明与 ID */
export function applyPatch(p: Project, patch: Partial<Record<AiField, string>>): Project {
  const next: Project = { ...p, ...patch, aiEnhanced: true, revision: p.revision + 1 };
  next.id = p.id;
  next.metrics = {
    ...p.metrics,
    assumption:
      '以下用户规模、月度收入与融资金额均为随机生成的模拟假设，仅用于演示文案效果，不代表任何真实商业数据。',
  };
  return next;
}
