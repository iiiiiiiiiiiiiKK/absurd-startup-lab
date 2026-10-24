/**
 * 查询 Pages 配置 & 最近的工作流运行状态。
 */
const TOKEN = process.env.GH_TOKEN;
const OWNER = 'iiiiiiiiiiiiiKK';
const REPO = 'absurd-startup-lab';
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const headers = {
  Authorization: `Bearer ${TOKEN}`,
  Accept: 'application/vnd.github+json',
  'User-Agent': 'absurd-startup-lab-deployer',
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  // Pages 配置
  const pages = await fetch(`https://api.github.com/repos/${OWNER}/${REPO}/pages`, { headers });
  if (pages.ok) {
    const d = await pages.json();
    console.log('=== Pages 配置 ===');
    console.log(JSON.stringify(
      {
        html_url: d.html_url,
        status: d.status,
        cname: d.cname,
        custom_404: d.custom_404,
        build_type: d.build_type,
        source: d.source,
        https_certificate: d.https_certificate?.state,
      },
      null,
      2,
    ));
  } else {
    console.log('Pages 查询失败', pages.status, await pages.text());
  }

  // 最近的工作流
  console.log('\n=== 工作流 ===');
  const wf = await fetch(`https://api.github.com/repos/${OWNER}/${REPO}/actions/workflows`, { headers });
  if (wf.ok) {
    const d = await wf.json();
    for (const w of d.workflows ?? []) {
      console.log(`- ${w.name} (${w.path}) state=${w.state} id=${w.id}`);
    }
  } else {
    console.log('工作流查询失败', wf.status, (await wf.text()).slice(0, 200));
  }

  // 最近的 run
  console.log('\n=== 最近运行 ===');
  const runs = await fetch(`https://api.github.com/repos/${OWNER}/${REPO}/actions/runs?per_page=5`, { headers });
  if (runs.ok) {
    const d = await runs.json();
    if (!d.workflow_runs?.length) console.log('（还没有任何运行）');
    for (const r of d.workflow_runs ?? []) {
      console.log(`- #${r.run_number} ${r.name} status=${r.status} conclusion=${r.conclusion} event=${r.event}`);
      console.log(`   ${r.html_url}`);
    }
  } else {
    console.log('运行查询失败', runs.status, (await runs.text()).slice(0, 200));
  }

  // 自定义域名检查
  console.log('\n=== 仓库 Pages 相关设置 ===');
  const repo = await fetch(`https://api.github.com/repos/${OWNER}/${REPO}`, { headers });
  if (repo.ok) {
    const d = await repo.json();
    console.log(`homepage = ${d.homepage}`);
    console.log(`has_pages = ${d.has_pages}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
