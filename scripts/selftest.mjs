/**
 * 生成引擎 / 存储 / 导出 自测（不依赖浏览器）。
 * 用 esbuild 把 src/lib/testable.ts 打包成临时 ESM，再在 Node 里断言。
 *
 * 运行：npm test
 */
import { build } from 'esbuild';
import { mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const tmp = join(process.cwd(), '.selftest-tmp');
rmSync(tmp, { recursive: true, force: true });
mkdirSync(tmp, { recursive: true });
const outfile = join(tmp, 'bundle.mjs');

await build({
  entryPoints: ['src/lib/testable.ts'],
  bundle: true,
  format: 'esm',
  platform: 'neutral',
  target: 'es2020',
  outfile,
  logLevel: 'error',
});

const M = await import(pathToFileURL(outfile).href);

let passed = 0;
const failures = [];
let currentGroup = '';

function group(name) {
  currentGroup = name;
  console.log(`\n── ${name} ${'─'.repeat(Math.max(0, 58 - name.length))}`);
}

function check(name, cond, detail) {
  if (cond) {
    passed += 1;
    console.log(`  ✅ ${name}`);
  } else {
    failures.push(`[${currentGroup}] ${name}${detail ? ` — ${detail}` : ''}`);
    console.log(`  ❌ ${name}${detail ? ` — ${detail}` : ''}`);
  }
}

function eq(name, actual, expected) {
  check(name, Object.is(actual, expected), `期望 ${JSON.stringify(expected)}，实际 ${JSON.stringify(actual)}`);
}

const REQUIRED_TEXT_FIELDS = [
  'name',
  'tagline',
  'targetUsers',
  'painPoints',
  'solution',
  'pricing',
  'acquisition',
  'wildestHook',
  'tweet',
  'founderDread',
];

function assertComplete(p, label) {
  for (const f of REQUIRED_TEXT_FIELDS) {
    check(`${label} · ${f} 非空`, typeof p[f] === 'string' && p[f].trim().length > 3, `得到 ${JSON.stringify(p[f])}`);
  }
  check(`${label} · features 至少 3 条`, Array.isArray(p.features) && p.features.length >= 3, `${p.features?.length}`);
  check(
    `${label} · investorQuestions 至少 2 条`,
    Array.isArray(p.investorQuestions) && p.investorQuestions.length >= 2,
    `${p.investorQuestions?.length}`,
  );
  check(`${label} · ID 合法`, M.isProjectId(p.id), p.id);
  check(
    `${label} · 模拟数据声明存在`,
    typeof p.metrics?.assumption === 'string' && p.metrics.assumption.includes('模拟假设'),
    p.metrics?.assumption,
  );
  check(
    `${label} · 全部数字标注为假设`,
    ['tam', 'users', 'revenue', 'funding'].every((k) => p.metrics[k].includes('假设')),
  );
}

/* ================================================================== *
 * 1. 素材库完整性
 * ================================================================== */
group('1. 素材库完整性');
{
  eq('赛道数量为 12', M.CATEGORIES.length, 12);
  for (const c of M.CATEGORIES) {
    check(
      `赛道「${c.label}」素材充足`,
      c.audiences.length >= 4 &&
        c.pains.length >= 4 &&
        c.mechanics.length >= 4 &&
        c.features.length >= 4 &&
        c.pricing.length >= 2 &&
        c.channels.length >= 3 &&
        c.wilds.length >= 3 &&
        c.investorQuestions.length >= 2 &&
        c.dreadQuestions.length >= 2 &&
        c.taglines.length >= 3,
      `aud=${c.audiences.length} pain=${c.pains.length} mech=${c.mechanics.length}`,
    );
    check(
      `赛道「${c.label}」语义标签齐全`,
      c.audiences.every((a) => a.tags.length > 0) &&
        c.pains.every((p) => p.tags.length > 0) &&
        c.mechanics.every((m) => m.tags.length > 0),
    );
    check(
      `赛道「${c.label}」名称素材齐全`,
      c.names.cores.length >= 4 && c.names.suffixes.length >= 4,
    );
  }
  eq('生成模式数量为 6', M.MODE_LIST.length, 6);
  eq('荒诞档位为 3', M.SPICE_LIST.length, 3);
  const stats = M.materialStats();
  const totalCombos = stats.reduce((s, c) => s + c.combos, 0);
  check('素材组合数 > 800', totalCombos > 800, `实际 ${totalCombos}`);
}

/* ================================================================== *
 * 2. 无 Key 可生成 + 字段完整
 * ================================================================== */
group('2. 无 Key 生成（默认路径）');
{
  const { project } = M.generateProject({ mode: 'spoof', spice: 'heavy', category: 'random', seed: 12345 });
  assertComplete(project, '恶搞/重度');
  check('结果包含 12 个字段键', M.FIELD_KEYS.length === 12);
}

/* ================================================================== *
 * 3. 六种模式差异明显
 * ================================================================== */
group('3. 六种模式差异明显');
{
  const seen = new Map();
  for (const mode of M.MODE_LIST) {
    const { project } = M.generateProject({ mode: mode.id, spice: 'heavy', category: 'productivity', seed: 987654 });
    const text = [project.solution, project.pricing, project.acquisition, project.targetUsers].join('\n');
    for (const sig of mode.signature) {
      check(`模式「${mode.label}」含签名词「${sig}」`, text.includes(sig), text.slice(0, 80));
    }
    seen.set(mode.id, text);
  }
  const unique = new Set([...seen.values()]);
  eq('六种模式 solution 文本互不相同', unique.size, 6);

  // 同一 seed 下不同模式的名称也应不同（名称前缀/后缀来自模式）
  const names = new Set();
  for (const mode of M.MODE_LIST) {
    const { project } = M.generateProject({ mode: mode.id, spice: 'light' === 'light' ? 'mild' : 'mild', category: 'money', seed: 4242 });
    names.add(project.name);
  }
  check('不同模式名称有差异', names.size >= 3, `唯一名称 ${names.size}`);
}

/* ================================================================== *
 * 4. 荒诞程度影响结果
 * ================================================================== */
group('4. 荒诞程度影响结果');
{
  const mild = M.generateProject({ mode: 'corporate', spice: 'mild', category: 'workplace', seed: 777 }).project;
  const extreme = M.generateProject({ mode: 'corporate', spice: 'extreme', category: 'workplace', seed: 777 }).project;
  check('轻度与极限的定价不同', mild.pricing !== extreme.pricing, `${mild.pricing} vs ${extreme.pricing}`);
  const mildPrice = Number((mild.pricing.match(/¥(\d+)/) || [])[1]);
  const extremePrice = Number((extreme.pricing.match(/¥(\d+)/) || [])[1]);
  check('极限档价格更高', extremePrice > mildPrice, `${mildPrice} → ${extremePrice}`);
  check('荒诞标签不同', mild.tags.join() !== extreme.tags.join());
}

/* ================================================================== *
 * 5. 语义兼容规则
 * ================================================================== */
group('5. 语义兼容（人群→痛点→机制 链路）');
{
  let checked = 0;
  let broken = 0;
  for (const cat of M.CATEGORIES) {
    for (let i = 0; i < 40; i += 1) {
      const p = M.buildProject({
        seed: i * 7919 + 13,
        now: 1_700_000_000_000,
        mode: 'serious',
        spice: 'mild',
        category: cat.id,
        existingIds: [],
        locked: {},
        revision: 1,
      });
      const audience = cat.audiences[p.slots.audience];
      const pain = cat.pains[p.slots.pain];
      const mech = cat.mechanics[p.slots.mechanic];
      const okA = audience.tags.some((t) => pain.tags.includes(t));
      const okB = pain.tags.some((t) => mech.tags.includes(t));
      checked += 1;
      if (!okA || !okB) broken += 1;
    }
  }
  eq(`语义链路全部成立（${checked} 次抽样）`, broken, 0);

  // 具体验证：痛点描述里必须出现该痛点的原句片段
  for (const cat of M.CATEGORIES) {
    const p = M.buildProject({
      seed: 2024,
      now: 1,
      mode: 'spoof',
      spice: 'heavy',
      category: cat.id,
      existingIds: [],
      locked: {},
      revision: 1,
    });
    const pain = cat.pains[p.slots.pain];
    check(`「${cat.label}」痛点文本与槽位一致`, p.painPoints.includes(pain.label));
    const mech = cat.mechanics[p.slots.mechanic];
    check(`「${cat.label}」方案文本含机制描述`, p.solution.includes(mech.action.slice(0, 12)));
  }
}

/* ================================================================== *
 * 6. 去重（避免短时间重复）
 * ================================================================== */
group('6. 短期去重');
{
  const recent = [];
  const seenSigs = new Set();
  let dup = 0;
  for (let i = 0; i < 60; i += 1) {
    const { project } = M.generateProject({
      mode: M.MODE_LIST[i % 6].id,
      spice: M.SPICE_LIST[i % 3].id,
      category: 'random',
      recentSignatures: recent,
      existingIds: [],
    });
    const sig = M.signatureOf(project);
    if (seenSigs.has(sig)) dup += 1;
    seenSigs.add(sig);
    recent.push(sig);
    if (recent.length > 40) recent.shift();
  }
  check('连续 60 次生成无重复签名', dup === 0, `重复 ${dup}`);

  // 强行喂满 40 条近期签名，仍应产出新内容
  const fake = [];
  for (let i = 0; i < 200; i += 1) fake.push(`x${i}`);
  const forced = M.generateProject({
    mode: 'indie',
    spice: 'mild',
    category: 'pet',
    recentSignatures: fake,
    seed: 5,
  });
  check('近期签名塞满时仍能返回结果', !!forced.project && M.isProjectId(forced.project.id));
}

/* ================================================================== *
 * 7. 固定 ID 与可恢复
 * ================================================================== */
group('7. 固定 ID / 可恢复');
{
  const a = M.generateProject({ mode: 'ai', spice: 'heavy', category: 'aiwork', seed: 999 }).project;
  const b = M.generateProject({ mode: 'ai', spice: 'heavy', category: 'aiwork', seed: 999 }).project;
  eq('同 seed 同配置 → 内容完全一致（可复现）', JSON.stringify({ ...a, id: '' }), JSON.stringify({ ...b, id: '' }));

  const regenerated = M.regenerateAll(a, {});
  eq('重生成保留 ID', regenerated.project.id, a.id);
  eq('重生成 revision +1', regenerated.project.revision, a.revision + 1);
  check('重生成内容不同', regenerated.project.solution !== a.solution || regenerated.project.name !== a.name);

  const ids = new Set();
  for (let i = 0; i < 500; i += 1) {
    ids.add(M.generateProject({ mode: 'spoof', spice: 'mild', category: 'random' }).project.id);
  }
  eq('500 次生成 ID 无碰撞', ids.size, 500);
  check('ID 格式合规', [...ids].every((id) => /^ASL-[A-Z2-9]{4}-[A-Z2-9]{4}$/.test(id)));
}

/* ================================================================== *
 * 8. 单字段重生成
 * ================================================================== */
group('8. 单字段重生成 / 锁定');
{
  const base = M.generateProject({ mode: 'corporate', spice: 'heavy', category: 'workplace', seed: 31337 }).project;
  const fields = ['name', 'tagline', 'targetUsers', 'painPoints', 'solution', 'features', 'pricing', 'acquisition', 'wildestHook', 'tweet', 'investorQuestions', 'founderDread'];
  for (const field of fields) {
    const next = M.regenerateField(base, field);
    eq(`字段 ${field} 保留 ID`, next.id, base.id);
    eq(`字段 ${field} revision 递增`, next.revision, base.revision + 1);
    check(`字段 ${field} 内容改变`, JSON.stringify(next[field]) !== JSON.stringify(base[field]));
    const others = fields.filter((f) => f !== field && f !== 'tweet');
    const same = others.every((f) => JSON.stringify(next[f]) === JSON.stringify(base[f]));
    check(`字段 ${field} 未影响其它字段`, same);
  }

  // 锁定名称：生成时保留名称
  const lockedGen = M.generateProject({
    mode: 'spoof',
    spice: 'extreme',
    category: 'money',
    locked: { name: '「明天再做」', tagline: '帮拖延症把未完成事项自动延期' },
  }).project;
  eq('锁定后名称不变', lockedGen.name, '「明天再做」');
  eq('锁定后口号不变', lockedGen.tagline, '帮拖延症把未完成事项自动延期');
  check('锁定不会阻止其它字段生成', lockedGen.solution.length > 10);

  // 锁定 + 整体重生成
  const lockedAll = M.regenerateAll(base, { locked: { name: base.name }, mode: 'indie', spice: 'mild' });
  eq('整体重生成时锁定名称生效', lockedAll.project.name, base.name);
  check('整体重生成时其它字段变化', lockedAll.project.pricing !== base.pricing);

  // 名称变更后 tweet 必须同步
  const renamed = M.regenerateField(base, 'name');
  check('名称变更后 X 文案同步更新', renamed.tweet !== base.tweet);
}

/* ================================================================== *
 * 9. 存储：收藏 / 排序 / 裁剪 / 容错
 * ================================================================== */
group('9. 本地存储');
{
  let store = M.emptyStore();
  eq('初始历史为空', store.projects.length, 0);

  const p1 = M.generateProject({ mode: 'spoof', spice: 'mild', category: 'food' in {} ? 'kitchen' : 'kitchen' }).project;
  const p2 = M.generateProject({ mode: 'ai', spice: 'heavy', category: 'aiwork' }).project;

  store.projects = M.upsertProject(store.projects, p1);
  store.projects = M.upsertProject(store.projects, p2);
  eq('插入两条历史', store.projects.length, 2);

  store.projects = M.toggleFavorite(store.projects, p1.id);
  check('收藏生效', store.projects.find((p) => p.id === p1.id).favorite === true);

  store.projects = M.upsertProject(store.projects, { ...p1, tagline: '改过的口号' });
  eq('同 ID 更新不重复插入', store.projects.length, 2);
  eq('更新后口号已变', store.projects.find((p) => p.id === p1.id).tagline, '改过的口号');
  check('更新后仍保留收藏状态', store.projects.find((p) => p.id === p1.id).favorite === true);

  store.projects = M.removeProject(store.projects, p2.id);
  eq('删除生效', store.projects.length, 1);

  // 裁剪：收藏永不丢
  const many = [];
  for (let i = 0; i < 200; i += 1) {
    many.push({ ...p2, id: `ASL-TEST-${String(i).padStart(4, '0')}`, favorite: i === 3, savedAt: 1000 + i });
  }
  const pruned = M.pruneProjects(many, M.MAX_HISTORY);
  eq('裁剪到上限', pruned.length, M.MAX_HISTORY);
  check('裁剪保留收藏项', pruned.some((p) => p.id === 'ASL-TEST-0003'));

  // 脏数据容错
  eq('脏数据 → null', M.sanitizeProject({ id: 'bad' }), null);
  const dirty = M.sanitizeStore({
    version: 99,
    projects: [p1, { id: 'broken' }, null, 'x', p1],
    settings: { mode: 'nope', spice: 'extreme', category: 'nope' },
    currentId: 'missing',
    recentSignatures: [1, 'a', null],
  });
  eq('脏数据被过滤后只剩合法项', dirty.projects.length, 1);
  eq('非法模式回落到默认', dirty.settings.mode, 'spoof');
  eq('非法类别回落到随机', dirty.settings.category, 'random');
  eq('不存在的 currentId 被清空', dirty.currentId, null);
  eq('签名过滤非字符串', dirty.recentSignatures.length, 1);

  eq('签名去重并追加', M.pushSignature(['a', 'b'], 'a').join(','), 'b,a');
  const sigs = [];
  for (let i = 0; i < 60; i += 1) sigs.push(`s${i}`);
  eq('签名列表被截断为 40', M.pushSignature(sigs, 'last').length, 40);
}

/* ================================================================== *
 * 10. 导出：Markdown / JSON / 纯文本 / X 文案
 * ================================================================== */
group('10. 导出与分享');
{
  const p = M.generateProject({ mode: 'netculture', spice: 'extreme', category: 'creator', seed: 512 }).project;
  const md = M.toMarkdown(p);
  for (const heading of ['目标用户', '用户痛点', '产品解决方案', '核心功能', '收费模式', '获客方式', '最离谱的卖点', '首条 X 推广文案', '投资人可能提出的问题', '创始人最不愿回答的问题', '模拟数据声明']) {
    check(`Markdown 含「${heading}」段`, md.includes(`## ${heading}`) || md.includes(heading));
  }
  check('Markdown 含固定 ID', md.includes(p.id));
  check('Markdown 含模拟声明', md.includes('模拟假设'));
  check('Markdown 无 undefined', !md.includes('undefined'));

  const json = M.toJson(p);
  const parsed = JSON.parse(json);
  eq('JSON 可解析', typeof parsed, 'object');
  eq('JSON id 一致', parsed.id, p.id);
  eq('JSON schema 标注', parsed.schema, 'absurd-startup-lab/project@1');
  check('JSON 含免责声明', typeof parsed.disclaimer === 'string' && parsed.disclaimer.includes('虚构'));
  check('JSON 含 12 个字段', ['name', 'tagline', 'targetUsers', 'painPoints', 'solution', 'features', 'pricing', 'acquisition', 'wildestHook', 'tweet', 'investorQuestions', 'founderDread'].every((k) => k in parsed));

  const txt = M.toPlainText(p);
  check('纯文本无 Markdown 标记', !txt.includes('##') && !txt.includes('**') && !txt.includes('```'));
  check('纯文本保留正文', txt.includes(p.name));

  const angles = M.buildPromoAngles(p);
  eq('生成 5 条推广角度', angles.length, 5);
  check(
    '每条角度 ≤ 280 字符',
    angles.every((a) => a.text.length <= 280),
    angles.map((a) => a.text.length).join(','),
  );
  check('每条角度非空且带话题', angles.every((a) => a.text.length > 20 && a.text.includes('#')));

  const fn = M.safeFilename(p, 'md');
  check('文件名合法（无非法字符）', !/[\\/:*?"<>|]/.test(fn), fn);
}

/* ================================================================== *
 * 11. 海报文本排版（不溢出）
 * ================================================================== */
group('11. 海报排版算法');
{
  // 用等宽近似测量（中文 1em，ASCII 0.55em）模拟 canvas
  const makeCtx = (size) => ({
    font: `${size}px sans`,
    measureText(t) {
      let w = 0;
      for (const ch of Array.from(t)) w += /[\u4e00-\u9fff\uff00-\uffef]/.test(ch) ? size : size * 0.55;
      return { width: w };
    },
  });

  const ctx = makeCtx(27);
  const long = '这是一段非常非常长的中文文本'.repeat(20);
  const lines = M.wrapText(ctx, long, 900);
  check('wrapText 每行不超宽', lines.every((l) => ctx.measureText(l).width <= 900 + 0.001), `最长 ${Math.max(...lines.map((l) => ctx.measureText(l).width)).toFixed(1)}`);
  check('wrapText 保留全部字符', lines.join('') === long);

  const fitted = M.fitText(ctx, long, 900, 3);
  eq('fitText 限制行数', fitted.length, 3);
  check('fitText 末行带省略号', fitted[fitted.length - 1].endsWith('…'));
  check('fitText 末行仍不超宽', ctx.measureText(fitted[fitted.length - 1]).width <= 900 + 0.001);

  const short = M.fitText(ctx, '短文本', 900, 3);
  check('短文本不省略', short.length === 1 && !short[0].endsWith('…'));

  eq('两种海报尺寸', Object.keys(M.POSTER_SIZES).join(','), 'portrait,wide');
  eq('竖版 1080×1440', `${M.POSTER_SIZES.portrait.width}x${M.POSTER_SIZES.portrait.height}`, '1080x1440');
  eq('横版 1200×675', `${M.POSTER_SIZES.wide.width}x${M.POSTER_SIZES.wide.height}`, '1200x675');

  // 极端长内容也不应产生空行或超宽
  const p = M.generateProject({ mode: 'spoof', spice: 'extreme', category: 'mystic', seed: 88 }).project;
  const brutal = { ...p, name: '「一个名字特别特别长的项目」'.repeat(10), tagline: '口号也特别长'.repeat(8) };
  const nameLines = M.fitText(ctx, brutal.name, 900, 2);
  eq('超长名称被限制为 2 行', nameLines.length, 2);
  check('超长名称末行省略号', nameLines[1].endsWith('…'));
  check('超长名称每行不超宽', nameLines.every((l) => ctx.measureText(l).width <= 900 + 0.001));
}

/* ================================================================== *
 * 12. AI 适配器：无服务端时静默降级 + 输出校验
 * ================================================================== */
group('12. AI 适配器');
{
  const p = M.generateProject({ mode: 'serious', spice: 'mild', category: 'learning', seed: 66 }).project;

  const failingFetch = async () => {
    throw new Error('network down');
  };
  const nullResult = await M.enhanceProject(p, M.AI_FIELDS, failingFetch);
  eq('网络异常时返回 null（不影响本地生成）', nullResult, null);

  const notOk = async () => ({ ok: false, status: 501, json: async () => ({}) });
  eq('服务端 501 时返回 null', await M.enhanceProject(p, M.AI_FIELDS, notOk), null);

  const badPayload = async () => ({
    ok: true,
    status: 200,
    json: async () => ({
      patch: { name: 'AI 名字', tagline: '', solution: 42, founderDread: 'a', tweet: 'x'.repeat(999) },
      model: 'test-model',
    }),
  });
  const res = await M.enhanceProject(p, M.AI_FIELDS, badPayload);
  check('非法字段被丢弃', res && res.patch.solution === undefined && res.patch.founderDread === undefined);
  check('合法字段被保留', res && res.patch.name === 'AI 名字');
  check('超长字段被截断', res && res.patch.tweet.length <= 280);

  const sanitized = M.sanitizePatch({ metrics: { tam: '9999' }, name: 'AI 名称', targetUsers: 'AI 用户' });
  check('sanitizePatch 不允许覆盖 metrics', sanitized.metrics === undefined);
  eq('sanitizePatch 保留合法键数量', Object.keys(sanitized).length, 2);

  const patched = M.applyPatch(p, { name: 'AI 名字' });
  eq('applyPatch 保留 ID', patched.id, p.id);
  eq('applyPatch 保留模拟声明', patched.metrics.assumption, p.metrics.assumption);
  check('applyPatch 标记 aiEnhanced', patched.aiEnhanced === true);
  eq('applyPatch 未传字段保持原样', patched.solution, p.solution);

  const statusDown = await M.fetchAiStatus(failingFetch);
  eq('AI 状态探测失败时 available=false', statusDown.available, false);
}

/* ================================================================== *
 * 13. 空值与健壮性
 * ================================================================== */
group('13. 健壮性');
{
  check('未知类别抛错', (() => {
    try {
      M.getCategory('nope');
      return false;
    } catch {
      return true;
    }
  })());
  eq('isCategoryId 校验', M.isCategoryId('pet'), true);
  eq('isCategoryId 拒绝非法值', M.isCategoryId('nope'), false);
  eq('isProjectId 拒绝小写', M.isProjectId('asl-abcd-efgh'), false);

  // 生成 200 次，确保没有异常 / undefined / [object Object]
  let bad = 0;
  for (let i = 0; i < 200; i += 1) {
    const { project } = M.generateProject({
      mode: M.MODE_LIST[i % 6].id,
      spice: M.SPICE_LIST[i % 3].id,
      category: 'random',
    });
    const blob = JSON.stringify(project);
    if (blob.includes('undefined') || blob.includes('[object Object]') || blob.includes('NaN')) {
      bad += 1;
    }
  }
  eq('200 次随机生成无脏字符串', bad, 0);

  // 占位符必须全部被替换
  let placeholder = 0;
  for (let i = 0; i < 200; i += 1) {
    const { project } = M.generateProject({ mode: M.MODE_LIST[i % 6].id, spice: 'heavy', category: 'random' });
    const blob = JSON.stringify(project);
    if (/\{[a-zA-Z]+\}/.test(blob)) placeholder += 1;
  }
  eq('模板占位符全部替换', placeholder, 0);
}

/* ================================================================== *
 * 汇总
 * ================================================================== */
rmSync(tmp, { recursive: true, force: true });

console.log(`\n${'═'.repeat(64)}`);
if (failures.length === 0) {
  console.log(`✅ 全部通过：${passed} 项断言`);
  process.exit(0);
} else {
  console.log(`❌ 失败 ${failures.length} 项 / 通过 ${passed} 项`);
  for (const f of failures) console.log(`   · ${f}`);
  process.exit(1);
}
