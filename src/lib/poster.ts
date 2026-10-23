import { getCategory } from '../data/categories';
import { MODES, SPICE } from '../data/modes';
import type { Project } from './types';

export interface PosterTheme {
  bg: string;
  bg2: string;
  ink: string;
  sub: string;
  accent: string;
  chip: string;
  chipInk: string;
  grid: string;
}

const SERIOUS_THEMES: Record<string, PosterTheme> = {
  serious: {
    bg: '#f7f7f5',
    bg2: '#efefec',
    ink: '#14161a',
    sub: '#545a63',
    accent: '#1f2937',
    chip: '#e5e7eb',
    chipInk: '#1f2937',
    grid: 'rgba(20,22,26,0.05)',
  },
};

const FUN_THEMES: Record<string, PosterTheme> = {
  spoof: {
    bg: '#12101a',
    bg2: '#241a2e',
    ink: '#ffffff',
    sub: 'rgba(255,255,255,0.72)',
    accent: '#ff4d8d',
    chip: 'rgba(255,77,141,0.18)',
    chipInk: '#ffb3cd',
    grid: 'rgba(255,255,255,0.06)',
  },
  corporate: {
    bg: '#0b1b3a',
    bg2: '#12306b',
    ink: '#ffffff',
    sub: 'rgba(226,238,255,0.78)',
    accent: '#59a3ff',
    chip: 'rgba(89,163,255,0.16)',
    chipInk: '#b7d6ff',
    grid: 'rgba(255,255,255,0.06)',
  },
  indie: {
    bg: '#08160f',
    bg2: '#0f2a1d',
    ink: '#ffffff',
    sub: 'rgba(214,255,232,0.72)',
    accent: '#2ee6a0',
    chip: 'rgba(46,230,160,0.14)',
    chipInk: '#a9ffd8',
    grid: 'rgba(255,255,255,0.05)',
  },
  ai: {
    bg: '#0d0b1f',
    bg2: '#1e1746',
    ink: '#ffffff',
    sub: 'rgba(230,225,255,0.75)',
    accent: '#a78bfa',
    chip: 'rgba(167,139,250,0.16)',
    chipInk: '#ddd0ff',
    grid: 'rgba(255,255,255,0.06)',
  },
  netculture: {
    bg: '#1a1206',
    bg2: '#3a2708',
    ink: '#ffffff',
    sub: 'rgba(255,240,210,0.75)',
    accent: '#ffb020',
    chip: 'rgba(255,176,32,0.16)',
    chipInk: '#ffe0a3',
    grid: 'rgba(255,255,255,0.05)',
  },
};

export function themeFor(p: Project): PosterTheme {
  if (p.mode === 'serious') {
    return SERIOUS_THEMES.serious;
  }
  return FUN_THEMES[p.mode] ?? FUN_THEMES.spoof;
}

/* ------------------------------------------------------------------ *
 * 文本排版：所有文本都经过「测量 → 换行 → 限行 → 省略」流程，
 * 保证任何内容长度都不会溢出画布。
 * ------------------------------------------------------------------ */

export function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
): string[] {
  const lines: string[] = [];
  let line = '';
  for (const ch of Array.from(text)) {
    if (ch === '\n') {
      lines.push(line);
      line = '';
      continue;
    }
    const test = line + ch;
    if (ctx.measureText(test).width > maxWidth && line !== '') {
      lines.push(line);
      line = ch;
    } else {
      line = test;
    }
  }
  if (line !== '') lines.push(line);
  return lines.length ? lines : [''];
}

export function fitText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  maxLines: number,
): string[] {
  const lines = wrapText(ctx, text, maxWidth);
  if (lines.length <= maxLines) return lines;
  const kept = lines.slice(0, maxLines);
  let last = kept[maxLines - 1];
  while (last.length > 1 && ctx.measureText(`${last}…`).width > maxWidth) {
    last = last.slice(0, -1);
  }
  kept[maxLines - 1] = `${last}…`;
  return kept;
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

type Ctx = CanvasRenderingContext2D;

function font(ctx: Ctx, size: number, weight: number, family: string) {
  ctx.font = `${weight} ${size}px ${family}`;
}

const SANS =
  '"PingFang SC","Hiragino Sans GB","Microsoft YaHei","Noto Sans SC","Source Han Sans SC",system-ui,-apple-system,"Segoe UI",sans-serif';
const MONO =
  '"JetBrains Mono","SF Mono","Cascadia Mono",Consolas,"Courier New",monospace';

export interface PosterSize {
  width: number;
  height: number;
  key: 'portrait' | 'wide';
}

export const POSTER_SIZES: Record<PosterSize['key'], PosterSize> = {
  portrait: { key: 'portrait', width: 1080, height: 1440 },
  wide: { key: 'wide', width: 1200, height: 675 },
};

function drawBackground(ctx: Ctx, w: number, h: number, theme: PosterTheme) {
  const g = ctx.createLinearGradient(0, 0, w, h);
  g.addColorStop(0, theme.bg);
  g.addColorStop(1, theme.bg2);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);

  // 细网格：创业实验室的气质
  ctx.strokeStyle = theme.grid;
  ctx.lineWidth = 1;
  const step = 60;
  ctx.beginPath();
  for (let x = 0; x <= w; x += step) {
    ctx.moveTo(x + 0.5, 0);
    ctx.lineTo(x + 0.5, h);
  }
  for (let y = 0; y <= h; y += step) {
    ctx.moveTo(0, y + 0.5);
    ctx.lineTo(w, y + 0.5);
  }
  ctx.stroke();

  // 角落光斑
  const glow = ctx.createRadialGradient(w * 0.86, h * 0.08, 10, w * 0.86, h * 0.08, w * 0.55);
  glow.addColorStop(0, `${theme.accent}33`);
  glow.addColorStop(1, 'transparent');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, w, h);
}

