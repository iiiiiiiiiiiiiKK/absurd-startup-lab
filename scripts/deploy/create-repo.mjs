/**
 * 创建 GitHub 仓库（公开）。
 * 用 Node 原生 fetch，避免 PowerShell 的编码 / 引号问题。
 */
const TOKEN = process.env.GH_TOKEN;
const OWNER = 'iiiiiiiiiiiiiKK';
const REPO = 'absurd-startup-lab';

if (!TOKEN) {
  console.error('缺少 GH_TOKEN');
  process.exit(1);
}

// 允许自签名证书环境（本机 TLS 链不完整）
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const headers = {
  Authorization: `Bearer ${TOKEN}`,
  Accept: 'application/vnd.github+json',
  'User-Agent': 'absurd-startup-lab-deployer',
  'Content-Type': 'application/json',
};

async function main() {
  // 1) 检查是否已存在
  const check = await fetch(`https://api.github.com/repos/${OWNER}/${REPO}`, { headers });
  if (check.ok) {
    const data = await check.json();
    console.log(`已存在：${data.full_name} (private=${data.private})`);
    return;
  }
  console.log(`仓库不存在（${check.status}），开始创建...`);

  // 2) 创建
  const res = await fetch('https://api.github.com/user/repos', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      name: REPO,
      description:
        '离谱创业模拟器 — 下一个改变世界的项目，可能很荒唐。7200+ 组合的荒诞创业提案生成器，无需 API Key，可导出海报 / Markdown / JSON。',
      homepage: `https://${OWNER}.github.io/${REPO}/`,
      private: false,
      has_issues: true,
      has_wiki: false,
      has_projects: false,
      auto_init: false,
    }),
  });

  const body = await res.json();
  if (!res.ok) {
    console.error('创建失败：', res.status, JSON.stringify(body, null, 2));
    process.exit(1);
  }
  console.log(`✅ 创建成功：${body.full_name}`);
  console.log(`   HTML:  ${body.html_url}`);
  console.log(`   Clone: ${body.clone_url}`);

  // 3) 设置 topics
  const topicsRes = await fetch(`https://api.github.com/repos/${OWNER}/${REPO}/topics`, {
    method: 'PUT',
    headers: { ...headers, Accept: 'application/vnd.github.mercy-preview+json' },
    body: JSON.stringify({
      names: [
        'react',
        'typescript',
        'vite',
        'generator',
        'creative-tool',
        'chinese',
        'fun',
        'startup',
        'canvas',
        'poster',
        'no-api-key',
        'local-first',
      ],
    }),
  });
  console.log(`topics: ${topicsRes.status}`);
}

main().catch((e) => {
  console.error('异常：', e);
  process.exit(1);
});
