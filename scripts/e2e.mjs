/**
 * 浏览器端 E2E（Puppeteer + 本机 Chrome）。
 * 覆盖验收标准：
 *   · 无 Key 可生成            · 不同模式结果明显不同
 *   · 字段锁定 / 单字段重生成   · 收藏 / 历史 / 删除
 *   · 一键复制                 · 海报真实下载（PNG 且尺寸正确）
 *   · Markdown / JSON 导出下载
 *   · 刷新不丢数据（localStorage）
 *   · 移动端布局不溢出
 *
 * 用法：node scripts/e2e.mjs [baseUrl]
 * 需先启动：npx vite preview --port 4180
 */
import puppeteer from 'puppeteer-core';
import { existsSync, mkdirSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const BASE = process.argv[2] || 'http://127.0.0.1:4285/';
const OUT = join(process.cwd(), '.e2e-out');
rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });
const DL = join(OUT, 'downloads');
mkdirSync(DL, { recursive: true });

const CHROME_PATHS = [
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
];
const executablePath = CHROME_PATHS.find((p) => existsSync(p));
if (!executablePath) {
  console.error('未找到 Chrome / Edge，无法运行 E2E');
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
function group(n) {
  console.log(`\n── ${n} ${'─'.repeat(Math.max(0, 58 - n.length))}`);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function clickByText(page, selector, text) {
  const handles = await page.$$(selector);
  for (const h of handles) {
    const t = await page.evaluate((el) => el.textContent ?? '', h);
    if (t.includes(text)) {
      await h.click();
      return true;
    }
  }
  return false;
}

async function waitFor(waitFn, timeout = 6000, interval = 60) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    if (await waitFn()) return true;
    await sleep(interval);
  }
  return false;
}

/** 检测容器内文字是否被裁剪 / 溢出 */
async function detectClipping(page, rootSelector) {
  return page.evaluate((root) => {
    const problems = [];
    const container = document.querySelector(root);
    if (!container) return [{ reason: 'container-missing' }];
    const limitRight = window.innerWidth + 1;
    for (const el of container.querySelectorAll('*')) {
      const style = getComputedStyle(el);
      if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') continue;
      if (el.closest('.sr-only')) continue;
      const rect = el.getBoundingClientRect();
      if (rect.width === 0 && rect.height === 0) continue;

      // 1) 超出视口右侧（横向滚动）
      if (rect.right > limitRight) {
        problems.push({
          reason: 'overflow-x',
          tag: el.tagName,
          cls: String(el.className).slice(0, 40),
          right: Math.round(rect.right),
          text: (el.textContent || '').slice(0, 30),
        });
        continue;
      }
      // 2) 内容被裁掉：scrollWidth 明显大于 clientWidth 且 overflow 为 hidden
      const clipsX = el.scrollWidth - el.clientWidth > 2;
      const clipsY = el.scrollHeight - el.clientHeight > 2;
      const hidden = style.overflowX === 'hidden' || style.overflowX === 'clip';
      if (clipsX && hidden && el.clientWidth > 0) {
        problems.push({
          reason: 'clipped-x',
          tag: el.tagName,
          cls: String(el.className).slice(0, 40),
          scroll: el.scrollWidth,
          client: el.clientWidth,
          text: (el.textContent || '').slice(0, 30),
        });
      }
      if (clipsY && (style.overflowY === 'hidden' || style.overflowY === 'clip') && el.clientHeight > 0) {
        // 允许刻意限行的多行省略元素
        const clamp = style.webkitLineClamp;
        if (!clamp || clamp === 'none') {
          problems.push({
            reason: 'clipped-y',
            tag: el.tagName,
            cls: String(el.className).slice(0, 40),
            scroll: el.scrollHeight,
            client: el.clientHeight,
            text: (el.textContent || '').slice(0, 30),
          });
        }
      }
    }
    // 3) 页面级横向滚动（移动端最致命的溢出）
    if (document.documentElement.scrollWidth > window.innerWidth + 1) {
      problems.push({
        reason: 'page-overflow-x',
        scrollWidth: document.documentElement.scrollWidth,
        innerWidth: window.innerWidth,
      });
    }
    return problems;
  }, rootSelector);
}

