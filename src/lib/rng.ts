/**
 * 确定性随机数（mulberry32）。
 * 同一个 seed 必定得到同一个项目，这是「固定 ID + 可恢复」的基础。
 */
export type Rng = () => number;

export function createRng(seed: number): Rng {
  let a = seed >>> 0;
  return function next() {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function pick<T>(rng: Rng, arr: readonly T[]): T {
  if (arr.length === 0) throw new Error('pick from empty array');
  return arr[Math.floor(rng() * arr.length) % arr.length];
}

export function pickIndex(rng: Rng, len: number): number {
  if (len <= 0) throw new Error('pickIndex from empty');
  return Math.floor(rng() * len) % len;
}

/** 无放回抽取 n 个 */
export function sample<T>(rng: Rng, arr: readonly T[], n: number): T[] {
  const pool = [...arr];
  const out: T[] = [];
  const count = Math.min(n, pool.length);
  for (let i = 0; i < count; i += 1) {
    const idx = pickIndex(rng, pool.length);
    out.push(pool[idx]);
    pool.splice(idx, 1);
  }
  return out;
}

export function shuffle<T>(rng: Rng, arr: readonly T[]): T[] {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = pickIndex(rng, i + 1);
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export function newSeed(): number {
  return Math.floor(Math.random() * 0xffffffff) >>> 0;
}

/**
 * 固定 ID：ASL-XXXX-XXXX，字符集去掉易混淆的 O/0/I/1。
 * 同一项目重生成时保留原 ID，只递增 revision。
 */
const ID_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export function makeId(rng: Rng, existing: readonly string[] = []): string {
  for (let attempt = 0; attempt < 64; attempt += 1) {
    let body = '';
    for (let i = 0; i < 8; i += 1) {
      body += ID_ALPHABET[Math.floor(rng() * ID_ALPHABET.length)];
      if (i === 3) body += '-';
    }
    const id = `ASL-${body}`;
    if (!existing.includes(id)) return id;
  }
  // 极端兜底：加时间戳后缀，保证仍然唯一
  return `ASL-${Date.now().toString(36).toUpperCase().slice(-4)}-${Math.floor(rng() * 65535)
    .toString(36)
    .toUpperCase()
    .padStart(4, '0')}`;
}

export function isProjectId(v: string): boolean {
  return /^ASL-[A-Z2-9]{4}-[A-Z2-9]{4}$/.test(v);
}
