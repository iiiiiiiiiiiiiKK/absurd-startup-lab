/**
 * 布局审计：多种视口宽度 × 多种模式 × 多个赛道，
 * 逐元素检测「横向溢出 / 被裁剪 / 页面级横向滚动」。
 *
 * 用法：node scripts/layout-audit.mjs [baseUrl]
 */
import puppeteer from 'puppeteer-core';
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const BASE = process.argv[2] || 'http://127.0.0.1:4285/';
const OUT = join(process.cwd(), '.layout-out');
rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });

const CHROME_PATHS = [
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
];
const executablePath = CHROME_PATHS.find((p) => existsSync(p));
if (!executablePath) {
  console.error('未找到 Chrome / Edge');
  process.exit(2);
}

let passed = 0;
const failures = [];
function check(name, cond, detail) {
  if (cond) {
    passed += 1;
    console.log(`  ✅ ${name}`);
  } else {
    failures.push(`${name}${detail ? ` — ${detail}` : ''}`);
    console.log(`  ❌ ${name}${detail ? ` — ${detail}` : ''}`);
  }
}

const VIEWPORTS = [
  { w: 320, h: 720, label: 'iPhone SE 窄屏' },
  { w: 390, h: 844, label: 'iPhone 14' },
  { w: 430, h: 932, label: 'iPhone 15 Pro Max' },
  { w: 768, h: 1024, label: 'iPad 竖屏' },
  { w: 1024, h: 768, label: '小笔记本' },
  { w: 1440, h: 900, label: '桌面' },
  { w: 1920, h: 1080, label: '大屏' },
];

const MODES = ['spoof', 'corporate', 'indie', 'ai', 'netculture', 'serious'];
const CATEGORIES = ['productivity', 'money', 'social', 'health', 'learning', 'workplace', 'aiwork', 'creator', 'pet', 'kitchen', 'home', 'mystic'];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function auditFn() {
  const problems = [];
  const root = document.querySelector('[data-testid="shell"]');
  if (!root) return [{ reason: 'missing-shell' }];
  const vw = window.innerWidth;
  for (const el of root.querySelectorAll('*')) {
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden') continue;
    // 刻意 1px 的隐藏元素（如文件选择 input）不算裁切
    if (el.classList.contains('sr-only')) continue;
    if (cs.position === 'fixed' && cs.opacity === '0') continue;
    const r = el.getBoundingClientRect();
    if (r.width === 0 && r.height === 0) continue;

    if (r.right > vw + 1 && cs.position !== 'fixed') {
      problems.push({
        reason: 'overflow-x',
        cls: String(el.className).slice(0, 36),
        right: Math.round(r.right),
        vw,
        text: (el.textContent || '').trim().slice(0, 24),
      });
      continue;
    }
    if (r.left < -1 && cs.position !== 'fixed') {
      problems.push({
        reason: 'overflow-left',
        cls: String(el.className).slice(0, 36),
        left: Math.round(r.left),
        text: (el.textContent || '').trim().slice(0, 24),
      });
    }
    const clipX = el.scrollWidth - el.clientWidth > 2;
    const clipY = el.scrollHeight - el.clientHeight > 2;
    const hiddenX = cs.overflowX === 'hidden' || cs.overflowX === 'clip';
    const hiddenY = cs.overflowY === 'hidden' || cs.overflowY === 'clip';
    if (clipX && hiddenX && el.clientWidth > 0) {
      problems.push({
        reason: 'clipped-x',
        cls: String(el.className).slice(0, 36),
        scroll: el.scrollWidth,
        client: el.clientWidth,
        text: (el.textContent || '').trim().slice(0, 24),
      });
    }
    if (clipY && hiddenY && el.clientHeight > 0) {
      const clamp = cs.webkitLineClamp;
      if (!clamp || clamp === 'none') {
        problems.push({
          reason: 'clipped-y',
          cls: String(el.className).slice(0, 36),
          scroll: el.scrollHeight,
          client: el.clientHeight,
          text: (el.textContent || '').trim().slice(0, 24),
        });
      }
    }
  }
  if (document.documentElement.scrollWidth > vw + 1) {
    problems.push({
      reason: 'page-overflow-x',
      scrollWidth: document.documentElement.scrollWidth,
      vw,
    });
  }
  return problems;
}

const browser = await puppeteer.launch({
  executablePath,
  headless: 'new',
  args: ['--no-sandbox', '--disable-dev-shm-usage'],
  defaultViewport: { width: 1440, height: 900 },
});

