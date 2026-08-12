// packages\scoring\src\utils\index.ts
import { escapeRegex } from "@autojobs/shared";

export function normalizeText(s: string): string {
  return (s || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s\.\-_/]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function levenshteinDistance(a: string, b: string): number {
  const A = a || '';
  const B = b || '';
  const m = A.length;
  const n = B.length;
  if (m === 0) return n;
  if (n === 0) return m;
  const dp: number[] = new Array(n + 1);
  for (let j = 0; j <= n; j++) dp[j] = j;
  for (let i = 1; i <= m; i++) {
    let prev = dp[0];
    dp[0] = i;
    for (let j = 1; j <= n; j++) {
      const cur = dp[j];
      const cost = A[i - 1] === B[j - 1] ? 0 : 1;
      dp[j] = Math.min(dp[j] + 1, dp[j - 1] + 1, prev + cost);
      prev = cur;
    }
  }
  return dp[n];
}

export function similarityScore(a: string, b: string): number {
  const A = normalizeText(a);
  const B = normalizeText(b);
  if (!A || !B) return 0;
  const dist = levenshteinDistance(A, B);
  const maxLen = Math.max(A.length, B.length);
  if (maxLen === 0) return 1;
  return 1 - dist / maxLen;
}

export function fuzzyMatchAny(needle: string, haystacks: string[], threshold = 0.72): boolean {
  const n = normalizeText(needle);
  if (!n) return false;
  for (const h of haystacks) {
    const H = normalizeText(h);
    if (!H) continue;
    const re = new RegExp(`\\b${escapeRegex(n)}\\b`, 'i');
    if (re.test(H)) return true;
    if (H.includes(n)) return true;
    const sim = similarityScore(n, H);
    if (sim >= threshold) return true;
    const tokens = n.split(' ').filter(Boolean);
    let matchedTokens = 0;
    for (const t of tokens) {
      if (H.includes(t)) matchedTokens++;
    }
    if (tokens.length > 0 && matchedTokens / tokens.length >= 0.6) return true;
  }
  return false;
}