/** 圆角标签，返回占用宽度 */
function chip(
  ctx: Ctx,
  text: string,
  x: number,
  y: number,
  theme: PosterTheme,
  size = 26,
): number {
  font(ctx, size, 600, SANS);
  const padX = size * 0.72;
  const padY = size * 0.42;
  const tw = ctx.measureText(text).width;
  const w = tw + padX * 2;
  const h = size + padY * 2;
  ctx.fillStyle = theme.chip;
  roundRect(ctx, x, y, w, h, h / 2);
  ctx.fill();
  ctx.strokeStyle = `${theme.accent}55`;
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.fillStyle = theme.chipInk;
  ctx.textBaseline = 'middle';
  ctx.fillText(text, x + padX, y + h / 2 + 1);
  ctx.textBaseline = 'alphabetic';
  return w;
}

function drawFooter(ctx: Ctx, w: number, h: number, p: Project, theme: PosterTheme, pad: number) {
  const y = h - pad - 54;
  ctx.strokeStyle = theme.grid;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(pad, y - 18);
  ctx.lineTo(w - pad, y - 18);
  ctx.stroke();

  font(ctx, 24, 600, MONO);
  ctx.fillStyle = theme.sub;
  ctx.textBaseline = 'middle';
  ctx.fillText(p.id, pad, y + 12);

  font(ctx, 24, 500, SANS);
  ctx.textAlign = 'right';
  ctx.fillText('离谱创业模拟器 · 纯属虚构', w - pad, y + 12);
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
}

/* ------------------------------------------------------------------ *
 * 竖版海报（分享图主形态）
 * ------------------------------------------------------------------ */
export function drawPoster(ctx: Ctx, p: Project, size: PosterSize) {
  const { width: w, height: h } = size;
  const theme = themeFor(p);
  const cat = getCategory(p.category);
  const mode = MODES[p.mode];
  const spice = SPICE[p.spice];
  const pad = Math.round(w * 0.075);
  const inner = w - pad * 2;

  drawBackground(ctx, w, h, theme);

  // 顶部眉标
  font(ctx, 24, 700, MONO);
  ctx.fillStyle = theme.accent;
  ctx.textBaseline = 'middle';
  ctx.fillText('ABSURD STARTUP LAB / 创业提案', pad, pad + 12);

  let cursor = pad + 60;
  let chipX = pad;
  for (const label of [`${cat.emoji} ${cat.label}`, mode.label, `荒诞 ${spice.label}`]) {
    const used = chip(ctx, label, chipX, cursor, theme, 24);
    chipX += used + 12;
    if (chipX > w - pad - 120) break;
  }
  cursor += 24 + 26 + 40;

  // 项目名
  font(ctx, 76, 800, SANS);
  ctx.fillStyle = theme.ink;
  const nameLines = fitText(ctx, p.name, inner, 2);
  const nameLineH = 90;
  nameLines.forEach((line, i) => {
    ctx.fillText(line, pad, cursor + nameLineH * (i + 1) - 20);
  });
  cursor += nameLineH * nameLines.length + 8;

  // 口号
  font(ctx, 34, 500, SANS);
  ctx.fillStyle = theme.accent;
  const tagLines = fitText(ctx, p.tagline, inner, 2);
  tagLines.forEach((line, i) => {
    ctx.fillText(line, pad, cursor + 44 + i * 46);
  });
  cursor += 44 + tagLines.length * 46 + 26;

  // 分隔线
  ctx.fillStyle = `${theme.accent}66`;
  ctx.fillRect(pad, cursor, 96, 5);
  cursor += 34;

  // 三段核心内容
  const blocks: Array<{ title: string; body: string; maxLines: number }> = [
    { title: '目标用户', body: p.targetUsers, maxLines: 3 },
    { title: '用户痛点', body: p.painPoints, maxLines: 3 },
    { title: '解决方案', body: p.solution, maxLines: 4 },
    { title: '最离谱的卖点', body: p.wildestHook, maxLines: 3 },
  ];

  // 预览：按尺寸决定放几段
  const blockLimit = size.key === 'portrait' ? 4 : 2;
  const bodySize = size.key === 'portrait' ? 27 : 24;
  const bodyLineH = Math.round(bodySize * 1.62);
  const bottomReserve = size.key === 'portrait' ? 230 : 150;

  for (const block of blocks.slice(0, blockLimit)) {
    if (cursor + bodyLineH * 2 + bottomReserve > h) break;
    font(ctx, 24, 700, SANS);
    ctx.fillStyle = theme.accent;
    ctx.fillText(block.title, pad, cursor + 22);
    cursor += 44;

    font(ctx, bodySize, 400, SANS);
    ctx.fillStyle = theme.sub;
    const maxLinesBySpace = Math.max(
      1,
      Math.floor((h - bottomReserve - cursor) / bodyLineH),
    );
    const lines = fitText(ctx, block.body, inner, Math.min(block.maxLines, maxLinesBySpace));
    lines.forEach((line, i) => {
      ctx.fillText(line, pad, cursor + bodyLineH * (i + 1) - 8);
    });
    cursor += bodyLineH * lines.length + 26;
  }

  // 模拟数据声明（固定贴在页脚上方）
  const warnY = h - (size.key === 'portrait' ? 132 : 96);
  font(ctx, 20, 500, MONO);
  ctx.fillStyle = theme.sub;
  const warn = fitText(ctx, '⚠ 所有用户规模 / 收入 / 融资数字均为模拟假设，非真实商业数据。', inner, 1);
  ctx.fillText(warn[0], pad, warnY);

  drawFooter(ctx, w, h, p, theme, pad);
}

