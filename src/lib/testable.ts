/**
 * 测试入口：把所有需要断言的纯逻辑聚合导出，
 * 由 scripts/selftest.mjs 用 esbuild 打包成 ESM 后在 Node 里直接跑。
 */
export { CATEGORIES, CATEGORY_IDS, CATEGORY_LIST, getCategory, isCategoryId } from '../data/categories';
export { MODES, MODE_LIST, SPICE, SPICE_LIST } from '../data/modes';
export {
  buildProject,
  generateProject,
  regenerateAll,
  regenerateField,
  signatureOf,
  materialStats,
  categoriesForMode,
} from './generate';
export { createRng, isProjectId, makeId, newSeed, pick, sample, shuffle } from './rng';
export {
  emptyStore,
  loadStore,
  pruneProjects,
  pushSignature,
  removeProject,
  saveStore,
  sanitizeProject,
  sanitizeStore,
  toggleFavorite,
  toStored,
  upsertProject,
  MAX_HISTORY,
  STORAGE_KEY,
} from './storage';
export {
  buildPromoAngles,
  projectTitle,
  safeFilename,
  toJson,
  toMarkdown,
  toPlainText,
} from './export';
export { wrapText, fitText, POSTER_SIZES, themeFor } from './poster';
export { AI_FIELDS, applyPatch, enhanceProject, fetchAiStatus, sanitizePatch } from './ai';
export { FIELD_KEYS } from './types';
export { ALL_FIELD_LABELS, FIELD_META, EXTRA_FIELD_META } from './fields';
