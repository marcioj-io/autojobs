// packages/scoring/src/filters/preFilter.service.ts
import type { JobEvaluationInput } from '@autojobs/shared';
import { normalize, wordBoundaryMatch } from '../utils/normalize';

type PreFilterResult = {
  passed: boolean;
  reason?: string;
  action?: 'accept' | 'soft_reject' | 'reject';
  matchedKeywords?: string[];
};

/**
 * PreFilterService - clean, deterministic and minimal.
 *
 * Behavior:
 * - Hard reject for explicit seniority or presencial terms.
 * - Soft reject for technical/stack terms (negativeKeywords) using simple operator parsing:
 *    - "A and B" / "A & B" => AND (all tokens must be present)
 *    - "A or B" / "A, B" / "A|B" => OR (any token present)
 *    - single token => OR semantics
 * - Canonicalizes job location and profile.hybridCities for direct equality/contains comparison.
 * - Returns matchedKeywords for diagnostics.
 */

const HARD_VETO_PATTERNS: RegExp[] = [
  /\b(estagi(ar|o|ário)|trainee|jovem aprendiz|junior|júnior|jr)\b/,
  /\b(senior|sênior|sr|lead|staff|principal|manager|diretor|head)\b/,
  /\b(presencial|presencialmente|on[- ]?site|in[- ]?person)\b/
];

// Simple alias map for canonicalization used in location comparison
const CITY_CANONICAL_MAP: Record<string, string> = {
  'pinheiros': 'são paulo',
  'osasco': 'são paulo'
};

function canonicalizeCity(raw?: string): string {
  if (!raw) return '';
  const n = normalize(raw);
  // If contains " - " or "," prefer the rightmost token (common "bairro - cidade" patterns)
  const parts = n.split(/[-,|]/).map(p => p.trim()).filter(Boolean);
  const candidate = parts.length ? parts[parts.length - 1] : n;
  for (const [alias, canonical] of Object.entries(CITY_CANONICAL_MAP)) {
    if (candidate.includes(alias)) return canonical;
  }
  return candidate;
}

function parseNegativeKeyword(raw: string): { operator: 'AND' | 'OR' | 'SINGLE'; tokens: string[] } {
  const r = String(raw || '').trim();
  if (!r) return { operator: 'SINGLE', tokens: [] };

  // AND heuristics
  if (/\band\b/i.test(r) || /&/.test(r)) {
    const tokens = r.split(/\band\b|&/i).map(t => t.trim()).filter(Boolean);
    return { operator: 'AND', tokens };
  }

  // OR heuristics (comma, pipe, or explicit 'or')
  if (/,/.test(r) || /\bor\b/i.test(r) || /\|/.test(r)) {
    const tokens = r.split(/,|\bor\b|\|/i).map(t => t.trim()).filter(Boolean);
    return { operator: 'OR', tokens };
  }

  // Single token (may be multi-word)
  return { operator: 'SINGLE', tokens: [r] };
}

function textContainsAny(text: string, tokens: string[]): boolean {
  const t = normalize(text || '');
  for (const token of tokens) {
    const tok = normalize(token);
    if (!tok) continue;
    if (wordBoundaryMatch(t, tok) || t.includes(tok)) return true;
  }
  return false;
}

