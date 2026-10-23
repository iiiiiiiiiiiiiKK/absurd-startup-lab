/**
 * 可选 AI 增强 —— 本地开发服务端（Node 原生，无依赖）。
 *
 * 作用：在没有 Cloudflare 的环境下，也能本地验证「AI 增强」这条可选路径。
 * 用法：
 *   1) 复制 .dev.vars.example 为 .dev.vars，填入 AI_API_KEY
 *   2) npm run ai:dev
 *   3) 另开一个终端：npm run dev（vite 已把 /api 代理到 5199）
 *
 * 安全：
 *   · API Key 只从环境变量读取，绝不下发到前端、绝不写入前端代码。
 *   · 未配置 Key 时，/api/ai-status 返回 available:false，前端静默降级为纯本地生成。
 */

import { createServer } from 'node:http';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const PORT = Number(process.env.AI_DEV_PORT || 5199);

/** 从 .dev.vars 读取（KEY=VALUE 格式，忽略注释） */
function loadDotVars() {
  const file = join(process.cwd(), '.dev.vars');
  if (!existsSync(file)) return;
  for (const line of readFileSync(file, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq < 0) continue;
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, '');
    if (key && process.env[key] === undefined) process.env[key] = value;
  }
}
loadDotVars();

const API_KEY = process.env.AI_API_KEY || '';
const API_BASE = process.env.AI_API_BASE || 'https://api.openai.com/v1';
const API_MODEL = process.env.AI_MODEL || 'gpt-4o-mini';

const MODE_HINT = {
  spoof: '纯属恶搞：荒诞但逻辑完整，认真推导一个荒谬的前提',
  corporate: '一本正经地胡说八道：大量商业术语，PPT 语气',
  indie: '低成本独立开发：一个人一个周末能做完的范围，克制具体',
  ai: 'AI 创业：围绕模型能力做自动化流水线，讲清楚人机分工',
  netculture: '互联网文化：网络梗、社交货币、可截图传播',
  serious: '认真创业：创意可以荒诞，但方案必须现实可行、成本清楚',
};

const SPICE_HINT = {
  mild: '轻度：稍微离谱，但听起来可能可行',
  heavy: '重度：明显离谱，但推导自洽',
  extreme: '极限：彻底放飞，荒诞到怀疑人生',
};

const FIELD_RULES = `
你必须只返回一个 JSON 对象，键只能是以下字段名（可只返回部分）：
name, tagline, targetUsers, painPoints, solution, pricing, acquisition, wildestHook, tweet, founderDread

硬性要求：
1. 全部使用简体中文，语气自然，禁止空话套话堆砌。
2. 不得编造真实公司、真实人物、真实融资新闻。
3. 不得输出用户规模、收入、融资额等数字；如确需数字，必须写成「假设」并说明是模拟。
4. tweet 不超过 280 字符，包含 1-3 个话题标签，可直接发布到 X。
5. name 不超过 14 个汉字（可含引号），tagline 不超过 40 字。
6. 每条字段单独成句成段，不要用 Markdown 语法。
`.trim();

function buildPrompt(payload) {
  const fieldList = Array.isArray(payload.fields) ? payload.fields.join(', ') : 'all';
  return [
    '你是一个中文创意文案写手，为一个「离谱创业模拟器」写作。',
    '',
    `生成模式：${MODE_HINT[payload.mode] || payload.mode}`,
    `荒诞程度：${SPICE_HINT[payload.spice] || payload.spice}`,
    `赛道类别：${payload.category}`,
    '',
    '当前项目的本地版本（请在此基础上改写，保持同一件事，不要换项目）：',
    `名称：${payload.project?.name ?? ''}`,
    `口号：${payload.project?.tagline ?? ''}`,
    `目标用户：${payload.project?.targetUsers ?? ''}`,
    `痛点：${payload.project?.painPoints ?? ''}`,
    `卖点：${payload.project?.wildestHook ?? ''}`,
    '',
    `需要产出的字段：${fieldList}`,
    '',
    FIELD_RULES,
  ].join('\n');
}

function json(res, status, body) {
  const data = JSON.stringify(body);
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'access-control-allow-origin': '*',
    'cache-control': 'no-store',
  });
  res.end(data);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', (c) => {
      size += c.length;
      if (size > 256 * 1024) {
        reject(new Error('body too large'));
        req.destroy();
        return;
      }
      chunks.push(c);
    });
    req.on('end', () => {
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}'));
      } catch {
        resolve({});
      }
    });
    req.on('error', reject);
  });
}

const ALLOWED_FIELDS = new Set([
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
]);

/** 与前端/Pages Function 保持一致的字段长度上限，防止超长内容撑破排版 */
const LIMITS = {
  name: 24,
  tagline: 60,
  targetUsers: 320,
  painPoints: 320,
  solution: 520,
  pricing: 260,
  acquisition: 260,
  wildestHook: 260,
  tweet: 280,
  founderDread: 160,
};

const server = createServer(async (req, res) => {
  const url = new URL(req.url || '/', `http://127.0.0.1:${PORT}`);

  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'access-control-allow-origin': '*',
      'access-control-allow-methods': 'GET,POST,OPTIONS',
      'access-control-allow-headers': 'content-type',
    });
    res.end();
    return;
  }

  if (url.pathname === '/api/ai-status') {
    json(res, 200, {
      available: Boolean(API_KEY),
      provider: API_KEY ? new URL(API_BASE).host : undefined,
      model: API_KEY ? API_MODEL : undefined,
      reason: API_KEY ? undefined : 'AI_API_KEY 未配置（本地生成本身完整可用）',
    });
    return;
  }

  if (url.pathname === '/api/ai-enhance' && req.method === 'POST') {
    if (!API_KEY) {
      json(res, 503, { error: 'AI 未启用' });
      return;
    }
    const payload = await readBody(req);
    try {
      const upstream = await fetch(`${API_BASE.replace(/\/$/, '')}/chat/completions`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${API_KEY}`,
        },
        body: JSON.stringify({
          model: API_MODEL,
          temperature: 0.95,
          response_format: { type: 'json_object' },
          messages: [
            { role: 'system', content: FIELD_RULES },
            { role: 'user', content: buildPrompt(payload) },
          ],
        }),
        signal: AbortSignal.timeout(20000),
      });

      if (!upstream.ok) {
        json(res, 502, { error: `upstream ${upstream.status}` });
        return;
      }

      const data = await upstream.json();
      const content = data?.choices?.[0]?.message?.content ?? '{}';
      let patch = {};
      try {
        patch = JSON.parse(content);
      } catch {
        patch = {};
      }
      const clean = {};
      for (const [k, v] of Object.entries(patch)) {
        if (!ALLOWED_FIELDS.has(k) || typeof v !== 'string') continue;
        const trimmed = v.trim();
        if (trimmed.length < 2) continue;
        clean[k] = trimmed.slice(0, LIMITS[k] ?? 280);
      }
      json(res, 200, { patch: clean, model: API_MODEL });
    } catch (err) {
      json(res, 502, { error: err instanceof Error ? err.message : 'upstream error' });
    }
    return;
  }

  json(res, 404, { error: 'not found' });
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`[ai-dev-server] http://127.0.0.1:${PORT}`);
  console.log(`[ai-dev-server] Key 状态：${API_KEY ? '已配置（仅服务端可见）' : '未配置 → 前端将自动降级为纯本地生成'}`);
  if (API_KEY) console.log(`[ai-dev-server] 模型：${API_MODEL} @ ${API_BASE}`);
});