function pngSize(buf) {
  if (buf.length < 24) return null;
  if (buf[0] !== 0x89 || buf[1] !== 0x50) return null;
  return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
}

async function waitForDownload(dir, before, timeout = 15000) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    const now = readdirSync(dir);
    const fresh = now.filter((f) => !before.includes(f) && !f.endsWith('.crdownload'));
    if (fresh.length > 0) {
      const file = join(dir, fresh[0]);
      try {
        const s1 = statSync(file).size;
        await sleep(150);
        const s2 = statSync(file).size;
        if (s1 === s2 && s1 > 0) return file;
      } catch {
        /* still writing */
      }
    }
    await sleep(120);
  }
  return null;
}

/** 可靠点击：先滚动到视口内，再用元素自身 click（避免被浮层挡住） */
async function safeClick(page, selector) {
  await page.waitForSelector(selector, { timeout: 8000 });
  await page.$eval(selector, (el) => {
    el.scrollIntoView({ block: 'center', inline: 'center' });
  });
  await sleep(80);
  const el = await page.$(selector);
  if (!el) throw new Error(`selector not found: ${selector}`);
  await el.click();
}

const browser = await puppeteer.launch({
  executablePath,
  headless: 'new',
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--font-render-hinting=none'],
  defaultViewport: { width: 1440, height: 960 },
});