/* ------------------------------------------------------------------ *
 * 对外：渲染成 canvas → PNG blob
 * ------------------------------------------------------------------ */
export function renderPosterCanvas(p: Project, key: PosterSize['key']): HTMLCanvasElement {
  const size = POSTER_SIZES[key];
  const canvas = document.createElement('canvas');
  canvas.width = size.width;
  canvas.height = size.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('canvas 2d context unavailable');
  drawPoster(ctx, p, size);
  return canvas;
}

/* ------------------------------------------------------------------ *
 * 排版自审：把每次 fillText 的边界记录下来，验证没有任何文字越界，
 * 也不会有正文压到页脚声明行上。供测试脚本调用。
 * ------------------------------------------------------------------ */

export interface TextRecord {
  text: string;
  x: number;
  y: number;
  width: number;
  /** 记录绘制瞬间的 textAlign，右对齐时 x 是右边界 */
  align: CanvasTextAlign;
  font: string;
}

export interface LayoutViolation {
  kind: 'out-of-canvas' | 'over-footer' | 'out-of-padding';
  text: string;
  x: number;
  right: number;
  y: number;
  font: string;
}

let collector: TextRecord[] | null = null;

export function auditPosterLayout(p: Project, key: PosterSize['key']): LayoutViolation[] {
  const size = POSTER_SIZES[key];
  const canvas = document.createElement('canvas');
  canvas.width = size.width;
  canvas.height = size.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('canvas 2d context unavailable');

  collector = [];
  const original = ctx.fillText.bind(ctx);
  const pad = Math.round(size.width * 0.075);
  const footerBandTop = size.height - pad - 54 - 18;
  try {
    ctx.fillText = ((text: string, x: number, y: number, maxWidth?: number) => {
      const width = ctx.measureText(text).width;
      collector?.push({ text, x, y, width, align: ctx.textAlign, font: ctx.font });
      return original(text, x, y, maxWidth);
    }) as CanvasRenderingContext2D['fillText'];
    drawPoster(ctx, p, size);
  } finally {
    ctx.fillText = original;
  }

  const records = collector ?? [];
  collector = null;

  const violations: LayoutViolation[] = [];
  for (const r of records) {
    const left = r.align === 'right' ? r.x - r.width : r.align === 'center' ? r.x - r.width / 2 : r.x;
    const right = left + r.width;
    if (right > size.width + 1 || r.y > size.height + 1 || left < -1) {
      violations.push({ kind: 'out-of-canvas', text: r.text, x: left, right, y: r.y, font: r.font });
      continue;
    }
    if (right > size.width - pad + 4) {
      violations.push({ kind: 'out-of-padding', text: r.text, x: left, right, y: r.y, font: r.font });
    }
    // 正文不得进入页脚区（页脚自身与警告行除外）
    const isFooter = r.y >= footerBandTop;
    const isWarn = r.y >= size.height - (key === 'portrait' ? 132 : 96) - 6 && r.y < footerBandTop;
    if (!isFooter && !isWarn && r.y > footerBandTop - 26) {
      violations.push({ kind: 'over-footer', text: r.text, x: left, right, y: r.y, font: r.font });
    }
  }
  return violations;
}

export function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error('toBlob failed'));
    }, 'image/png');
  });
}

export async function downloadPoster(p: Project, key: PosterSize['key'] = 'portrait'): Promise<string> {
  const canvas = renderPosterCanvas(p, key);
  const blob = await canvasToBlob(canvas);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${p.id}_poster_${key}.png`;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 8000);
  return a.download;
}