try {
  const page = await browser.newPage();
  page.on('pageerror', (e) => failures.push(`页面异常：${e.message}`));

  console.log('\n── 空状态 ────────────────────────────────────────────');
  for (const vp of VIEWPORTS) {
    await page.setViewport({ width: vp.w, height: vp.h, isMobile: vp.w < 500, hasTouch: vp.w < 500 });
    await page.goto(BASE, { waitUntil: 'networkidle2' });
    await page.waitForSelector('[data-testid="shell"]', { timeout: 10000 });
    const problems = await page.evaluate(auditFn);
    check(`空状态 · ${vp.w}×${vp.h}（${vp.label}）`, problems.length === 0, JSON.stringify(problems.slice(0, 3)));
  }

  console.log('\n── 六种模式 × 桌面 ────────────────────────────────────');
  await page.setViewport({ width: 1440, height: 900 });
  await page.goto(BASE, { waitUntil: 'networkidle2' });
  await page.waitForSelector('[data-testid="shell"]');
  await page.click('[data-testid="generate"]');
  await page.waitForSelector('[data-testid="proposal"]');
  for (const mode of MODES) {
    await page.click(`[data-testid="mode-${mode}"]`);
    await page.click('[data-testid="regenerate"]');
    await sleep(200);
    const problems = await page.evaluate(() => {
      const out = [];
      const root = document.querySelector('[data-testid="proposal"]');
      const vw = window.innerWidth;
      for (const el of root.querySelectorAll('*')) {
        const cs = getComputedStyle(el);
        if (cs.display === 'none' || cs.visibility === 'hidden') continue;
        const r = el.getBoundingClientRect();
        if (r.width === 0 && r.height === 0) continue;
        if (r.right > vw + 1) out.push({ reason: 'overflow-x', cls: String(el.className).slice(0, 30) });
        if (el.scrollWidth - el.clientWidth > 2 && (cs.overflowX === 'hidden' || cs.overflowX === 'clip')) {
          out.push({ reason: 'clipped-x', cls: String(el.className).slice(0, 30) });
        }
      }
      return out;
    });
    check(`模式「${mode}」提案排版`, problems.length === 0, JSON.stringify(problems.slice(0, 3)));
  }

  console.log('\n── 12 赛道 × 移动端 390 ──────────────────────────────');
  await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
  await page.goto(BASE, { waitUntil: 'networkidle2' });
  await page.waitForSelector('[data-testid="shell"]');
  await page.click('[data-testid="generate"]');
  await page.waitForSelector('[data-testid="proposal"]');
  for (const cat of CATEGORIES) {
    await page.click(`[data-testid="cat-${cat}"]`);
    await sleep(230);
    const problems = await page.evaluate(auditFn);
    check(`赛道「${cat}」移动端`, problems.length === 0, JSON.stringify(problems.slice(0, 3)));
  }

  console.log('\n── 全视口 × 当前提案 ─────────────────────────────────');
  for (const vp of VIEWPORTS) {
    await page.setViewport({ width: vp.w, height: vp.h, isMobile: vp.w < 500, hasTouch: vp.w < 500 });
    await page.reload({ waitUntil: 'networkidle2' });
    await page.waitForSelector('[data-testid="proposal"]', { timeout: 8000 });
    await sleep(180);
    const problems = await page.evaluate(auditFn);
    check(`提案 · ${vp.w}×${vp.h}（${vp.label}）`, problems.length === 0, JSON.stringify(problems.slice(0, 3)));
    await page.screenshot({ path: join(OUT, `proposal-${vp.w}.png`), fullPage: true });
  }

  console.log('\n── 弹窗与抽屉 ────────────────────────────────────────');
  await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
  await page.reload({ waitUntil: 'networkidle2' });
  await page.waitForSelector('[data-testid="proposal"]');
  await page.click('[data-testid="poster"]');
  await page.waitForSelector('[data-testid="poster-preview"]', { timeout: 8000 });
  const posterModal = await page.evaluate(() => {
    const m = document.querySelector('.modal');
    const r = m.getBoundingClientRect();
    return { right: r.right, vw: window.innerWidth, bottom: r.bottom, vh: window.innerHeight };
  });
  check('移动端海报弹窗不超出视口', posterModal.right <= posterModal.vw + 1 && posterModal.bottom <= posterModal.vh + 1, JSON.stringify(posterModal));
  await page.screenshot({ path: join(OUT, 'modal-poster-mobile.png') });
  await page.click('[data-testid="modal-close"]');
  await sleep(140);

  await page.click('[data-testid="angles"]');
  await page.waitForSelector('[data-testid="angle-launch"]');
  const anglesModal = await page.evaluate(() => {
    const m = document.querySelector('.modal');
    const r = m.getBoundingClientRect();
    return { right: r.right, vw: window.innerWidth };
  });
  check('移动端推广弹窗不超出视口', anglesModal.right <= anglesModal.vw + 1, JSON.stringify(anglesModal));
  await page.screenshot({ path: join(OUT, 'modal-angles-mobile.png') });
  await page.click('[data-testid="modal-close"]');
  await sleep(140);

  await page.click('.mobile-bar button[aria-label="历史"]');
  await page.waitForSelector('[data-testid="history-drawer"]');
  const drawer = await page.evaluate(() => {
    const d = document.querySelector('[data-testid="history-drawer"]');
    const r = d.getBoundingClientRect();
    return { right: r.right, vw: window.innerWidth, width: r.width };
  });
  check('移动端历史抽屉不超出视口', drawer.right <= drawer.vw + 1, JSON.stringify(drawer));
  await page.screenshot({ path: join(OUT, 'drawer-mobile.png') });

  writeFileSync(join(OUT, 'summary.json'), JSON.stringify({ passed, failures }, null, 2));
} catch (err) {
  failures.push(`未捕获异常：${err?.stack?.split('\n').slice(0, 3).join(' | ') ?? err}`);
} finally {
  await browser.close();
}

console.log(`\n${'═'.repeat(60)}`);
if (failures.length === 0) {
  console.log(`✅ 布局审计全部通过：${passed} 项`);
} else {
  console.log(`❌ 布局审计失败 ${failures.length} 项 / 通过 ${passed} 项`);
  for (const f of failures) console.log(`   · ${f}`);
  process.exit(1);
}
