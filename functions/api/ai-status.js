/**
 * Cloudflare Pages Function：GET /api/ai-status
 * 只回报是否配置了 Key，绝不泄露 Key 本身。
 */
export async function onRequestGet(context) {
  const key = context.env.AI_API_KEY;
  const base = context.env.AI_API_BASE || 'https://api.openai.com/v1';
  let provider;
  try {
    provider = new URL(base).host;
  } catch {
    provider = 'unknown';
  }
  return new Response(
    JSON.stringify({
      available: Boolean(key),
      provider: key ? provider : undefined,
      model: key ? context.env.AI_MODEL || 'gpt-4o-mini' : undefined,
      reason: key ? undefined : 'AI_API_KEY 未配置（本地生成本身完整可用）',
    }),
    {
      status: 200,
      headers: {
        'content-type': 'application/json; charset=utf-8',
        'cache-control': 'no-store',
      },
    },
  );
}
