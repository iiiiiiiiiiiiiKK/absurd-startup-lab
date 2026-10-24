/**
 * 读取最近一次工作流运行的日志，定位失败原因。
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

async function main() {
  const runs = await fetch(
    `https://api.github.com/repos/${OWNER}/${REPO}/actions/runs?per_page=1`,
    { headers },
  ).then((r) => r.json());

  const run = runs.workflow_runs?.[0];
  if (!run) {
    console.log('没有运行记录');
    return;
  }
  console.log(`run #${run.run_number} status=${run.status} conclusion=${run.conclusion}`);

  const jobs = await fetch(run.jobs_url, { headers }).then((r) => r.json());
  for (const job of jobs.jobs ?? []) {
    console.log(`\n=== JOB: ${job.name} (${job.conclusion ?? job.status}) ===`);
    for (const step of job.steps ?? []) {
      console.log(`  [${step.conclusion ?? step.status}] ${step.name}`);
    }
    if (job.conclusion === 'failure') {
      console.log(`  job_id=${job.id}`);
    }
  }

  // 拿失败的 job 日志
  const failedJob = (jobs.jobs ?? []).find((j) => j.conclusion === 'failure');
  if (failedJob) {
    console.log(`\n=== 日志 (job ${failedJob.id}) ===`);
    const logRes = await fetch(
      `https://api.github.com/repos/${OWNER}/${REPO}/actions/jobs/${failedJob.id}/logs`,
      { headers, redirect: 'follow' },
    );
    const text = await logRes.text();
    // 只打印尾部
    const lines = text.split('\n');
    console.log(lines.slice(-80).join('\n'));
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
