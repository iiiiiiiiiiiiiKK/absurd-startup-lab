import { CATEGORIES, getCategory } from '../data/categories';
import { MODES, SPICE } from '../data/modes';
import { createRng, makeId, newSeed, pick, pickIndex, sample, shuffle } from './rng';
import type { Rng } from './rng';
import {
  FIELD_KEYS,
} from './types';
import type {
  Audience,
  CategoryData,
  CategoryId,
  Feature,
  FieldKey,
  GenerateOptions,
  Mechanic,
  ModeId,
  Pain,
  Project,
  ProjectSlots,
  SpiceLevel,
} from './types';

/* ------------------------------------------------------------------ *
 * 基础工具
 * ------------------------------------------------------------------ */

const SPICE_INDEX: Record<SpiceLevel, number> = { mild: 0, heavy: 1, extreme: 2 };

function fill(tpl: string, vars: Record<string, string>): string {
  return tpl.replace(/\{(\w+)\}/g, (m, key) => (key in vars ? vars[key] : m));
}

function intersects(a: readonly string[], b: readonly string[]): boolean {
  return a.some((x) => b.includes(x));
}

function fmtNumber(n: number): string {
  if (n >= 1e8) return `${(n / 1e8).toFixed(1)} 亿`;
  if (n >= 1e4) return `${(n / 1e4).toFixed(1)} 万`;
  return `${Math.round(n)}`;
}

/** 保证重生成时一定换到新内容：把主 seed 与尝试序号混成一个新 seed */
function deriveSeed(seed: number, attempt: number): number {
  let h = (seed ^ 0x9e3779b9) >>> 0;
  h = Math.imul(h ^ (attempt + 0x7f4a7c15), 0x85ebca6b) >>> 0;
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35) >>> 0;
  h ^= h >>> 16;
  return h >>> 0;
}

/* ------------------------------------------------------------------ *
 * 语义兼容：人群 → 痛点 → 机制 必须逐级有共同标签
 * ------------------------------------------------------------------ */

interface SlotResult {
  slots: ProjectSlots;
  audience: Audience;
  pain: Pain;
  mechanic: Mechanic;
  featureList: Feature[];
}

/**
 * 语义兼容规则：
 *  1. audience.tags ∩ pain.tags ≠ ∅  →  这个人确实会遇到这个问题
 *  2. pain.tags ∩ mechanic.tags ≠ ∅  →  这个办法确实对着这个痛点
 *  3. 若素材本身不满足（极少），才退化为「同类别任意组合」，并记录 degraded
 */
function chooseCompatible(rng: Rng, cat: CategoryData): { result: SlotResult; degraded: boolean } {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    const ai = pickIndex(rng, cat.audiences.length);
    const audience = cat.audiences[ai];

    const painPool = cat.pains.filter((p) => intersects(audience.tags, p.tags));
    if (painPool.length === 0) continue;
    const pi = pickIndex(rng, painPool.length);
    const pain = painPool[pi];
    const painIdx = cat.pains.indexOf(pain);

    const mechPool = cat.mechanics.filter((m) => intersects(pain.tags, m.tags));
    if (mechPool.length === 0) continue;
    const mi = pickIndex(rng, mechPool.length);
    const mechanic = mechPool[mi];
    const mechIdx = cat.mechanics.indexOf(mechanic);

    // 功能优先选择与痛点语义相关的条目
    const related = cat.features.filter((f) => !f.tags || intersects(f.tags, pain.tags));
    const pool = related.length >= 2 ? related : cat.features;
    const featureList = sample(rng, pool, 2);

    return {
      degraded: false,
      result: {
        slots: {
          audience: ai,
          pain: painIdx,
          mechanic: mechIdx,
          pricing: pickIndex(rng, cat.pricing.length),
          channel: pickIndex(rng, cat.channels.length),
          wild: pickIndex(rng, cat.wilds.length),
        },
        audience,
        pain,
        mechanic,
        featureList,
      },
    };
  }

  // 兜底：素材本身不满足语义约束时，退回同类别内的确定性组合（不报错）
  const ai = 0;
  const audience = cat.audiences[ai];
  const pain = cat.pains[0];
  const mechanic = cat.mechanics[0];
  return {
    degraded: true,
    result: {
      slots: { audience: ai, pain: 0, mechanic: 0, pricing: 0, channel: 0, wild: 0 },
      audience,
      pain,
      mechanic,
      featureList: cat.features.slice(0, 2),
    },
  };
}

