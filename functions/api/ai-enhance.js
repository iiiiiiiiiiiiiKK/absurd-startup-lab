/**
 * Cloudflare Pages Function：POST /api/ai-enhance
 *
 * 安全约束（重要）：
 *  · Key 只来自环境变量 context.env.AI_API_KEY，不出现在任何前端产物里。
 *  · 白名单字段 + 长度截断，防止模型输出污染 metrics（模拟数据声明）。
 *  · 未配置 Key 时直接 503，前端静默降级。
 */

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

const FIELD_RULES = `你必须只返回一个 JSON 对象，键只能是以下字段名（可只返回部分）：
name, tagline, targetUsers, painPoints, solution, pricing, acquisition, wildestHook, tweet, founderDread

硬性要求：
1. 全部使用简体中文，语气自然。
2. 不得编造真实公司、真实人物、真实融资新闻。
3. 不得输出用户规模、收入、融资额等数字；如确需数字，必须写明「假设」并说明是模拟。
4. tweet 不超过 280 字符，含 1-3 个话题标签，可直接发布到 X。
5. name 不超过 14 个汉字，tagline 不超过 40 字。
6. 不要使用 Markdown 语法。`;

function json(status, body) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
    },
  });
}

export async function onRequestPost(context) {
  const { request, env } = context;
  const key = env.AI_API_KEY;
  if (!key) return json(503, { error: 'AI 未启用' });

  let payload;
  try {
    payload = await request.json();
  } catch {
    return json(400, { error: 'invalid json' });
  }
  if (!payload || typeof payload !== 'object') return json(400, { error: 'invalid payload' });

  const base = (env.AI_API_BASE || 'https://api.openai.com/v1').replace(/\/$/, '');
  const model = env.AI_MODEL || 'gpt-4o-mini';
  const fields = Array.isArray(payload.fields) ? payload.fields.filter((f) => ALLOWED_FIELDS.has(f)) : [];

  const userPrompt = [
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
    `需要产出的字段：${fields.length ? fields.join(', ') : 'all'}`,
  ].join('\n');

  let upstream;
  try {
    upstream = await fetch(`${base}/chat/completions`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        model,
        temperature: 0.95,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: FIELD_RULES },
          { role: 'user', content: userPrompt },
        ],
      }),
    });
  } catch (err) {
    return json(502, { error: err?.message || 'upstream fetch failed' });
  }

  if (!upstream.ok) return json(502, { error: `upstream ${upstream.status}` });

  let data;
  try {
    data = await upstream.json();
  } catch {
    return json(502, { error: 'upstream invalid json' });
  }

  let patch = {};
  try {
    patch = JSON.parse(data?.choices?.[0]?.message?.content ?? '{}');
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

  return json(200, { patch: clean, model });
}

export async function onRequest(context) {
  if (context.request.method === 'POST') return onRequestPost(context);
  return json(405, { error: 'method not allowed' });
}
