import { CATEGORY_A } from './categories-a';
import { CATEGORY_B } from './categories-b';
import { CATEGORY_C } from './categories-c';
import type { CategoryData, CategoryId } from '../lib/types';

export const CATEGORIES: CategoryData[] = [...CATEGORY_A, ...CATEGORY_B, ...CATEGORY_C];

export const CATEGORY_LIST = CATEGORIES.map((c) => ({
  id: c.id,
  label: c.label,
  emoji: c.emoji,
  blurb: c.blurb,
}));

const MAP: Record<string, CategoryData> = Object.fromEntries(
  CATEGORIES.map((c) => [c.id, c]),
);

export function getCategory(id: CategoryId): CategoryData {
  const found = MAP[id];
  if (!found) throw new Error(`unknown category: ${id}`);
  return found;
}

export function isCategoryId(v: string): v is CategoryId {
  return v in MAP;
}

export const CATEGORY_IDS = CATEGORIES.map((c) => c.id);