/* ------------------------------------------------------------------ *
 * 名称
 * ------------------------------------------------------------------ */

function buildName(rng: Rng, cat: CategoryData, mode: ModeId): string {
  const m = MODES[mode];
  const prefixes = [...cat.names.prefixes, ...m.namePrefixes].filter((p) => p !== undefined);
  const suffixes = [...cat.names.suffixes, ...m.nameSuffixes];
  const prefix = pick(rng, prefixes);
  const core = pick(rng, cat.names.cores);
  const suffix = pick(rng, suffixes);
  const name = `${prefix}${core}${suffix}`;
  return name.replace(/\s+/g, ' ').trim();
}

/* ------------------------------------------------------------------ *
 * 文案组装
 * ------------------------------------------------------------------ */

function buildTags(mode: ModeId, spice: SpiceLevel, cat: CategoryData): string[] {
  const tags = [...MODES[mode].tags, ...SPICE[spice].tags, `#${cat.label}`];
  return Array.from(new Set(tags)).slice(0, 6);
}

function buildTagline(
  rng: Rng,
  cat: CategoryData,
  mode: ModeId,
  spice: SpiceLevel,
  audience: Audience,
  pain: Pain,
): string {
  const m = MODES[mode];
  const vars = {
    painShort: shortOf(pain.label),
    painNoun: painNoun(pain),
    audienceShort: audience.short,
    category: cat.label,
    unit: cat.unit,
  };
  const useMode = rng() < 0.82;
  const tpl = useMode ? pick(rng, m.taglineTemplates) : pick(rng, cat.taglines);
  const base = fill(tpl, vars);
  return maybeSpice(rng, base, spice);
}

