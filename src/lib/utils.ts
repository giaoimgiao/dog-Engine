import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * 生成 UUID，兼容所有环境（包括非 HTTPS 环境）
 * 优先使用 crypto.randomUUID()，不可用时使用 fallback 方案
 */
export function generateUUID(): string {
  // 检查是否在浏览器环境且 crypto.randomUUID 可用
  if (typeof window !== 'undefined' && window.crypto && typeof window.crypto.randomUUID === 'function') {
    try {
      return window.crypto.randomUUID();
    } catch (e) {
      // 在某些环境下（如非 HTTPS）可能会抛出异常，fallback 到下面的方案
    }
  }
  
  // Fallback: 使用时间戳 + 随机数生成类似 UUID 的格式
  // 格式: xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * 将中文姓名与常见称谓进行规范化，便于实体对齐。
 */
export function normalizeChineseName(raw: string): string {
  if (!raw) return '';
  let s = String(raw).trim();
  s = s
    .replace(/^(老|小|阿|大|二|三|四|五|六|七|八|九|十)/g, '')
    .replace(/(哥|姐|叔|姨|伯|爷|奶|总|老师|同学|公子|小姐|少爷|大人|殿下)$/g, '')
    .replace(/[\s·•・]+/g, '')
    .replace(/[^\u4e00-\u9fa5a-zA-Z]/g, '');
  return s.toLowerCase();
}

/**
 * 简易相似度（基于最长公共子序列比值，0-1）
 */
export function simpleNameSimilarity(a: string, b: string): number {
  const x = normalizeChineseName(a);
  const y = normalizeChineseName(b);
  if (!x || !y) return 0;
  if (x === y) return 1;
  const common = lcsLen(x, y);
  const avg = (x.length + y.length) / 2;
  return Math.max(0, Math.min(1, common / avg));
}

function lcsLen(a: string, b: string): number {
  const dp: number[][] = Array.from({ length: a.length + 1 }, () => new Array(b.length + 1).fill(0));
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      if (a[i - 1] === b[j - 1]) dp[i][j] = dp[i - 1][j - 1] + 1;
      else dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
    }
  }
  return dp[a.length][b.length];
}

export interface CharacterLike {
  id?: string;
  name: string;
  description?: string;
  aliases?: string[];
}

export interface MatchDecision {
  type: 'autoMerge' | 'suggest' | 'new';
  score: number;
  targetId?: string;
}

/**
 * 计算角色匹配决策
 */
export function decideMatchForCharacter(
  candidate: CharacterLike,
  existing: CharacterLike[],
  opts?: { autoMergeThreshold?: number; suggestThreshold?: number }
): MatchDecision {
  const autoMerge = opts?.autoMergeThreshold ?? 0.88;
  const suggest = opts?.suggestThreshold ?? 0.7;
  let best: { id?: string; score: number } = { score: 0 };
  const names = [candidate.name, ...(candidate.aliases || [])];
  for (const e of existing) {
    const existingNames = [e.name, ...(e.aliases || [])];
    let score = 0;
    for (const n1 of names) for (const n2 of existingNames) score = Math.max(score, simpleNameSimilarity(n1, n2));
    // 关键词重合度（粗略）
    try {
      const kw1 = (candidate.description || '').replace(/[^\u4e00-\u9fa5a-zA-Z0-9]/g, ' ').split(/\s+/).filter(Boolean);
      const kw2 = (e.description || '').replace(/[^\u4e00-\u9fa5a-zA-Z0-9]/g, ' ').split(/\s+/).filter(Boolean);
      if (kw1.length && kw2.length) {
        const set2 = new Set(kw2);
        const inter = kw1.filter(k => set2.has(k)).length;
        const union = new Set([...kw1, ...kw2]).size || 1;
        const jacc = inter / union;
        score = Math.max(score, Math.min(1, 0.5 * score + 0.5 * jacc));
      }
    } catch {}
    if (score > best.score) best = { id: e.id, score };
  }
  if (best.score >= autoMerge) return { type: 'autoMerge', score: best.score, targetId: best.id };
  if (best.score >= suggest) return { type: 'suggest', score: best.score, targetId: best.id };
  return { type: 'new', score: best.score };
}

