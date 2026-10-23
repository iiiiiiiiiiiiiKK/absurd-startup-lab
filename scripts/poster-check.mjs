/**
 * 海报渲染校验：在真实浏览器里为多种模式渲染海报，
 * 检查尺寸、非空白、页脚声明存在、以及不同模式配色确实不同。
 *
 * 用法：node scripts/poster-check.mjs [baseUrl]
 */
import puppeteer from 'puppeteer-core';
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const BASE = process.argv[2] || 'http://127.0.0.1:4285/';
const OUT = join(process.cwd(), '.poster-out');
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

const MODES = ['spoof', 'corporate', 'indie', 'ai', 'netculture', 'serious'];

const browser = await puppeteer.launch({
  executablePath,
  headless: 'new',
  args: ['--no-sandbox', '--disable-dev-shm-usage'],
  defaultViewport: { width: 1440, height: 960 },
});

try {
  const page = await browser.newPage();
  page.on('pageerror', (e) => failures.push(`页面异常：${e.message}`));
  await page.goto(BASE, { waitUntil: 'networkidle2' });
  await page.waitForSelector('[data-testid="shell"]');
  await page.click('[data-testid="generate"]');
  await page.waitForSelector('[data-testid="proposal"]');

  const results = [];

  // 逐模式渲染：打开海报弹窗 → 读取 canvas 像素做统计校验
  for (const mode of MODES) {
    await page.click(`[data-testid="mode-${mode}"]`);
    await page.click('[data-testid="regenerate"]');
    await new Promise((r) => setTimeout(r, 240));
    await page.click('[data-testid="poster"]');
    await page.waitForSelector('[data-testid="poster-preview"]', { timeout: 8000 });
    await new Promise((r) => setTimeout(r, 200));

    for (const sizeKey of ['portrait', 'wide']) {
      if (sizeKey === 'wide') {
        await page.click('[data-testid="poster-wide"]');
        await new Promise((r) => setTimeout(r, 460));
      }
      const info = await page.evaluate((sk) => {
        const img = document.querySelector('[data-testid="poster-preview"]');
        const c = document.createElement('canvas');
        c.width = img.naturalWidth;
        c.height = img.naturalHeight;
        const ctx = c.getContext('2d');
        ctx.drawImage(img, 0, 0);
        const { width: w, height: h } = c;

        // 1) 统计颜色多样性（判断不是纯色空白）
        const colors = new Set();
        const data = ctx.getImageData(0, 0, w, h).data;
        for (let i = 0; i < data.length; i += 4 * 997) {
          colors.add(`${data[i]},${data[i + 1]},${data[i + 2]}`);
        }

        // 2) 页脚声明区域是否有文字像素（与背景不同）
        const bandTop = h - (sk === 'portrait' ? 200 : 150);
        const band = ctx.getImageData(0, bandTop, w, h - bandTop).data;
        const ref = [band[0], band[1], band[2]];
        let diffPixels = 0;
        for (let i = 0; i < band.length; i += 4) {
          if (
            Math.abs(band[i] - ref[0]) > 24 ||
            Math.abs(band[i + 1] - ref[1]) > 24 ||
            Math.abs(band[i + 2] - ref[2]) > 24
          ) {
            diffPixels += 1;
          }
        }

        // 3) 顶部主标题区域是否有足够文字
        const topBand = ctx.getImageData(0, Math.round(h * 0.1), w, Math.round(h * 0.25)).data;
        const ref2 = [topBand[0], topBand[1], topBand[2]];
        let topDiff = 0;
        for (let i = 0; i < topBand.length; i += 4) {
          if (
            Math.abs(topBand[i] - ref2[0]) > 24 ||
            Math.abs(topBand[i + 1] - ref2[1]) > 24 ||
            Math.abs(topBand[i + 2] - ref2[2]) > 24
          ) {
            topDiff += 1;
          }
        }

        // 4) 采样左上角与右下角，用于比较主题
        const px = (x, y) => {
          const d = ctx.getImageData(x, y, 1, 1).data;
          return `${d[0]},${d[1]},${d[2]}`;
        };

        return {
          width: w,
          height: h,
          colors: colors.size,
          footerTextPixels: diffPixels,
          topTextPixels: topDiff,
          corner: px(Math.round(w * 0.5), Math.round(h * 0.02)),
          center: px(Math.round(w * 0.5), Math.round(h * 0.5)),
          src: img.src.slice(0, 22),
        };
      }, sizeKey);

      const expect = sizeKey === 'portrait' ? { w: 1080, h: 1440 } : { w: 1200, h: 675 };
      check(`模式「${mode}」${sizeKey} 尺寸 ${expect.w}×${expect.h}`, info.width === expect.w && info.height === expect.h, `${info.width}×${info.height}`);
      check(`模式「${mode}」${sizeKey} 色彩丰富（非空白）`, info.colors > 60, `${info.colors} 种采样色`);
      check(`模式「${mode}」${sizeKey} 顶部有标题文字`, info.topTextPixels > 2000, `${info.topTextPixels} px`);
      check(`模式「${mode}」${sizeKey} 页脚有声明文字`, info.footerTextPixels > 800, `${info.footerTextPixels} px`);
      results.push({ mode, sizeKey, ...info });
    }

    await page.click('[data-testid="modal-close"]');
    await new Promise((r) => setTimeout(r, 160));
  }

  // 不同模式配色应不同
  const portraitCorners = new Map();
  for (const r of results.filter((x) => x.sizeKey === 'portrait')) {
    portraitCorners.set(r.mode, r.center);
  }
  const uniqueColors = new Set([...portraitCorners.values()]);
  check('六种模式海报配色至少 5 种不同', uniqueColors.size >= 5, `${uniqueColors.size}`);

  // 直出大图存档（便于人工查看）
  await page.click('[data-testid="poster"]');
  await page.waitForSelector('[data-testid="poster-preview"]');
  await new Promise((r) => setTimeout(r, 260));
  const dataUrl = await page.$eval('[data-testid="poster-preview"]', (el) => el.src);
  writeFileSync(join(OUT, 'portrait.png'), Buffer.from(dataUrl.split(',')[1], 'base64'));
  await page.click('[data-testid="poster-wide"]');
  await new Promise((r) => setTimeout(r, 460));
  const wideUrl = await page.$eval('[data-testid="poster-preview"]', (el) => el.src);
  writeFileSync(join(OUT, 'wide.png'), Buffer.from(wideUrl.split(',')[1], 'base64'));
  check('海报文件已写出', existsSync(join(OUT, 'portrait.png')) && existsSync(join(OUT, 'wide.png')));

  /* ---------------- 压力：超长内容不越界 ---------------- */
  console.log('\n── 超长内容海报 ──────────────────────────────────────');
  await page.click('[data-testid="modal-close"]');
  await new Promise((r) => setTimeout(r, 160));
  await page.goto(BASE + '?audit=1', { waitUntil: 'networkidle2' });
  await page.waitForFunction(() => typeof window.__aslPosterAudit === 'function', { timeout: 10000 });

  const brutalProject = {
    id: 'ASL-AAAA-BBBB',
    revision: 1,
    createdAt: Date.now(),
    seed: 1,
    mode: 'spoof',
    spice: 'extreme',
    category: 'mystic',
    slots: { audience: 0, pain: 0, mechanic: 0, pricing: 0, channel: 0, wild: 0 },
    name: '「一个名字长到必须两行才能放下并且还会被省略号截断的离谱项目」有限公司',
    tagline:
      '这句话故意写得非常长，用来验证海报在极限长度下是否仍然不会把文字画到画布外面去，也不会压到页脚的声明文字上。',
    targetUsers: '这是一群非常非常特殊的用户，他们的共同特征是每天都要面对大量重复且毫无意义的决策，'.repeat(3),
    painPoints: '痛点描述也写得非常长，用来测试换行与限行逻辑是否可靠。'.repeat(4),
    solution: '解决方案同样很长，包含了对机制的详细说明以及为什么这套机制在逻辑上成立。'.repeat(4),
    features: ['功能一', '功能二', '功能三'],
    pricing: '订阅制',
    acquisition: '社区渗透',
    wildestHook: '最离谱的卖点也必须足够长，才能验证这一段是否会挤占到下面的空间。'.repeat(3),
    tweet: '这是一条很长的推文',
    investorQuestions: ['问题一', '问题二'],
    founderDread: '最不愿回答的问题',
    metrics: { assumption: '模拟假设', tam: '假设', users: '假设', revenue: '假设', funding: '假设' },
    tags: ['#A', '#B'],
  };

  for (const key of ['portrait', 'wide']) {
    const violations = await page.evaluate(
      (proj, k) => window.__aslPosterAudit(proj, k),
      brutalProject,
      key,
    );
    check(
      `超长内容 · ${key} 无文字越界（${violations.length} 处）`,
      violations.length === 0,
      JSON.stringify(violations.slice(0, 4)),
    );
  }

  // 正常内容也不能越界
  const normalProject = await page.evaluate(() => {
    const store = JSON.parse(localStorage.getItem('asl.store.v1') || '{}');
    return store.projects?.find((x) => x.id === store.currentId) ?? null;
  });
  if (normalProject) {
    for (const key of ['portrait', 'wide']) {
      const violations = await page.evaluate(
        (proj, k) => window.__aslPosterAudit(proj, k),
        normalProject,
        key,
      );
      check(`常规内容 · ${key} 无文字越界`, violations.length === 0, JSON.stringify(violations.slice(0, 3)));
    }
  }

  writeFileSync(join(OUT, 'summary.json'), JSON.stringify({ passed, failures, results }, null, 2));
} catch (err) {
  failures.push(`未捕获异常：${err?.stack?.split('\n').slice(0, 3).join(' | ') ?? err}`);
} finally {
  await browser.close();
}

console.log(`\n${'═'.repeat(60)}`);
if (failures.length === 0) {
  console.log(`✅ 海报校验全部通过：${passed} 项`);
} else {
  console.log(`❌ 海报校验失败 ${failures.length} 项 / 通过 ${passed} 项`);
  for (const f of failures) console.log(`   · ${f}`);
  process.exit(1);
}