/** 抽取一个短标签：只在句号处切分，且绝不把「」引号切断 */
function shortOf(label: string, max = 14): string {
  const firstSentence = label.split('。')[0];
  if (firstSentence.length <= max) return firstSentence;

  // 若截断点落在「…」内部，退到开引号之前，避免留下半句引号
  const open = firstSentence.indexOf('「');
  const close = firstSentence.indexOf('」');
  if (open >= 0 && (close < 0 || close > max)) {
    const head = firstSentence.slice(0, open).trim();
    if (head.length >= 4) return head;
  }
  return firstSentence.slice(0, max).replace(/[「『（(，、：:；;]$/, '');
}

/**
 * 把标签翻译成一个可以塞进句子的名词短语（「解决了 X 的问题」）。
 * 用第一个语义标签做映射：比机械截断标签自然得多。
 */
const TAG_NOUN: Record<string, string> = {
  time: '时间',
  focus: '注意力',
  anxiety: '焦虑',
  routine: '日常节奏',
  work: '工作流',
  freelancer: '接活节奏',
  manager: '管理成本',
  learning: '学习进度',
  student: '学业',
  decision: '决策',
  money: '钱',
  impulse: '冲动',
  social: '关系',
  parent: '家庭事务',
  emotion: '情绪',
  couple: '两个人的距离',
  sleep: '睡眠',
  health: '身体状态',
  language: '开口',
  memory: '记忆',
  meeting: '会议',
  communication: '沟通',
  automation: '重复劳动',
  idea: '选题',
  creator: '创作节奏',
  pet: '照护',
  travel: '出行安排',
  food: '吃饭',
  home: '居住空间',
  mystic: '那点不确定',
};

function painNoun(pain: Pain): string {
  for (const tag of pain.tags) {
    const noun = TAG_NOUN[tag];
    if (noun) return noun;
  }
  return shortOf(pain.label, 8);
}

// painNoun is used in debug/test contexts to map a pain's semantic tag to a noun.
// Exporting it keeps the helper available without triggering unused warnings.
export { painNoun as _painNoun };

function maybeSpice(rng: Rng, text: string, spice: SpiceLevel): string {
  if (spice === 'mild') return text;
  if (rng() >= 0.55) return text;
  const tail = pick(rng, SPICE[spice].tail);
  // 句尾已有句号时先去掉，避免出现「。，」这种病句
  const base = text.replace(/[。！？!?]+$/, '');
  return `${base}${tail}`;
}

function buildTargetUsers(
  rng: Rng,
  cat: CategoryData,
  mode: ModeId,
  spice: SpiceLevel,
  audience: Audience,
  pain: Pain,
): string {
  const m = MODES[mode];
  const clause = fill(pick(rng, m.audienceClauses), {
    audienceShort: audience.short,
    painShort: shortOf(pain.label),
    category: cat.label,
  });
  const adj = pick(rng, SPICE[spice].adjectives);
  return `${audience.label}。${clause}这是一群${adj}的用户，痛点真实、预算存在，只是此前没人认真对待。`;
}

function buildPainPoints(
  rng: Rng,
  spice: SpiceLevel,
  audience: Audience,
  pain: Pain,
): string {
  const extra =
    spice === 'mild'
      ? `对${audience.short}来说，这不是效率问题，而是每天都在发生的小型挫败。`
      : `对${audience.short}来说，${pick(rng, SPICE[spice].adjectives)}的一点是：所有人都默认这件事只能这样。`;
  return `${pain.label}。${pain.detail}${extra}`;
}

function buildSolution(
  rng: Rng,
  cat: CategoryData,
  mode: ModeId,
  spice: SpiceLevel,
  audience: Audience,
  pain: Pain,
  mechanic: Mechanic,
): string {
  const m = MODES[mode];
  const vars = {
    mechanic: mechanic.label,
    action: mechanic.action,
    why: mechanic.why,
    painShort: shortOf(pain.label),
    painNoun: painNoun(pain),
    audienceShort: audience.short,
    category: cat.label,
  };
  const frame = fill(pick(rng, m.solutionFrames), vars);
  const signatureLine = signatureSentence(mode);
  return maybeSpice(rng, `${frame}${signatureLine}`, spice);
}

/**
 * 每种模式都必须带上一句自己的「方法论签名」。
 * 这句话包含该模式 signature 数组中的全部关键词，测试会逐一断言，
 * 保证「不同模式产生明显不同的结果」不是靠配色而是靠文字。
 */
function signatureSentence(mode: ModeId): string {
  switch (mode) {
    case 'spoof':
      return '我们非常正经地承认：每一步的逻辑闭环都是完整的，荒谬的只是起点本身。';
    case 'corporate':
      return '这一步完成了从需求洞察到价值交付的完整闭环，并为后续的组织赋能与范式迁移预留了接口。';
    case 'indie':
      return '整个方案由一个人完成，周末两天可以跑通第一版；不融资、不扩张，代码不开源也能开源地交付。';
    case 'ai':
      return '技术上，模型负责理解与生成，自动化规则负责兜底，Agent 只在最后一步保留人的否决权。';
    case 'netculture':
      return '传播上，我们把这件事本身做成一个梗：它是天然的社交货币，看到的人会自觉传播。';
    case 'serious':
      return '可行性上，我们只承诺最小闭环与单元经济为正：先跑通 50 个真实用户，再谈扩张。';
    default:
      return '';
  }
}

function buildFeatures(
  rng: Rng,
  mode: ModeId,
  featureList: Feature[],
): string[] {
  const m = MODES[mode];
  const catFeatures = featureList.map((f) => f.text);
  const modeFeatures = sample(rng, m.extraFeatures, 3);
  return Array.from(new Set([...catFeatures, ...modeFeatures])).slice(0, 5);
}

function buildPricing(
  rng: Rng,
  cat: CategoryData,
  mode: ModeId,
  spice: SpiceLevel,
): string {
  const m = MODES[mode];
  const price = m.prices[SPICE_INDEX[spice]];
  const p = cat.pricing[pickIndex(rng, cat.pricing.length)];
  const note = pick(rng, m.pricingNotes);
  const spiced = SPICE[spice].priceFactor > 1 ? `，越离谱的版本越贵` : '';
  return `${p.model}：${p.detail}参考价位 ¥${price} / ${cat.unit}（模拟定价${spiced}）。${note}。`;
}

function buildAcquisition(
  rng: Rng,
  mode: ModeId,
  channelName: string,
  channelPlay: string,
): string {
  const frame = fill(pick(rng, MODES[mode].acquisitionFrames), { channel: channelName });
  return `${channelName}：${channelPlay}。${frame}。`;
}

function buildWildest(
  rng: Rng,
  cat: CategoryData,
  mode: ModeId,
  spice: SpiceLevel,
): string {
  const a = pick(rng, MODES[mode].wildTemplates);
  const b = pick(rng, cat.wilds);
  const c =
    spice === 'extreme'
      ? `至于「${pick(rng, SPICE[spice].adjectives)}」这一点，我们决定写进合同第一条。`
      : '';
  return `${a}${b}${c}`;
}

function buildTweet(
  rng: Rng,
  project: Pick<
    Project,
    'name' | 'tagline' | 'mode' | 'spice' | 'category' | 'targetUsers' | 'tags'
  >,
  audience: Audience,
  pain: Pain,
): string {
  const cat = getCategory(project.category);
  const hookPool = [
    `我们做了「${project.name}」：${project.tagline}`,
    `有个想法憋了三天：「${project.name}」——${project.tagline}`,
    `今天上线一个东西：「${project.name}」。${project.tagline}`,
  ];
  const bodyPool = [
    `主要解决${audience.short}的「${shortOf(pain.label)}」。不吹牛，先跑 50 个真实用户。`,
    `目标用户很明确：${audience.short}。他们的原话是「${shortOf(pain.label)}」。`,
    `第 1 版只做一件事，做不好就删掉重来。欢迎来骂。`,
  ];
  const tags = project.tags.slice(0, 3).join(' ');
  return `${pick(rng, hookPool)}\n\n${pick(rng, bodyPool)}\n\n${cat.emoji} ${tags}`;
}

function buildInvestorQuestions(
  rng: Rng,
  cat: CategoryData,
  mode: ModeId,
): string[] {
  const qs = [
    ...sample(rng, cat.investorQuestions, 2),
    ...sample(rng, MODES[mode].investorQuestions, 2),
  ];
  return Array.from(new Set(qs)).slice(0, 4);
}

function buildFounderDread(rng: Rng, cat: CategoryData, mode: ModeId): string {
  const pool = [...cat.dreadQuestions, ...MODES[mode].dreadQuestions];
  return pick(rng, pool);
}

function buildMetrics(rng: Rng, mode: ModeId, spice: SpiceLevel): Project['metrics'] {
  const m = MODES[mode];
  const factor = m.scale * SPICE[spice].metricFactor;
  const jitter = 0.75 + rng() * 0.5;
  const tam = 30e8 * factor * jitter;
  const users = 1.4e4 * factor * jitter;
  const revenue = 3.2e4 * factor * jitter;
  const funding = 800e4 * factor * jitter;
  return {
    assumption:
      '以下用户规模、月度收入与融资金额均为随机生成的模拟假设，仅用于演示文案效果，不代表任何真实商业数据。',
    tam: `模拟 TAM 约 ${fmtNumber(tam)}（假设值）`,
    users: `模拟早期用户 ${fmtNumber(users)} 人（假设值）`,
    revenue: `模拟月收入约 ¥${fmtNumber(revenue)}（假设值）`,
    funding: `模拟天使轮 ¥${fmtNumber(funding)}（假设值）`,
  };
}

/* ------------------------------------------------------------------ *
 * 单次构建
 * ------------------------------------------------------------------ */

interface BuildInput {
  seed: number;
  now: number;
  mode: ModeId;
  spice: SpiceLevel;
  category: CategoryId | 'random';
  existingIds: readonly string[];
  locked: Partial<Record<FieldKey, string | string[]>>;
  revision: number;
  id?: string;
}

function resolveCategory(rng: Rng, category: CategoryId | 'random'): CategoryData {
  if (category === 'random') return CATEGORIES[pickIndex(rng, CATEGORIES.length)];
  return getCategory(category);
}

export function buildProject(input: BuildInput): Project {
  const rng = createRng(input.seed);
  const cat = resolveCategory(rng, input.category);
  const { result } = chooseCompatible(rng, cat);
  const { slots, audience, pain, mechanic, featureList } = result;
  const channel = cat.channels[slots.channel];
  const mode = input.mode;
  const spice = input.spice;

  const name = buildName(rng, cat, mode);
  const tagline = buildTagline(rng, cat, mode, spice, audience, pain);
  const targetUsers = buildTargetUsers(rng, cat, mode, spice, audience, pain);
  const painPoints = buildPainPoints(rng, spice, audience, pain);
  const solution = buildSolution(rng, cat, mode, spice, audience, pain, mechanic);
  const features = buildFeatures(rng, mode, featureList);
  const pricing = buildPricing(rng, cat, mode, spice);
  const acquisition = buildAcquisition(rng, mode, channel.name, channel.play);
  const wildestHook = buildWildest(rng, cat, mode, spice);
  const tags = buildTags(mode, spice, cat);
  const signatureBase = {
    name,
    tagline,
    mode,
    spice,
    category: cat.id,
    targetUsers,
    tags,
  };
  const tweet = buildTweet(rng, signatureBase, audience, pain);
  const investorQuestions = buildInvestorQuestions(rng, cat, mode);
  const founderDread = buildFounderDread(rng, cat, mode);
  const metrics = buildMetrics(rng, mode, spice);

  const id = input.id ?? makeId(rng, input.existingIds);

  const project: Project = {
    id,
    revision: input.revision,
    createdAt: input.now,
    seed: input.seed,
    mode,
    spice,
    category: cat.id,
    slots,
    name,
    tagline,
    targetUsers,
    painPoints,
    solution,
    features,
    pricing,
    acquisition,
    wildestHook,
    tweet,
    investorQuestions,
    founderDread,
    metrics,
    tags,
  };

  return applyLocked(project, input.locked);
}

function applyLocked(
  project: Project,
  locked: Partial<Record<FieldKey, string | string[]>>,
): Project {
  const out: Project = { ...project };
  for (const key of FIELD_KEYS) {
    const value = locked[key];
    if (value === undefined) continue;
    if (key === 'features' || key === 'investorQuestions') {
      if (Array.isArray(value) && value.length > 0) {
        (out as unknown as Record<string, unknown>)[key] = [...value];
      }
    } else if (typeof value === 'string' && value.trim() !== '') {
      (out as unknown as Record<string, unknown>)[key] = value;
    }
  }
  return out;
}

/* ------------------------------------------------------------------ *
 * 去重签名
 * ------------------------------------------------------------------ */

export function signatureOf(p: Project): string {
  return `${p.category}|${p.mode}|${p.slots.audience}|${p.slots.pain}|${p.slots.mechanic}|${p.name}`;
}

/* ------------------------------------------------------------------ *
 * 对外主入口
 * ------------------------------------------------------------------ */

export interface GenerateResult {
  project: Project;
  /** 与最近输出重复时给出提示（UI 用） */
  duplicateAvoided: boolean;
}

export function generateProject(opts: GenerateOptions): GenerateResult {
  const now = opts.now ?? Date.now();
  const baseSeed = opts.seed ?? newSeed();
  const recent = new Set(opts.recentSignatures ?? []);
  const existingIds = [...(opts.existingIds ?? [])];
  const locked = opts.locked ?? {};

  let fallback: Project | null = null;
  let attempts = 0;

  for (let attempt = 0; attempt < 40; attempt += 1) {
    attempts += 1;
    const seed = attempt === 0 ? baseSeed : deriveSeed(baseSeed, attempt);
    const project = buildProject({
      seed,
      now,
      mode: opts.mode,
      spice: opts.spice,
      category: opts.category,
      existingIds,
      locked,
      revision: 1,
    });
    if (!fallback) fallback = project;
    if (!recent.has(signatureOf(project))) {
      return { project, duplicateAvoided: attempts > 1 };
    }
  }

  return { project: fallback as Project, duplicateAvoided: false };
}

/** 生成同一 ID 的下一版（保留 ID，revision + 1） */
export function regenerateAll(
  prev: Project,
  opts: Partial<GenerateOptions> & { locked?: Partial<Record<FieldKey, string | string[]>> },
): GenerateResult {
  const result = generateProject({
    mode: opts.mode ?? prev.mode,
    spice: opts.spice ?? prev.spice,
    category: opts.category === 'random' || !opts.category ? prev.category : opts.category,
    locked: opts.locked,
    seed: opts.seed,
    now: opts.now,
    recentSignatures: opts.recentSignatures,
    existingIds: opts.existingIds,
  });
  return {
    project: { ...result.project, id: prev.id, revision: prev.revision + 1 },
    duplicateAvoided: result.duplicateAvoided,
  };
}

/**
 * 单字段重新生成：
 *  - 保留 ID / revision（+1）
 *  - 只替换目标字段，其它字段保持原样
 *  - 目标字段内容一定与原值不同（最多重试 40 次）
 *  - tweet 引用了名称与口号，因此名称 / 口号变更后会自动重算 tweet
 */
export function regenerateField(
  prev: Project,
  field: FieldKey,
  opts: {
    mode?: ModeId;
    spice?: SpiceLevel;
    locked?: Partial<Record<FieldKey, string | string[]>>;
    now?: number;
  } = {},
): Project {
  const mode = opts.mode ?? prev.mode;
  const spice = opts.spice ?? prev.spice;
  const now = opts.now ?? Date.now();
  const locked = { ...(opts.locked ?? {}) };
  // 目标字段本身不受锁定影响，否则无法重新生成
  delete locked[field];

  const oldValue = JSON.stringify(prev[field]);
  const baseSeed = deriveSeed(prev.seed, Math.max(1, prev.revision) * 977 + hashKey(field));

  let candidate: Project = prev;
  for (let attempt = 0; attempt < 40; attempt += 1) {
    const seed = deriveSeed(baseSeed, attempt);
    const built = buildProject({
      seed,
      now,
      mode,
      spice,
      category: prev.category,
      existingIds: [prev.id],
      locked,
      revision: prev.revision + 1,
      id: prev.id,
    });
    if (JSON.stringify(built[field]) !== oldValue) {
      candidate = built;
      break;
    }
    candidate = built;
  }

  const next: Project = {
    ...prev,
    [field]: candidate[field],
    revision: prev.revision + 1,
    createdAt: now,
    mode,
    spice,
  } as Project;

  // 名称 / 口号变了，X 文案必须跟着变，否则会自相矛盾
  if (field === 'name' || field === 'tagline') {
    const rng = createRng(deriveSeed(baseSeed, 101));
    const cat = getCategory(next.category);
    const audience = cat.audiences[next.slots.audience] ?? cat.audiences[0];
    const pain = cat.pains[next.slots.pain] ?? cat.pains[0];
    next.tweet = buildTweet(
      rng,
      {
        name: next.name,
        tagline: next.tagline,
        mode: next.mode,
        spice: next.spice,
        category: next.category,
        targetUsers: next.targetUsers,
        tags: next.tags,
      },
      audience,
      pain,
    );
  }

  return next;
}

function hashKey(key: string): number {
  let h = 0;
  for (let i = 0; i < key.length; i += 1) h = (Math.imul(h, 31) + key.charCodeAt(i)) >>> 0;
  return h % 100003;
}

/** 给「按类别生成」用：返回该类别可用的所有模式标签，供 UI 展示 */
export function categoriesForMode(mode: ModeId): CategoryId[] {
  void MODES[mode];
  return CATEGORIES.map((c) => c.id);
}

/** 供测试 / 校验使用：某些模式在某些类别下是否有足够素材 */
export function materialStats() {
  return CATEGORIES.map((c) => ({
    id: c.id,
    label: c.label,
    audiences: c.audiences.length,
    pains: c.pains.length,
    mechanics: c.mechanics.length,
    features: c.features.length,
    pricing: c.pricing.length,
    channels: c.channels.length,
    wilds: c.wilds.length,
    investorQuestions: c.investorQuestions.length,
    dreadQuestions: c.dreadQuestions.length,
    taglines: c.taglines.length,
    combos: c.audiences.length * c.pains.length * c.mechanics.length,
  }));
}

export { shuffle };
