/**
 * 可选 AI 链路的端到端验证（不需要真实 API Key）。
 *
 * 做法：
 *   1) 起一个假的 OpenAI 兼容上游（只返回固定 JSON）
 *   2) 用 AI_API_BASE 指向它，启动真正的 AI 服务端（server/ai-dev-server.mjs）
 *   3) 断言：
 *      · Key 缺失时 /api/ai-status 返回 available:false，/api/ai-enhance 返回 503
 *      · Key 存在时返回清洗后的 patch（丢弃 metrics、截断超长、丢弃非白名单字段）
 *      · Key 绝不出现在响应体里
 *
 * 用法：node scripts/ai-adapter-test.mjs
 */
import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { join } from 'node:path';

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

const FAKE_KEY = 'sk-test-DO-NOT-LEAK-1234567890';
const UPSTREAM_PORT = 5211;
const AI_PORT = 5212;
const NOKEY_PORT = 5213;

/** 假上游：故意返回一堆「越界」内容，检验服务端清洗逻辑 */
const upstream = createServer((req, res) => {
  if (req.url?.endsWith('/chat/completions')) {
    let body = '';
    req.on('data', (c) => (body += c));
    req.on('end', () => {
      const auth = req.headers.authorization ?? '';
      if (auth !== `Bearer ${FAKE_KEY}`) {
        res.writeHead(401, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ error: 'bad key' }));
        return;
      }
      const payload = {
        choices: [
          {
            message: {
              content: JSON.stringify({
                name: 'AI 起的名字',
                tagline: 'AI 写的口号，很短',
                solution: 'AI 写的方案'.repeat(200),
                tweet: 'x'.repeat(600),
                founderDread: 'a',
                targetUsers: 'AI 写的目标用户',
                metrics: { tam: '真实数据 100 亿' },
                evil: 'rm -rf /',
              }),
            },
          },
        ],
      };
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify(payload));
    });
    return;
  }
  res.writeHead(404).end();
});

await new Promise((r) => upstream.listen(UPSTREAM_PORT, '127.0.0.1', r));

function startAiServer(port, env) {
  const child = spawn(process.execPath, [join(process.cwd(), 'server', 'ai-dev-server.mjs')], {
    env: { ...process.env, AI_DEV_PORT: String(port), ...env },
    stdio: 'ignore',
    windowsHide: true,
  });
  return child;
}

async function waitReady(url, timeout = 8000) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    try {
      const r = await fetch(url);
      if (r.ok) return true;
    } catch {
      /* retry */
    }
    await new Promise((r) => setTimeout(r, 120));
  }
  return false;
}

const withKey = startAiServer(AI_PORT, {
  AI_API_KEY: FAKE_KEY,
  AI_API_BASE: `http://127.0.0.1:${UPSTREAM_PORT}/v1`,
  AI_MODEL: 'fake-model-v1',
});
const withoutKey = startAiServer(NOKEY_PORT, {
  AI_API_KEY: '',
  AI_API_BASE: `http://127.0.0.1:${UPSTREAM_PORT}/v1`,
});

