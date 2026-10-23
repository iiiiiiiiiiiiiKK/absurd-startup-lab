import type { FieldKey } from './types';

export interface FieldMeta {
  key: FieldKey;
  label: string;
  /** 单列 / 通栏 */
  wide?: boolean;
  list?: boolean;
}

export const FIELD_META: FieldMeta[] = [
  { key: 'targetUsers', label: '目标用户', wide: true },
  { key: 'painPoints', label: '用户痛点', wide: true },
  { key: 'solution', label: '产品解决方案', wide: true },
  { key: 'features', label: '核心功能', wide: true, list: true },
  { key: 'pricing', label: '收费模式' },
  { key: 'acquisition', label: '获客方式' },
  { key: 'wildestHook', label: '最离谱的卖点', wide: true },
  { key: 'tweet', label: '首条 X 推广文案', wide: true },
];

export const EXTRA_FIELD_META: FieldMeta[] = [
  { key: 'investorQuestions', label: '投资人可能提出的问题', list: true },
  { key: 'founderDread', label: '创始人最不愿回答的问题' },
];

/** 名称 / 口号 在页头单独处理，但仍可单独重生成与锁定 */
export const HEADER_FIELD_META: FieldMeta[] = [
  { key: 'name', label: '项目名称' },
  { key: 'tagline', label: '一句话口号' },
];

export const ALL_FIELD_LABELS: Record<FieldKey, string> = Object.fromEntries(
  [...FIELD_META, ...EXTRA_FIELD_META, ...HEADER_FIELD_META].map((f) => [f.key, f.label]),
) as Record<FieldKey, string>;
