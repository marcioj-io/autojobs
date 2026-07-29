// packages/shared/src/utils/normalize.ts
export function normalize(s?: string): string {
  if (!s) return '';
  return s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().trim();
}

export function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function wordBoundaryMatch(text: string, word: string): boolean {
  const t = normalize(text);
  const w = escapeRegex(normalize(word));
  const re = new RegExp(`\\b${w}\\b`, 'i');
  return re.test(t);
}