try {
  console.log('\n── 1. 未配置 Key 的降级行为 ──────────────────────────');
  check('无 Key 服务已启动', await waitReady(`http://127.0.0.1:${NOKEY_PORT}/api/ai-status`));
  const noKeyStatus = await (await fetch(`http://127.0.0.1:${NOKEY_PORT}/api/ai-status`)).json();
  check('无 Key 时 available=false', noKeyStatus.available === false, JSON.stringify(noKeyStatus));
  check('无 Key 时给出原因', typeof noKeyStatus.reason === 'string' && noKeyStatus.reason.length > 4);
  const noKeyEnhance = await fetch(`http://127.0.0.1:${NOKEY_PORT}/api/ai-enhance`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ mode: 'spoof', spice: 'mild', category: 'pet', project: {} }),
  });
  check('无 Key 时增强接口返回 503', noKeyEnhance.status === 503, String(noKeyEnhance.status));

  console.log('\n── 2. 有 Key 时的增强行为 ────────────────────────────');
  check('有 Key 服务已启动', await waitReady(`http://127.0.0.1:${AI_PORT}/api/ai-status`));
  const keyStatusRes = await fetch(`http://127.0.0.1:${AI_PORT}/api/ai-status`);
  const keyStatusText = await keyStatusRes.text();
  const keyStatus = JSON.parse(keyStatusText);
  check('有 Key 时 available=true', keyStatus.available === true, JSON.stringify(keyStatus));
  check('状态接口回报模型名', keyStatus.model === 'fake-model-v1', keyStatus.model);
  check('状态响应不含 Key', !keyStatusText.includes(FAKE_KEY));
  check('状态响应不含 Key 片段', !keyStatusText.includes('DO-NOT-LEAK'));

  const enhanceRes = await fetch(`http://127.0.0.1:${AI_PORT}/api/ai-enhance`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      mode: 'ai',
      spice: 'heavy',
      category: 'aiwork',
      fields: ['name', 'tagline', 'solution', 'tweet', 'founderDread', 'targetUsers'],
      project: { name: '本地名', tagline: '本地口号', targetUsers: 'tu', painPoints: 'pp', wildestHook: 'wh' },
    }),
  });
  const enhanceText = await enhanceRes.text();
  check('增强接口返回 200', enhanceRes.status === 200, String(enhanceRes.status));
  check('增强响应不含 Key', !enhanceText.includes(FAKE_KEY) && !enhanceText.includes('DO-NOT-LEAK'));

  const enhance = JSON.parse(enhanceText);
  check('返回 patch 对象', typeof enhance.patch === 'object' && enhance.patch !== null);
  check('保留合法字段 name', enhance.patch.name === 'AI 起的名字', enhance.patch.name);
  check('保留合法字段 targetUsers', enhance.patch.targetUsers === 'AI 写的目标用户');
  check('丢弃非白名单字段 evil', enhance.patch.evil === undefined);
  check('丢弃 metrics（防止编造真实数据）', enhance.patch.metrics === undefined);
  check('丢弃过短字段 founderDread', enhance.patch.founderDread === undefined, enhance.patch.founderDread);
  check('截断超长 solution 到 520 字内', enhance.patch.solution.length <= 520, String(enhance.patch.solution?.length));
  check('截断超长 tweet 到 280 字内', enhance.patch.tweet.length <= 280, String(enhance.patch.tweet?.length));
  check('回报实际使用的模型', enhance.model === 'fake-model-v1', enhance.model);

  console.log('\n── 3. 上游异常处理 ──────────────────────────────────');
  const badUpstream = startAiServer(5214, {
    AI_API_KEY: 'wrong-key',
    AI_API_BASE: `http://127.0.0.1:${UPSTREAM_PORT}/v1`,
  });
  check('异常服务已启动', await waitReady('http://127.0.0.1:5214/api/ai-status'));
  const badRes = await fetch('http://127.0.0.1:5214/api/ai-enhance', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ mode: 'spoof', spice: 'mild', category: 'pet', project: {} }),
  });
  check('上游 401 时服务端返回 502（前端会静默降级）', badRes.status === 502, String(badRes.status));
  badUpstream.kill();

  console.log('\n── 4. CORS / 方法约束 ───────────────────────────────');
  const opts = await fetch(`http://127.0.0.1:${AI_PORT}/api/ai-status`, { method: 'OPTIONS' });
  check('OPTIONS 预检返回 204', opts.status === 204, String(opts.status));
  check('预检带 CORS 头', opts.headers.get('access-control-allow-origin') === '*');
  const get404 = await fetch(`http://127.0.0.1:${AI_PORT}/api/whatever`);
  check('未知路径返回 404', get404.status === 404, String(get404.status));
} finally {
  withKey.kill();
  withoutKey.kill();
  upstream.close();
}

console.log(`\n${'═'.repeat(60)}`);
if (failures.length === 0) {
  console.log(`✅ AI 适配器链路全部通过：${passed} 项`);
} else {
  console.log(`❌ AI 适配器链路失败 ${failures.length} 项 / 通过 ${passed} 项`);
  for (const f of failures) console.log(`   · ${f}`);
  process.exit(1);
}
