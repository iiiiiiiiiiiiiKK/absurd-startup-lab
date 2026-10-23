import { MODES, SPICE } from '../data/modes';
import { getCategory } from '../data/categories';
import type { Project } from './types';

const DIVIDER = '\n---\n\n';

export function projectTitle(p: Project): string {
  return `${p.name} — ${p.tagline}`;
}

export function toMarkdown(p: Project): string {
  const cat = getCategory(p.category);
  const mode = MODES[p.mode];
  const spice = SPICE[p.spice];
  const lines: string[] = [];

  lines.push(`# ${p.name}`);
  lines.push('');
  lines.push(`> ${p.tagline}`);
  lines.push('');
  lines.push(
    `**项目 ID：** \`${p.id}\` · **版本：** v${p.revision} · **赛道：** ${cat.emoji} ${cat.label} · **模式：** ${mode.label} · **荒诞程度：** ${spice.label}`,
  );
  lines.push('');
  lines.push(p.tags.map((t) => `\`${t}\``).join(' '));
  lines.push(DIVIDER.trimEnd());

  const section = (title: string, body: string) => {
    lines.push(`## ${title}`);
    lines.push('');
    lines.push(body);
    lines.push('');
  };

  section('目标用户', p.targetUsers);
  section('用户痛点', p.painPoints);
  section('产品解决方案', p.solution);
  section(
    '核心功能',
    p.features.map((f, i) => `${i + 1}. ${f}`).join('\n'),
  );
  section('收费模式', p.pricing);
  section('获客方式', p.acquisition);
  section('最离谱的卖点', p.wildestHook);
  section('首条 X 推广文案', ['```text', p.tweet, '```'].join('\n'));
  section(
    '投资人可能提出的问题',
    p.investorQuestions.map((q, i) => `${i + 1}. ${q}`).join('\n'),
  );
  section('创始人最不愿回答的问题', `> ${p.founderDread}`);

  lines.push('## 模拟数据声明');
  lines.push('');
  lines.push(`> ⚠️ ${p.metrics.assumption}`);
  lines.push('');
  lines.push(`- ${p.metrics.tam}`);
  lines.push(`- ${p.metrics.users}`);
  lines.push(`- ${p.metrics.revenue}`);
  lines.push(`- ${p.metrics.funding}`);
  lines.push('');
  lines.push(DIVIDER.trimEnd());
  lines.push(
    `由「离谱创业模拟器」生成 · 生成时间 ${new Date(p.createdAt).toLocaleString('zh-CN')} · 纯属虚构，不构成任何商业建议。`,
  );
  lines.push('');

  return lines.join('\n');
}

export function toJson(p: Project): string {
  const cat = getCategory(p.category);
  const payload = {
    schema: 'absurd-startup-lab/project@1',
    id: p.id,
    revision: p.revision,
    createdAt: new Date(p.createdAt).toISOString(),
    seed: p.seed,
    mode: p.mode,
    modeLabel: MODES[p.mode].label,
    spice: p.spice,
    spiceLabel: SPICE[p.spice].label,
    category: p.category,
    categoryLabel: cat.label,
    slots: p.slots,
    tags: p.tags,
    name: p.name,
    tagline: p.tagline,
    targetUsers: p.targetUsers,
    painPoints: p.painPoints,
    solution: p.solution,
    features: p.features,
    pricing: p.pricing,
    acquisition: p.acquisition,
    wildestHook: p.wildestHook,
    tweet: p.tweet,
    investorQuestions: p.investorQuestions,
    founderDread: p.founderDread,
    metrics: p.metrics,
    disclaimer: '本文件内容为虚构创业项目，所有数字均为模拟假设，不代表真实商业数据。',
  };
  return JSON.stringify(payload, null, 2);
}

/** 一键复制用的纯文本计划 */
export function toPlainText(p: Project): string {
  return toMarkdown(p)
    .replace(/^#+\s*/gm, '')
    .replace(/```text|```/g, '')
    .replace(/\*\*/g, '')
    .replace(/^>\s?/gm, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export interface PromoAngle {
  key: string;
  label: string;
  hint: string;
  text: string;
}

/**
 * 多条 X 推广角度：每条都在 280 字符（X 免费额度）内尽量完整，
 * 且都带 #hashtag，可直接复制发布。
 */
export function buildPromoAngles(p: Project): PromoAngle[] {
  const cat = getCategory(p.category);
  const tag = p.tags[0] ?? '#离谱创业';
  const short = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);

  const angles: PromoAngle[] = [
    {
      key: 'launch',
      label: '首发官宣',
      hint: '最稳妥的一条，适合正式发布',
      text: [
        `我们上线了「${p.name}」。`,
        '',
        `${p.tagline}`,
        '',
        `第 1 版只做一件事，做不好就删。${tag}`,
      ].join('\n'),
    },
    {
      key: 'pain',
      label: '痛点共鸣',
      hint: '从用户原话切入，适合引战讨论',
      text: [
        `「${short(p.painPoints.split('。')[0], 46)}」`,
        '',
        `这句话我听了几十遍，于是做了「${p.name}」：${short(p.tagline, 30)}`,
        '',
        `${tag}`,
      ].join('\n'),
    },
    {
      key: 'absurd',
      label: '自嘲整活',
      hint: '把离谱点摊开说，最容易传播',
      text: [
        `我知道这听起来很离谱：${short(p.wildestHook, 60)}`,
        '',
        `但「${p.name}」真的做出来了。${cat.emoji} ${tag}`,
      ].join('\n'),
    },
    {
      key: 'build',
      label: '公开构建',
      hint: 'Build in public 风格，适合持续更新',
      text: [
        `Day 1：「${p.name}」已上线。`,
        '',
        `目标用户：${short(p.targetUsers.split('。')[0], 40)}`,
        `下一步：跑通 50 个真实用户，不行就砍。`,
        '',
        `${tag} #buildinpublic`,
      ].join('\n'),
    },
    {
      key: 'ask',
      label: '求反馈',
      hint: '带问题结尾，更容易获得回复',
      text: [
        `做「${p.name}」之前，我想问一个问题：`,
        '',
        `${short(p.investorQuestions[0] ?? p.painPoints.split('。')[0], 90)}`,
        '',
        `你们怎么看？${tag}`,
      ].join('\n'),
    },
  ];

  return angles.map((a) => ({
    ...a,
    text: a.text.length > 280 ? `${a.text.slice(0, 277)}…` : a.text,
  }));
}

/** 触发浏览器下载 */
export function downloadText(filename: string, content: string, mime = 'text/plain;charset=utf-8') {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

export function safeFilename(p: Project, ext: string): string {
  const base = `${p.id}_${p.name}`.replace(/[\\/:*?"<>|\s]+/g, '_').slice(0, 60);
  return `${base}.${ext}`;
}

export function downloadMarkdown(p: Project) {
  downloadText(safeFilename(p, 'md'), toMarkdown(p), 'text/markdown;charset=utf-8');
}

export function downloadJson(p: Project) {
  downloadText(safeFilename(p, 'json'), toJson(p), 'application/json;charset=utf-8');
}

/** 复制：优先 Clipboard API，回退 execCommand（兼容非 https 环境） */
export async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    /* fall through */
  }
  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', 'readonly');
    ta.style.position = 'fixed';
    ta.style.top = '-1000px';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    ta.setSelectionRange(0, text.length);
    const ok = document.execCommand('copy');
    ta.remove();
    return ok;
  } catch {
    return false;
  }
}
