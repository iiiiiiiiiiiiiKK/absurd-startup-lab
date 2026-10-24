/**
 * 触发 Deploy to GitHub Pages 工作流，并轮询直到结束。
 */
const TOKEN = process.env.GH_TOKEN;
const OWNER = 'iiiiiiiiiiiiiKK';
const REPO = 'absurd-startup-lab';
const WORKFLOW = 'deploy.yml';
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const headers = {
  Authorization: `Bearer ${TOKEN}`,
  Accept: 'application/vnd.github+json',
  'User-Agent': 'absurd-startup-lab-deployer',
  'Content-Type': 'application/json',
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const before = await fetch(
    `https://api.github.com/repos/${OWNER}/${REPO}/actions/runs?per_page=1`,
    { headers },
  ).then((r) => r.json());
  const lastId = before.workflow_runs?.[0]?.id ?? 0;
  console.log(`当前最新 run id = ${lastId}`);

  const dispatch = await fetch(
    `https://api.github.com/repos/${OWNER}/${REPO}/actions/workflows/${WORKFLOW}/dispatches`,
    {
      method: 'POST',
      headers,
      body: JSON.stringify({ ref: 'main' }),
    },
  );
  console.log(`dispatch status = ${dispatch.status}`);
  if (!dispatch.ok) {
    console.log(await dispatch.text());
  }

  // 等待新 run 出现
  let run = null;
  for (let i = 0; i < 30; i += 1) {
    await sleep(3000);
    const list = await fetch(
      `https://api.github.com/repos/${OWNER}/${REPO}/actions/runs?per_page=3`,
      { headers },
    ).then((r) => r.json());
    run = (list.workflow_runs ?? []).find((r) => r.id !== lastId);
    if (run) break;
  }
  if (!run) {
    console.log('新 run 未出现');
    return;
  }
  console.log(`新 run #${run.run_number} id=${run.id} status=${run.status}`);
  console.log(`  ${run.html_url}`);

  // 轮询直到完成
  for (let i = 0; i < 60; i += 1) {
    await sleep(6000);
    const d = await fetch(
      `https://api.github.com/repos/${OWNER}/${REPO}/actions/runs/${run.id}`,
      { headers },
    ).then((r) => r.json());
    process.stdout.write(`  [${i}] status=${d.status} conclusion=${d.conclusion ?? '-'}\n`);
    if (d.status === 'completed') {
      console.log(`\n最终：status=${d.status} conclusion=${d.conclusion}`);
      const jobs = await fetch(d.jobs_url, { headers }).then((r) => r.json());
      for (const job of jobs.jobs ?? []) {
        console.log(`\nJOB ${job.name}: ${job.conclusion}`);
        for (const s of job.steps ?? []) console.log(`  [${s.conclusion ?? s.status}] ${s.name}`);
      }
      break;
    }
  }

  // 查 Pages 状态
  const pages = await fetch(`https://api.github.com/repos/${OWNER}/${REPO}/pages`, { headers });
  if (pages.ok) {
    const p = await pages.json();
    console.log('\n=== Pages ===');
    console.log(`  html_url = ${p.html_url}`);
    console.log(`  status   = ${p.status}`);
    console.log(`  cname    = ${p.cname ?? '(none)'}`);
    console.log(`  build    = ${p.build_type}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
