/**
 * 通过 GitHub REST API 全量同步（git 协议不可达时的备用通道）。
 *
 * 不需要本地存在远端 commit 对象：以远端当前 tree 为 base_tree，
 * 把本地 index 里的每个文件都写成 blob，组装新 tree → 新 commit → 更新 ref。
 * 未在本地 index 中出现、但远端存在的文件会被显式删除（以保持完全一致）。
 */
import { readFileSync, existsSync } from 'node:fs';
import { execSync } from 'node:child_process';

const TOKEN = process.env.GH_TOKEN;
const OWNER = 'iiiiiiiiiiiiiKK';
const REPO = 'absurd-startup-lab';
const BRANCH = 'main';
const MESSAGE = process.env.COMMIT_MESSAGE || 'chore: sync via API';
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

if (!TOKEN) {
  console.error('缺少 GH_TOKEN');
  process.exit(1);
}

const H = {
  Authorization: `Bearer ${TOKEN}`,
  Accept: 'application/vnd.github+json',
  'User-Agent': 'absurd-startup-lab-pusher',
  'Content-Type': 'application/json',
};

const api = (path, init) => fetch(`https://api.github.com${path}`, { headers: H, ...init });
const json = async (p, init) => {
  const r = await api(p, init);
  const b = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`${p} -> ${r.status} ${JSON.stringify(b).slice(0, 300)}`);
  return b;
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  // 1) 远端 head + tree
  const ref = await json(`/repos/${OWNER}/${REPO}/git/ref/heads/${BRANCH}`);
  const remoteSha = ref.object.sha;
  const remoteCommit = await json(`/repos/${OWNER}/${REPO}/git/commits/${remoteSha}`);
  const baseTree = remoteCommit.tree.sha;
  console.log(`remote ${BRANCH} = ${remoteSha}`);
  console.log(`base tree      = ${baseTree}`);

  // 2) 远端完整文件清单（用于清理本地已删除的文件）
  const remoteTree = await json(`/repos/${OWNER}/${REPO}/git/trees/${baseTree}?recursive=1`);
  const remoteFiles = new Set(
    (remoteTree.tree ?? []).filter((e) => e.type === 'blob').map((e) => e.path),
  );
  console.log(`远端文件 ${remoteFiles.size} 个`);

  // 3) 本地 index 文件清单
  const localFiles = execSync('git ls-files', { encoding: 'utf8' })
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean);
  console.log(`本地文件 ${localFiles.length} 个`);

  const localSet = new Set(localFiles);

  // 4) 逐个上传 blob（并发 6）
  const entries = [];
  let done = 0;
  const CONCURRENCY = 6;

  async function upload(path) {
    if (!existsSync(path)) {
      console.warn(`  ! 跳过不存在的文件 ${path}`);
      return;
    }
    const buf = readFileSync(path);
    const blob = await json(`/repos/${OWNER}/${REPO}/git/blobs`, {
      method: 'POST',
      body: JSON.stringify({ content: buf.toString('base64'), encoding: 'base64' }),
    });
    // 可执行位：Windows 上无法可靠判断，统一 100644（本项目无 shell 脚本需执行权限）
    entries.push({ path, mode: '100644', type: 'blob', sha: blob.sha });
    done += 1;
    if (done % 10 === 0) console.log(`  已上传 ${done}/${localFiles.length}`);
  }

  for (let i = 0; i < localFiles.length; i += CONCURRENCY) {
    await Promise.all(localFiles.slice(i, i + CONCURRENCY).map(upload));
    await sleep(60);
  }

  // 5) 远端存在但本地已删除的文件 → sha: null
  const deletions = [...remoteFiles].filter((p) => !localSet.has(p));
  for (const p of deletions) {
    entries.push({ path: p, mode: '100644', type: 'blob', sha: null });
    console.log(`  删除 ${p}`);
  }
  console.log(`blob 完成：上传 ${entries.length - deletions.length}，删除 ${deletions.length}`);

  // 6) 建 tree
  const tree = await json(`/repos/${OWNER}/${REPO}/git/trees`, {
    method: 'POST',
    body: JSON.stringify({ base_tree: baseTree, tree: entries }),
  });
  console.log(`tree = ${tree.sha}`);

  // 7) 建 commit
  const name = 'KK-Trade';
  const email = 'iiiiiiiiiiiiiKK@users.noreply.github.com';
  const now = new Date().toISOString();
  const commit = await json(`/repos/${OWNER}/${REPO}/git/commits`, {
    method: 'POST',
    body: JSON.stringify({
      message: MESSAGE,
      tree: tree.sha,
      parents: [remoteSha],
      author: { name, email, date: now },
      committer: { name, email, date: now },
    }),
  });
  console.log(`commit = ${commit.sha}`);

  // 8) 更新 ref
  const upd = await api(`/repos/${OWNER}/${REPO}/git/refs/heads/${BRANCH}`, {
    method: 'PATCH',
    body: JSON.stringify({ sha: commit.sha, force: false }),
  });
  const updBody = await upd.json().catch(() => ({}));
  console.log(`ref update = ${upd.status} ${updBody.object?.sha ?? ''}`);
  if (!upd.ok) {
    console.error(JSON.stringify(updBody).slice(0, 300));
    process.exit(1);
  }

  console.log(`\n✅ 已同步到 https://github.com/${OWNER}/${REPO}/commit/${commit.sha}`);
}

main().catch((e) => {
  console.error('失败：', e.message);
  process.exit(1);
});
