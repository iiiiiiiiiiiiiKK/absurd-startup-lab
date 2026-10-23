/**
 * 一键跑完整测试矩阵：
 *   1) 单元 / 引擎自测（Node，无需浏览器）
 *   2) AI 适配器链路（本地假上游，不需要真实 Key）
 *   3) 构建（tsc + vite build）
 *   4) 启动 preview，跑 E2E / 布局审计 / 海报校验
 *   5) 汇总结论写入 TEST-REPORT.md 的数据源 .test-out/summary.json
 *
 * 用法：node scripts/run-all.mjs [--skip-build]
 */
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = process.cwd();
const OUT = join(ROOT, '.test-out');
rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });

const PORT = 4285;
const BASE = `http://127.0.0.1:${PORT}/`;
const skipBuild = process.argv.includes('--skip-build');

/** 运行一个 node 脚本，流式打印并返回 { code, output } */
function run(args, opts = {}) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, args, {
      cwd: ROOT,
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
      env: { ...process.env, ...(opts.env ?? {}) },
    });
    let out = '';
    child.stdout.on('data', (d) => {
      const s = d.toString();
      out += s;
      if (!opts.quiet) process.stdout.write(s);
    });
    child.stderr.on('data', (d) => {
      const s = d.toString();
      out += s;
      if (!opts.quiet) process.stderr.write(s);
    });
    child.on('close', (code) => resolve({ code, output: out }));
  });
}

/** 从输出里解析「通过 N 项 / 失败 M 项」 */
function parseCounts(output) {
  const pass = Number((output.match(/通过[：: ]*(\d+)\s*项/) ?? [])[1] ?? 0);
  const fail = Number((output.match(/失败\s*(\d+)\s*项/) ?? [])[1] ?? 0);
  const okAll = /✅[^\n]*(全部通过|全部通过：|通过：)/.test(output) && fail === 0;
  return { pass, fail, okAll };
}

const results = [];
async function stage(name, args, opts) {
  console.log(`\n${'█'.repeat(64)}\n█ ${name}\n${'█'.repeat(64)}`);
  const started = Date.now();
  const { code, output } = await run(args, opts);
  const counts = parseCounts(output);
  const ok = code === 0;
  results.push({
    name,
    ok,
    code,
    ms: Date.now() - started,
    ...counts,
    tail: output.split(/\r?\n/).filter(Boolean).slice(-6).join('\n'),
  });
  console.log(`\n${ok ? '✅' : '❌'} ${name}（${((Date.now() - started) / 1000).toFixed(1)}s）`);
  return ok;
}

/* ---------------- 1~3 ---------------- */
await stage('单元测试：生成引擎 / 存储 / 导出 / 排版', ['scripts/selftest.mjs']);
await stage('AI 适配器链路测试（假上游，无需真实 Key）', ['scripts/ai-adapter-test.mjs']);

if (!skipBuild) {
  await stage('类型检查 tsc -b', ['node_modules/typescript/bin/tsc', '-b']);
  await stage('生产构建 vite build', ['node_modules/vite/bin/vite.js', 'build']);
}

/* ---------------- 4: 起 preview ---------------- */
console.log(`\n${'█'.repeat(64)}\n█ 启动 preview（${BASE}）\n${'█'.repeat(64)}`);
const preview = spawn(
  process.execPath,
  ['node_modules/vite/bin/vite.js', 'preview', '--port', String(PORT), '--strictPort', '--host', '127.0.0.1'],
  { cwd: ROOT, stdio: 'ignore', windowsHide: true },
);

async function waitServer(url, timeout = 20000) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    try {
      const r = await fetch(url);
      if (r.ok) return true;
    } catch {
      /* retry */
    }
    await new Promise((r) => setTimeout(r, 200));
  }
  return false;
}

const ready = await waitServer(`${BASE}api/ai-status`);
if (!ready) {
  results.push({ name: 'preview 启动', ok: false, code: -1, pass: 0, fail: 1, ms: 0, tail: '无法连接 preview' });
  console.log('❌ preview 未能启动');
} else {
  console.log('✅ preview 已就绪');
  results.push({ name: 'preview 启动', ok: true, code: 0, pass: 1, fail: 0, ms: 0, tail: BASE });

  await stage('E2E：生成 / 锁定 / 字段重生成 / 收藏历史 / 导出 / 海报 / 刷新 / 移动端', ['scripts/e2e.mjs', BASE]);
  await stage('布局审计：7 视口 × 6 模式 × 12 赛道', ['scripts/layout-audit.mjs', BASE]);
  await stage('海报校验：尺寸 / 非空白 / 声明 / 越界自审', ['scripts/poster-check.mjs', BASE]);
}

preview.kill();
try {
  process.kill(preview.pid);
} catch {
  /* already gone */
}

/* ---------------- 汇总 ---------------- */
const totalPass = results.reduce((s, r) => s + r.pass, 0);
const totalFail = results.reduce((s, r) => s + r.fail, 0);
const allOk = results.every((r) => r.ok);

const summary = {
  generatedAt: new Date().toISOString(),
  platform: `${process.platform} ${process.arch}`,
  node: process.version,
  base: BASE,
  totalPass,
  totalFail,
  allOk,
  stages: results,
};
writeFileSync(join(OUT, 'summary.json'), JSON.stringify(summary, null, 2));

console.log(`\n${'═'.repeat(64)}`);
for (const r of results) {
  console.log(`${r.ok ? '✅' : '❌'} ${r.name} — 通过 ${r.pass} / 失败 ${r.fail}（${(r.ms / 1000).toFixed(1)}s）`);
}
console.log(`${'─'.repeat(64)}`);
console.log(
  allOk
    ? `✅ 全部阶段通过：共 ${totalPass} 项断言`
    : `❌ 存在失败阶段：通过 ${totalPass} 项 / 失败 ${totalFail} 项`,
);
console.log(`明细已写入 .test-out/summary.json`);
process.exit(allOk ? 0 : 1);
