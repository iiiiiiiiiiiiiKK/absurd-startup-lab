/**
 * 启用 GitHub Pages（source = GitHub Actions）并查询部署状态。
 */
const TOKEN = process.env.GH_TOKEN;
const OWNER = 'iiiiiiiiiiiiiKK';
const REPO = 'absurd-startup-lab';

if (!TOKEN) {
  console.error('缺少 GH_TOKEN');
  process.exit(1);
}
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const headers = {
  Authorization: `Bearer ${TOKEN}`,
  Accept: 'application/vnd.github+json',
  'User-Agent': 'absurd-startup-lab-deployer',
  'Content-Type': 'application/json',
};

async function main() {
  // 1) 查询是否已启用
  const get = await fetch(`https://api.github.com/repos/${OWNER}/${REPO}/pages`, { headers });
  if (get.ok) {
    const data = await get.json();
    console.log(`Pages 已启用：${data.html_url} (status=${data.status ?? 'n/a'})`);
    console.log(`build_type=${data.build_type}`);
    return;
  }
  console.log(`Pages 未启用（${get.status}），开始创建...`);

  // 2) 启用（build_type=workflow 表示用 GitHub Actions 部署）
  const res = await fetch(`https://api.github.com/repos/${OWNER}/${REPO}/pages`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ build_type: 'workflow' }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    console.error('启用失败：', res.status, JSON.stringify(body, null, 2));

    // 回退方案：source = branch(gh-pages)
    console.log('\n尝试回退方案：build_type=legacy + branch=main, path=/ ...');
    const res2 = await fetch(`https://api.github.com/repos/${OWNER}/${REPO}/pages`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ source: { branch: 'main', path: '/' } }),
    });
    const body2 = await res2.json().catch(() => ({}));
    if (!res2.ok) {
      console.error('回退也失败：', res2.status, JSON.stringify(body2, null, 2));
      process.exit(1);
    }
    console.log('✅ 回退启用成功：', body2.html_url);
    return;
  }
  console.log('✅ Pages 启用成功');
  console.log(`   URL:    ${body.html_url}`);
  console.log(`   status: ${body.status}`);
  console.log(`   build:  ${body.build_type}`);
}

main().catch((e) => {
  console.error('异常：', e);
  process.exit(1);
});
