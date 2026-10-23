/**
 * 离谱创业模拟器 — 核心类型定义
 * 所有生成结果都在此结构上序列化，保证「固定 ID + 可保存 / 可恢复」。
 */

export type ModeId = 'spoof' | 'corporate' | 'indie' | 'ai' | 'netculture' | 'serious';

export type SpiceLevel = 'mild' | 'heavy' | 'extreme';

export type CategoryId =
  | 'productivity'
  | 'money'
  | 'social'
  | 'health'
  | 'learning'
  | 'workplace'
  | 'aiwork'
  | 'pet'
  | 'kitchen'
  | 'home'
  | 'creator'
  | 'mystic';

/** 可单独重新生成 / 锁定的字段 */
export const FIELD_KEYS = [
  'name',
  'tagline',
  'targetUsers',
  'painPoints',
  'solution',
  'features',
  'pricing',
  'acquisition',
  'wildestHook',
  'tweet',
  'investorQuestions',
  'founderDread',
] as const;

export type FieldKey = (typeof FIELD_KEYS)[number];

export interface Audience {
  /** 完整人群描述，用于「目标用户」 */
  label: string;
  /** 短标签，用于标题 / 指标 */
  short: string;
  /** 一句特征，用于拼接 */
  trait: string;
  /** 语义标签，用于与痛点 / 机制做兼容匹配 */
  tags: string[];
}

export interface Pain {
  label: string;
  detail: string;
  /** 语义标签，用于与机制做兼容匹配 */
  tags: string[];
}

export interface Mechanic {
  label: string;
  /** 「我们做什么」 */
  action: string;
  /** 「为什么这样能成立」 */
  why: string;
  tags: string[];
}

export interface Feature {
  text: string;
  tags?: string[];
}

export interface PricingModel {
  model: string;
  detail: string;
}

export interface Channel {
  name: string;
  play: string;
}

export interface NameParts {
  prefixes: string[];
  cores: string[];
  suffixes: string[];
}

export interface CategoryData {
  id: CategoryId;
  label: string;
  emoji: string;
  blurb: string;
  /** 计量单位，如「次」「天」「只」 */
  unit: string;
  audiences: Audience[];
  pains: Pain[];
  mechanics: Mechanic[];
  features: Feature[];
  pricing: PricingModel[];
  channels: Channel[];
  wilds: string[];
  investorQuestions: string[];
  dreadQuestions: string[];
  taglines: string[];
  names: NameParts;
}

export interface ModeConfig {
  id: ModeId;
  label: string;
  short: string;
  desc: string;
  /** 该模式必须出现的关键词（供测试断言「模式差异明显」） */
  signature: string[];
  tags: string[];
  accent: string;
  namePrefixes: string[];
  nameSuffixes: string[];
  taglineTemplates: string[];
  audienceClauses: string[];
  solutionFrames: string[];
  extraFeatures: string[];
  pricingNotes: string[];
  acquisitionFrames: string[];
  wildTemplates: string[];
  investorQuestions: string[];
  dreadQuestions: string[];
  /** 价格档位（元），按荒诞程度取 */
  prices: [number, number, number];
  /** 融资 / 收入规模倍数 */
  scale: number;
}

export interface SpiceConfig {
  id: SpiceLevel;
  label: string;
  desc: string;
  /** 夸张词 */
  adjectives: string[];
  /** 句式强化短语，插在句尾 */
  tail: string[];
  /** 价格倍数（相对模式基准） */
  priceFactor: number;
  /** 指标倍数 */
  metricFactor: number;
  /** 标签 */
  tags: string[];
}

export interface ProjectSlots {
  audience: number;
  pain: number;
  mechanic: number;
  pricing: number;
  channel: number;
  wild: number;
}

export interface ProjectMetrics {
  /** 模拟假设声明，任何数字都必须挂在这上面 */
  assumption: string;
  tam: string;
  users: string;
  revenue: string;
  funding: string;
}

export interface Project {
  /** 固定 ID，如 ASL-7F3K-92QX */
  id: string;
  /** 同一 ID 的重生成版本号 */
  revision: number;
  createdAt: number;
  seed: number;
  mode: ModeId;
  spice: SpiceLevel;
  category: CategoryId;
  slots: ProjectSlots;
  name: string;
  tagline: string;
  targetUsers: string;
  painPoints: string;
  solution: string;
  features: string[];
  pricing: string;
  acquisition: string;
  wildestHook: string;
  tweet: string;
  investorQuestions: string[];
  founderDread: string;
  metrics: ProjectMetrics;
  tags: string[];
  aiEnhanced?: boolean;
}

export interface StoredProject extends Project {
  favorite: boolean;
  savedAt: number;
}

export interface GenerateOptions {
  mode: ModeId;
  spice: SpiceLevel;
  category: CategoryId | 'random';
  /** 已出现过的签名，用于避免短期重复 */
  recentSignatures?: string[];
  /** 已存在的 ID，用于避免碰撞 */
  existingIds?: string[];
  /** 锁定的字段内容（例如锁定的名称） */
  locked?: Partial<Record<FieldKey, string | string[]>>;
  seed?: number;
  now?: number;
}

export interface StoreShape {
  version: 1;
  projects: StoredProject[];
  settings: {
    mode: ModeId;
    spice: SpiceLevel;
    category: CategoryId | 'random';
    /** 跨生成锁定的字段（如只锁名称，其它全部重生成） */
    locks: FieldKey[];
  };
  currentId: string | null;
  recentSignatures: string[];
}