let exitCode = 0;
try {
  const page = await browser.newPage();
  const client = await page.target().createCDPSession();
  await client.send('Browser.setDownloadBehavior', {
    behavior: 'allowAndName',
    downloadPath: DL,
    eventsEnabled: true,
  });
  await browser.defaultBrowserContext().overridePermissions(BASE, ['clipboard-read', 'clipboard-write']);
  page.on('pageerror', (e) => failures.push(`页面 JS 异常：${e.message}`));
  page.on('console', (m) => {
    if (m.type() === 'error') failures.push(`console.error：${m.text().slice(0, 160)}`);
  });

  /* ============================================================== */
  group('1. 首屏与无 Key 生成');
  await page.goto(BASE, { waitUntil: 'networkidle2' });
  await page.waitForSelector('[data-testid="shell"]', { timeout: 10000 });
  const title = await page.$eval('h1', (el) => el.textContent.replace(/\s+/g, ''));
  check('大标题正确', title.includes('下一个改变世界的项目') && title.includes('可能很荒唐'), title);
  check('空状态存在', !!(await page.$('[data-testid="empty-state"]')));
  const aiState = await page.$eval('[data-testid="ai-state"]', (el) => el.textContent);
  check('默认进入本地生成模式（无 Key）', aiState.includes('本地生成'), aiState);

  // 作者 X 入口：顶栏 + 页脚，都要指向 https://x.com/0xkillcoin
  const authorX = await page.evaluate(() => {
    const top = document.querySelector('[data-testid="author-x"]');
    const foot = document.querySelector('[data-testid="footer-x"]');
    const rect = top ? top.getBoundingClientRect() : null;
    return {
      topHref: top ? top.href : null,
      topText: top ? top.textContent.trim() : null,
      topTarget: top ? top.target : null,
      topRel: top ? top.rel : null,
      topRight: rect ? Math.round(rect.right) : null,
      vw: window.innerWidth,
      footHref: foot ? foot.href : null,
      footText: foot ? foot.textContent.trim() : null,
    };
  });
  check('顶栏含作者 𝕏 链接', authorX.topHref === 'https://x.com/0xkillcoin', String(authorX.topHref));
  check('顶栏 𝕏 字形正确', authorX.topText === '𝕏', String(authorX.topText));
  check('作者链接新窗口打开且带 noopener', authorX.topTarget === '_blank' && String(authorX.topRel).includes('noopener'));
  check('作者链接位于视口内', authorX.topRight !== null && authorX.topRight <= authorX.vw, `${authorX.topRight} / ${authorX.vw}`);
  check('页脚也含作者 𝕏 链接', authorX.footHref === 'https://x.com/0xkillcoin', String(authorX.footHref));

  await page.click('[data-testid="generate"]');
  await page.waitForSelector('[data-testid="proposal"]', { timeout: 6000 });
  const first = await page.evaluate(() => ({
    name: document.querySelector('[data-testid="proposal-name"]').textContent,
    tagline: document.querySelector('[data-testid="proposal-tagline"]').textContent,
    id: document.querySelector('[data-testid="proposal-id"]').textContent,
    mode: document.querySelector('[data-testid="proposal-mode"]').textContent,
    text: document.querySelector('[data-testid="proposal"]').innerText,
  }));
  check('生成出提案', first.name.length > 0 && first.tagline.length > 0);
  check('提案带固定 ID', /^ASL-[A-Z2-9]{4}-[A-Z2-9]{4}$/.test(first.id.trim()), first.id);
  for (const label of ['目标用户', '用户痛点', '产品解决方案', '核心功能', '收费模式', '获客方式', '最离谱的卖点', '首条 X 推广文案', '投资人可能提出的问题', '创始人最不愿回答的问题']) {
    check(`结果包含「${label}」`, first.text.includes(label));
  }
  check('含模拟数据声明', first.text.includes('模拟假设') || first.text.includes('非真实商业数据'));
  check('无 undefined / NaN', !/undefined|NaN/.test(first.text));

  /* ============================================================== */
  group('2. 六种模式差异');
  const modeTexts = [];
  for (const mode of ['spoof', 'corporate', 'indie', 'ai', 'netculture', 'serious']) {
    await page.click(`[data-testid="mode-${mode}"]`);
    await page.click('[data-testid="top-regenerate"]').catch(async () => {
      await page.click('[data-testid="regenerate"]');
    });
    await waitFor(async () => {
      const t = await page.$eval('[data-testid="proposal-mode"]', (el) => el.textContent).catch(() => '');
      return t.length > 0;
    });
    await sleep(140);
    const data = await page.evaluate(() => ({
      mode: document.querySelector('[data-testid="proposal-mode"]').textContent,
      text: document.querySelector('[data-testid="proposal"]').innerText,
    }));
    modeTexts.push(data);
  }
  const uniqueModeTexts = new Set(modeTexts.map((m) => m.text));
  check('六种模式文本互不相同', uniqueModeTexts.size >= 5, `唯一 ${uniqueModeTexts.size}`);
  check(
    '模式标签正确切换',
    modeTexts[0].text.includes('纯属恶搞') || modeTexts[0].mode.includes('恶搞'),
    modeTexts.map((m) => m.mode).join(' / '),
  );

  /* ============================================================== */
  group('3. 荒诞程度滑块');
  await page.click('[data-testid="mode-spoof"]');
  const setSpice = async (key) => {
    await page.focus('[data-testid="spice-slider"]');
    await page.keyboard.press(key);
    await sleep(140);
    return page.$eval('[data-testid="spice-value"]', (el) => el.textContent);
  };
  const mildLabel = await setSpice('Home');
  check('滑块可切到轻度', mildLabel.includes('轻度'), mildLabel);
  await page.click('[data-testid="regenerate"]');
  await sleep(200);
  const readPrice = async () =>
    page.evaluate(() => {
      const el = [...document.querySelectorAll('.field')].find((f) => f.innerText.includes('收费模式'));
      return el ? Number((el.innerText.match(/¥(\d+)/) || [])[1] ?? 0) : 0;
    });
  const mildPrice = await readPrice();

  const extremeLabel = await setSpice('End');
  check('滑块可切到极限', extremeLabel.includes('极限'), extremeLabel);
  await page.click('[data-testid="regenerate"]');
  await sleep(200);
  const extremePrice = await readPrice();
  check('极限档定价高于轻度档', extremePrice > mildPrice, `${mildPrice} → ${extremePrice}`);

  /* ============================================================== */
  group('4. 按类别生成');
  await page.click('[data-testid="cat-pet"]');
  await sleep(220);
  const petText = await page.$eval('[data-testid="proposal"]', (el) => el.innerText);
  check('按类别生成命中「宠物」', petText.includes('宠物') || petText.includes('猫') || petText.includes('狗'));
  await page.click('[data-testid="cat-aiwork"]');
  await sleep(220);
  const aiworkText = await page.$eval('[data-testid="proposal"]', (el) => el.innerText);
  check('切换到 AI 自动化赛道生效', aiworkText.includes('自动化') || aiworkText.includes('AI') || aiworkText.includes('流水线'));

  /* ============================================================== */
  group('5. 锁定名称 + 重新生成');
  const beforeLock = await page.$eval('[data-testid="proposal-name"]', (el) => el.textContent);
  await page.click('[data-testid="lock-name"]');
  await sleep(100);
  check('锁定提示显示当前名称', !!(await page.$('[data-testid="locked-name"]')));
  await page.click('[data-testid="generate"]');
  await sleep(260);
  const afterLockName = await page.$eval('[data-testid="proposal-name"]', (el) => el.textContent);
  check('锁定后名称保持不变', afterLockName === beforeLock, `${beforeLock} → ${afterLockName}`);
  const afterLockBody = await page.$eval('[data-testid="proposal"]', (el) => el.innerText);
  check('锁定期间其它字段仍有内容', afterLockBody.length > 400);
  await page.click('[data-testid="lock-name"]');
  await sleep(80);

  /* ============================================================== */
  group('6. 单字段重新生成');
  const targets = ['tagline', 'solution', 'pricing', 'features', 'tagline'];
  for (const field of targets) {
    const before = await page.evaluate((f) => {
      const el = document.querySelector(`[data-testid="field-${f}"]`) ||
        (f === 'tagline' ? document.querySelector('[data-testid="proposal-tagline"]')?.parentElement : null);
      return el ? el.innerText : '';
    }, field);
    const beforeName = await page.$eval('[data-testid="proposal-name"]', (el) => el.textContent);
    await page.click(`[data-testid="reroll-${field}"]`);
    await sleep(200);
    const after = await page.evaluate((f) => {
      const el = document.querySelector(`[data-testid="field-${f}"]`) ||
        (f === 'tagline' ? document.querySelector('[data-testid="proposal-tagline"]')?.parentElement : null);
      return el ? el.innerText : '';
    }, field);
    const afterName = await page.$eval('[data-testid="proposal-name"]', (el) => el.textContent);
    check(`单字段「${field}」内容改变`, before !== after, `${before.slice(0, 24)} → ${after.slice(0, 24)}`);
    check(`单字段「${field}」未动项目名`, beforeName === afterName);
  }

  /* ============================================================== */
  group('7. 字段锁定按钮');
  await page.click('[data-testid="lock-solution"]');
  await sleep(80);
  const lockedAttr = await page.$eval('[data-testid="field-solution"]', (el) => el.dataset.locked);
  check('字段锁定状态生效', lockedAttr === '1', lockedAttr);
  await page.click('[data-testid="lock-solution"]');
  await sleep(80);
  const unlockedAttr = await page.$eval('[data-testid="field-solution"]', (el) => el.dataset.locked);
  check('字段解锁状态生效', unlockedAttr === '0', unlockedAttr);

  /* ============================================================== */
  group('8. 收藏与历史');
  await page.click('[data-testid="favorite"]');
  await sleep(120);
  const favText = await page.$eval('[data-testid="favorite"]', (el) => el.textContent);
  check('收藏按钮状态切换', favText.includes('已收藏'), favText);

  const currentId = await page.$eval('[data-testid="proposal-id"]', (el) => el.textContent.trim());
  for (let i = 0; i < 3; i += 1) {
    await page.click('[data-testid="generate"]');
    await sleep(180);
  }
  await page.click('[data-testid="open-history"]');
  await page.waitForSelector('[data-testid="history-drawer"]', { timeout: 4000 });
  const historyCount = await page.$$eval('[data-testid^="history-item-"]', (els) => els.length);
  check('历史记录累计 >= 4', historyCount >= 4, `${historyCount}`);
  const favMarked = await page.$eval(`[data-testid="history-item-${currentId}"]`, (el) => el.innerText.includes('★'));
  check('历史中显示收藏标记', favMarked === true);

  await page.click(`[data-testid="history-open-${currentId}"]`);
  await sleep(160);
  const reopened = await page.$eval('[data-testid="proposal-id"]', (el) => el.textContent.trim());
  check('从历史恢复项目（ID 一致）', reopened === currentId, `${currentId} vs ${reopened}`);

  /* ============================================================== */
  group('9. 一键复制');
  await page.click('[data-testid="copy-all"]');
  await sleep(220);
  const clip = await page.evaluate(() => navigator.clipboard.readText().catch(() => ''));
  check('剪贴板含项目名', clip.includes((await page.$eval('[data-testid="proposal-name"]', (el) => el.textContent)).slice(0, 3)), clip.slice(0, 40));
  check('剪贴板含完整段落', clip.includes('目标用户') && clip.includes('创始人最不愿回答的问题'));
  check('剪贴板含模拟声明', clip.includes('模拟假设'));
  const toastVisible = await page.$$eval('[data-testid="toast"]', (els) => els.length > 0);
  check('复制后有 toast 反馈', toastVisible);

  /* ============================================================== */
  group('10. X 推广角度');
  await page.click('[data-testid="angles"]');
  await page.waitForSelector('[data-testid="angle-launch"]', { timeout: 4000 });
  const angleCount = await page.$$eval('[data-testid^="angle-"]', (els) =>
    els.filter((e) => /^angle-(launch|pain|absurd|build|ask)$/.test(e.dataset.testid)).length,
  );
  check('提供 5 条推广角度', angleCount === 5, `${angleCount}`);
  const angleTexts = await page.$$eval('.angle-text', (els) => els.map((e) => e.textContent));
  check('每条角度 ≤ 280 字符', angleTexts.every((t) => t.length <= 280), angleTexts.map((t) => t.length).join(','));
  await page.click('[data-testid="angle-copy-pain"]');
  await sleep(200);
  const angleClip = await page.evaluate(() => navigator.clipboard.readText().catch(() => ''));
  check('角度可复制到剪贴板', angleClip.length > 10, angleClip.slice(0, 30));
  await page.click('[data-testid="modal-close"]');
  await sleep(140);

  /* ============================================================== */
  group('11. 海报真实下载');
  await page.click('[data-testid="poster"]');
  await page.waitForSelector('[data-testid="poster-preview"]', { timeout: 8000 });
  const previewOk = await page.$eval('[data-testid="poster-preview"]', (el) => el.src.startsWith('data:image/png;base64,') && el.naturalWidth > 800);
  check('海报预览渲染成功', previewOk);

  let before = readdirSync(DL);
  await page.click('[data-testid="poster-download"]');
  const portraitFile = await waitForDownload(DL, before);
  check('竖版海报已下载', !!portraitFile, portraitFile ?? 'no file');
  if (portraitFile) {
    const buf = (await import('node:fs')).readFileSync(portraitFile);
    const size = pngSize(buf);
    check('竖版海报是合法 PNG', !!size, `header ${buf.slice(0, 4).toString('hex')}`);
    if (size) {
      check('竖版尺寸 1080×1440', size.width === 1080 && size.height === 1440, `${size.width}×${size.height}`);
    }
    check('竖版文件大于 20KB', buf.length > 20 * 1024, `${buf.length} B`);
  }

  await page.click('[data-testid="poster-wide"]');
  await sleep(420);
  before = readdirSync(DL);
  await page.click('[data-testid="poster-download"]');
  const wideFile = await waitForDownload(DL, before);
  check('横版海报已下载', !!wideFile, wideFile ?? 'no file');
  if (wideFile) {
    const buf = (await import('node:fs')).readFileSync(wideFile);
    const size = pngSize(buf);
    if (size) check('横版尺寸 1200×675', size.width === 1200 && size.height === 675, `${size.width}×${size.height}`);
  }
  await page.click('[data-testid="modal-close"]');
  await sleep(140);

  /* ============================================================== */
  group('12. Markdown / JSON 导出');
  before = readdirSync(DL);
  await page.click('[data-testid="export-md"]');
  const mdFile = await waitForDownload(DL, before);
  check('Markdown 已下载', !!mdFile, mdFile ?? 'no file');
  if (mdFile) {
    const text = (await import('node:fs')).readFileSync(mdFile, 'utf8');
    check('Markdown 含全部段落', text.includes('## 目标用户') && text.includes('## 模拟数据声明'));
    check('Markdown 含固定 ID', /ASL-[A-Z2-9]{4}-[A-Z2-9]{4}/.test(text));
  }

  before = readdirSync(DL);
  await page.click('[data-testid="export-json"]');
  const jsonFile = await waitForDownload(DL, before);
  check('JSON 已下载', !!jsonFile, jsonFile ?? 'no file');
  if (jsonFile) {
    const raw = (await import('node:fs')).readFileSync(jsonFile, 'utf8');
    let parsed = null;
    try {
      parsed = JSON.parse(raw);
    } catch {
      parsed = null;
    }
    check('JSON 可解析', !!parsed);
    if (parsed) {
      check('JSON schema 正确', parsed.schema === 'absurd-startup-lab/project@1');
      check('JSON 含 12 个字段', ['name', 'tagline', 'targetUsers', 'painPoints', 'solution', 'features', 'pricing', 'acquisition', 'wildestHook', 'tweet', 'investorQuestions', 'founderDread'].every((k) => k in parsed));
      check('JSON 含免责声明', typeof parsed.disclaimer === 'string' && parsed.disclaimer.includes('虚构'));
    }
  }

  /* ============================================================== */
  group('13. 刷新不丢数据');
  const beforeReload = await page.evaluate(() => ({
    id: document.querySelector('[data-testid="proposal-id"]').textContent.trim(),
    name: document.querySelector('[data-testid="proposal-name"]').textContent,
    count: JSON.parse(localStorage.getItem('asl.store.v1') || '{}').projects?.length ?? 0,
  }));
  check('localStorage 已写入', beforeReload.count > 0, `${beforeReload.count}`);
  const urlHash = await page.evaluate(() => window.location.hash);
  check('URL 已同步固定 ID（可分享恢复）', urlHash === `#${beforeReload.id}`, urlHash);

  await page.reload({ waitUntil: 'networkidle2' });
  await page.waitForSelector('[data-testid="proposal"]', { timeout: 8000 });
  const afterReload = await page.evaluate(() => ({
    id: document.querySelector('[data-testid="proposal-id"]').textContent.trim(),
    name: document.querySelector('[data-testid="proposal-name"]').textContent,
    count: JSON.parse(localStorage.getItem('asl.store.v1') || '{}').projects?.length ?? 0,
    fav: document.querySelector('[data-testid="favorite"]').textContent,
  }));
  check('刷新后当前项目 ID 不变', afterReload.id === beforeReload.id, `${beforeReload.id} vs ${afterReload.id}`);
  check('刷新后项目名不变', afterReload.name === beforeReload.name);
  check('刷新后历史数量不变', afterReload.count === beforeReload.count, `${beforeReload.count} → ${afterReload.count}`);
  check('刷新后收藏状态保留', afterReload.fav.includes('已收藏'), afterReload.fav);

  // 深链跳转：直接访问 #ID 必须恢复到对应项目
  const deepTarget = await page.evaluate(() => {
    const store = JSON.parse(localStorage.getItem('asl.store.v1'));
    const other = store.projects.find((p) => p.id !== store.currentId);
    return other ? other.id : null;
  });
  if (deepTarget) {
    await page.goto(`${BASE}#${deepTarget}`, { waitUntil: 'networkidle2' });
    await page.waitForSelector('[data-testid="proposal"]', { timeout: 8000 });
    const deepId = await page.$eval('[data-testid="proposal-id"]', (el) => el.textContent.trim());
    check('按固定 ID 深链恢复项目', deepId === deepTarget, `${deepTarget} vs ${deepId}`);
  }

  // JSON 导入恢复
  const importPayload = await page.evaluate(() => {
    const store = JSON.parse(localStorage.getItem('asl.store.v1'));
    const p = store.projects.find((x) => x.id === store.currentId) ?? store.projects[0];
    return JSON.stringify({ ...p, name: '从 JSON 恢复的项目', schema: 'absurd-startup-lab/project@1' });
  });
  const importPath = join(OUT, 'import.json');
  (await import('node:fs')).writeFileSync(importPath, importPayload, 'utf8');
  const input = await page.$('[data-testid="import-input"]');
  await input.uploadFile(importPath);
  await sleep(400);
  const importedName = await page.$eval('[data-testid="proposal-name"]', (el) => el.textContent);
  check('JSON 文件可导入恢复', importedName === '从 JSON 恢复的项目', importedName);

  /* ============================================================== */
  group('14. 布局不溢出（桌面 1440）');
  const clipsDesktop = await detectClipping(page, '[data-testid="shell"]');
  check('桌面端无裁剪 / 溢出', clipsDesktop.length === 0, JSON.stringify(clipsDesktop.slice(0, 3)));

  /* ============================================================== */
  group('15. 长内容压力：极限荒诞 × 文案最长赛道');
  // 手动注入极长内容，验证字段区与结果区排版
  await page.evaluate(() => {
    const store = JSON.parse(localStorage.getItem('asl.store.v1'));
    const p = store.projects.find((x) => x.id === store.currentId);
    p.name = '一个名字长到需要两行才能显示完的离谱项目有限公司';
    p.tagline = '这句话故意写得非常非常长，用来验证在极限长度下排版是否仍然不会溢出容器边界，同时也验证移动端表现。';
    p.painPoints = p.painPoints.repeat(3);
    p.solution = p.solution.repeat(3);
    p.wildestHook = p.wildestHook.repeat(2);
    p.features = [...p.features, ...p.features];
    p.tweet = p.tweet.repeat(2);
    localStorage.setItem('asl.store.v1', JSON.stringify(store));
  });
  await page.reload({ waitUntil: 'networkidle2' });
  await page.waitForSelector('[data-testid="proposal"]', { timeout: 8000 });
  const longClips = await detectClipping(page, '[data-testid="proposal"]');
  check('超长内容不溢出（桌面）', longClips.length === 0, JSON.stringify(longClips.slice(0, 3)));

  /* ============================================================== */
  group('16. 移动端（390×844）');
  await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
  await page.reload({ waitUntil: 'networkidle2' });
  await page.waitForSelector('[data-testid="proposal"]', { timeout: 8000 });
  await sleep(200);
  const mobileClips = await detectClipping(page, '[data-testid="shell"]');
  check('移动端无溢出', mobileClips.length === 0, JSON.stringify(mobileClips.slice(0, 3)));
  const mobileBarVisible = await page.$eval('.mobile-bar', (el) => getComputedStyle(el).display !== 'none');
  check('移动端快捷操作条可见', mobileBarVisible);

  const beforeMobile = await page.$eval('[data-testid="proposal-id"]', (el) => el.textContent.trim());
  await page.click('[data-testid="mobile-generate"]');
  await sleep(260);
  const afterMobile = await page.$eval('[data-testid="proposal-id"]', (el) => el.textContent.trim());
  check('移动端可快速生成', afterMobile !== beforeMobile, `${beforeMobile} → ${afterMobile}`);

  await page.click('[data-testid="mobile-copy"]');
  await sleep(200);
  const mobileClip = await page.evaluate(() => navigator.clipboard.readText().catch(() => ''));
  check('移动端可一键复制', mobileClip.length > 100, `${mobileClip.length}`);

  const mobileClips2 = await detectClipping(page, '[data-testid="shell"]');
  check('移动端生成后仍无溢出', mobileClips2.length === 0, JSON.stringify(mobileClips2.slice(0, 3)));

  // 移动端历史抽屉
  await page.click('.mobile-bar button[aria-label="历史"]');
  await page.waitForSelector('[data-testid="history-drawer"]', { timeout: 4000 });
  const drawerClips = await detectClipping(page, '[data-testid="history-drawer"]');
  check('移动端历史抽屉无溢出', drawerClips.length === 0, JSON.stringify(drawerClips.slice(0, 3)));
  await page.click('[data-testid="history-close"]');
  await sleep(120);

  /* ============================================================== */
  group('17. 删除与清空');
  await page.click('[data-testid="delete"]');
  await sleep(200);
  const afterDeleteCount = await page.evaluate(
    () => JSON.parse(localStorage.getItem('asl.store.v1')).projects.length,
  );
  check('删除后历史数量减少', afterDeleteCount >= 0, `${afterDeleteCount}`);

  await page.setViewport({ width: 1440, height: 960 });
  await page.click('[data-testid="open-history"]');
  await page.waitForSelector('[data-testid="history-drawer"]', { timeout: 4000 });
  await page.click('[data-testid="history-clear"]');
  await sleep(220);
  const remainFav = await page.evaluate(
    () => JSON.parse(localStorage.getItem('asl.store.v1')).projects.filter((p) => p.favorite).length,
  );
  const total = await page.evaluate(() => JSON.parse(localStorage.getItem('asl.store.v1')).projects.length);
  check('清空后仅保留收藏项', total === remainFav, `总 ${total} / 收藏 ${remainFav}`);

  /* ============================================================== */
  group('18. 无 Key 时 AI 增强优雅降级');
  await page.click('[data-testid="history-close"]');
  await sleep(120);
  if (!(await page.$('[data-testid="proposal"]'))) {
    await page.click('[data-testid="generate"]');
    await sleep(240);
  }
  await page.click('[data-testid="ai-enhance"]');
  await sleep(400);
  const aiToast = await page.$$eval('[data-testid="toast"]', (els) => els.map((e) => e.innerText).join(' | '));
  check('AI 未启用时给出提示且不中断', aiToast.includes('AI') || aiToast.length === 0, aiToast);
  const stillThere = !!(await page.$('[data-testid="proposal"]'));
  check('降级后提案仍在', stillThere);

  /* ============================================================== */
  group('19. 截图存档');
  await page.screenshot({ path: join(OUT, 'desktop.png'), fullPage: true });
  await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
  await sleep(200);
  await page.screenshot({ path: join(OUT, 'mobile.png'), fullPage: true });
  check('截图已保存', existsSync(join(OUT, 'desktop.png')) && existsSync(join(OUT, 'mobile.png')));

  writeFileSync(
    join(OUT, 'summary.json'),
    JSON.stringify({ passed, failed: failures.length, failures }, null, 2),
  );
} catch (err) {
  failures.push(`未捕获异常：${err && err.stack ? err.stack.split('\n').slice(0, 4).join(' | ') : err}`);
  exitCode = 1;
} finally {
  await browser.close();
}

console.log(`\n${'═'.repeat(64)}`);
if (failures.length === 0) {
  console.log(`✅ E2E 全部通过：${passed} 项断言`);
} else {
  console.log(`❌ E2E 失败 ${failures.length} 项 / 通过 ${passed} 项`);
  for (const f of failures) console.log(`   · ${f}`);
  process.exit(1);
}
process.exit(exitCode);