export class PreFilterService {
  public static evaluate(input: JobEvaluationInput): PreFilterResult {
    const title = normalize(input.title || '');
    const descriptionSnippet = normalize((input.description || '').slice(0, 1500));
    const profile = input.profile || ({} as any);
    const matchedKeywords: string[] = [];

    // If no negativeKeywords configured, accept immediately
    if (!Array.isArray(profile.negativeKeywords) || profile.negativeKeywords.length === 0) {
      return { passed: true, action: 'accept', matchedKeywords };
    }

    // 1) Hard veto detection (seniority / presencial)
    for (const raw of profile.negativeKeywords) {
      const parsed = parseNegativeKeyword(String(raw));
      for (const token of parsed.tokens) {
        const n = normalize(token);
        if (!n) continue;
        for (const pattern of HARD_VETO_PATTERNS) {
          if (pattern.test(n)) {
            matchedKeywords.push(token);
            return {
              passed: false,
              action: 'reject',
              reason: `Descartado no pré-filtro: Encontrada a palavra restrita "${token}" (veto explícito) configurada no perfil.`,
              matchedKeywords
            };
          }
        }
      }
    }

    // 2) Technical negative keywords (AND / OR / SINGLE) -> soft_reject when matched
    const combinedText = `${title}\n${descriptionSnippet}`;
    for (const raw of profile.negativeKeywords) {
      const parsed = parseNegativeKeyword(String(raw));
      if (parsed.tokens.length === 0) continue;

      if (parsed.operator === 'AND') {
        const allPresent = parsed.tokens.every(tok => textContainsAny(combinedText, [tok]));
        if (allPresent) {
          matchedKeywords.push(...parsed.tokens);
          return {
            passed: true,
            action: 'soft_reject',
            reason: `Pré-filtro detectou conjunto restrito (AND) "${raw}" — todos os termos encontrados; marcar para revisão.`,
            matchedKeywords
          };
        }
      } else {
        // OR / SINGLE
        const found = parsed.tokens.filter(tok => textContainsAny(combinedText, [tok]));
        if (found.length > 0) {
          matchedKeywords.push(...found);
          return {
            passed: true,
            action: 'soft_reject',
            reason: `Pré-filtro detectou termo(s) técnico(s) restrito(s): ${found.join(', ')} — marcar para revisão.`,
            matchedKeywords
          };
        }
      }
    }

    // 3) Seniority mismatch heuristics (conservative)
    const profileLevels = this.normalizeProfileSeniorities(profile.seniority || []);
    const titleLevels = this.detectLevelsInText(title);
    const descLevels = this.detectLevelsInText(descriptionSnippet);
    const detectedLevels = new Set([...titleLevels, ...descLevels]);

    if (detectedLevels.size > 0) {
      if (profileLevels.has('senior')) {
        return { passed: true, action: 'accept', matchedKeywords };
      }

      if (profileLevels.has('mid')) {
        if (detectedLevels.has('junior')) {
          return {
            passed: false,
            action: 'reject',
            reason: 'Descartado no pré-filtro: vaga de nível Júnior/Estágio incompatível com perfil Pleno.',
            matchedKeywords: ['junior']
          };
        }
        if (detectedLevels.has('senior')) {
          return {
            passed: true,
            action: 'soft_reject',
            reason: 'Vaga marcada como Sênior; perfil é Pleno — enviar para revisão manual/LLM (soft flag).',
            matchedKeywords: ['senior']
          };
        }
        if (detectedLevels.has('mid')) {
          return { passed: true, action: 'accept', matchedKeywords };
        }
      }

      if (profileLevels.has('junior')) {
        if (detectedLevels.has('senior')) {
          return {
            passed: false,
            action: 'reject',
            reason: 'Descartado no pré-filtro: vaga Sênior incompatível com perfil Júnior.',
            matchedKeywords: ['senior']
          };
        }
        if (detectedLevels.has('mid')) {
          return {
            passed: true,
            action: 'soft_reject',
            reason: 'Vaga Intermediária/Pleno detectada; perfil é Júnior — enviar para revisão manual/LLM (soft flag).',
            matchedKeywords: ['mid']
          };
        }
        if (detectedLevels.has('junior')) {
          return { passed: true, action: 'accept', matchedKeywords };
        }
      }
    }

    // 4) Hybrid cities / location canonicalization check
    try {
      const jobLocationCanonical = canonicalizeCity(input.location || '');
      const allowedHybridRaw = Array.isArray(profile.hybridCities) ? profile.hybridCities : [];
      const allowedHybridCanonical = allowedHybridRaw.map((c: string) => canonicalizeCity(c)).filter(Boolean);

      if (jobLocationCanonical && allowedHybridCanonical.length > 0) {
        const matched = allowedHybridCanonical.some((canonical: string) => {
          if (!canonical) return false;
          return jobLocationCanonical === canonical || jobLocationCanonical.includes(canonical) || canonical.includes(jobLocationCanonical);
        });

        const locNorm = normalize(input.location || '');
        const isHybridText = locNorm.includes('híbrid') || locNorm.includes('hybrid');

        if (isHybridText && !matched) {
          return {
            passed: false,
            action: 'reject',
            reason: `Geolocalização híbrida incompatível: ${input.location}`,
            matchedKeywords
          };
        }
      }
    } catch {
      // do not block on canonicalization errors; engine will perform final validation
    }

    // 5) Fallback: accept and let LLM decide
    return { passed: true, action: 'accept', matchedKeywords };
  }

  private static normalizeProfileSeniorities(targetSeniorities: string[]): Set<'junior' | 'mid' | 'senior'> {
    const s = new Set<'junior' | 'mid' | 'senior'>();
    for (const raw of targetSeniorities || []) {
      const n = normalize(raw);
      if (/junior|júnior|jr|estagi|intern|trainee|jovem aprendiz/.test(n)) s.add('junior');
      else if (/pleno|intermedi|intermediário|mid|intermediate/.test(n)) s.add('mid');
      else if (/senior|sênior|sr|lead|staff|principal|manager|diretor|head/.test(n)) s.add('senior');
    }
    if (s.size === 0) s.add('mid');
    return s;
  }

  private static detectLevelsInText(text: string): Set<'junior' | 'mid' | 'senior'> {
    const found = new Set<'junior' | 'mid' | 'senior'>();
    const t = normalize(text || '');

    if (/\b(estagi(ar|o|ário)|trainee|jovem aprendiz|junior|júnior|jr)\b/.test(t)) found.add('junior');
    if (/\b(pleno|intermedi(ário|o)|mid|intermediate)\b/.test(t)) found.add('mid');
    if (/\b(senior|sênior|sr|lead|staff|principal|manager|diretor|head)\b/.test(t)) found.add('senior');

    return found;
  }
}
