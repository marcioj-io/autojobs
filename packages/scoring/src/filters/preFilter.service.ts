// packages/scoring/src/filters/preFilter.service.ts
import { normalize, TitleEligibilityValidator, wordBoundaryMatch } from '@autojobs/shared';
import type { JobEvaluationInput } from '@autojobs/shared';
import { fuzzyMatchAny } from '../utils';

type FilterAction = 'accept' | 'reject' | 'soft_reject';

export interface PreFilterResult {
  passed: boolean;
  action: FilterAction;
  reason?: string;
  matchedKeywords: string[];
}

/* -----------------------
   Helpers: parse location & modality
   ----------------------- */

function parseLocation(raw?: string) {
  if (!raw) return { city: '', state: '' };
  const cleaned = raw.replace(/\(.*?\)/g, '').replace(/\s+/g, ' ').trim();
  const parts = cleaned.split(',').map(p => p.trim()).filter(Boolean);
  if (parts.length === 0) return { city: '', state: '' };
  if (parts.length === 1) {
    const p = normalize(parts[0]);
    if (p === 'remote' || p === 'remoto') return { city: '', state: 'remoto' };
    return { city: '', state: p };
  }
  const city = normalize(parts[0]);
  const state = normalize(parts[1]);
  return { city, state };
}

const MODALITY_REGEX = {
  REMOTE: /remote|remoto|home office|wfh/i,
  HYBRID: /hybrid|hibrido/i,
  ONSITE: /presencial|onsite|on-site/i
};

/**
 * Detect modality using any available hint:
 * - explicit modality field
 * - location field
 * - description text
 *
 * Returns one of 'Remoto' | 'Híbrido' | 'Presencial'
 */
function detectModality(modalityRaw?: string, locationRaw?: string, descriptionRaw?: string): 'Remoto' | 'Híbrido' | 'Presencial' {
  const m = String(modalityRaw || '').toLowerCase();
  const l = String(locationRaw || '').toLowerCase();
  const d = String(descriptionRaw || '').toLowerCase();

  if (MODALITY_REGEX.REMOTE.test(m) || MODALITY_REGEX.REMOTE.test(l) || MODALITY_REGEX.REMOTE.test(d)) return 'Remoto';
  if (MODALITY_REGEX.HYBRID.test(m) || MODALITY_REGEX.HYBRID.test(l) || MODALITY_REGEX.HYBRID.test(d)) return 'Híbrido';
  if (MODALITY_REGEX.ONSITE.test(m) || MODALITY_REGEX.ONSITE.test(l) || MODALITY_REGEX.ONSITE.test(d)) return 'Presencial';

  // conservative fallback: treat unknown as Híbrido
  return 'Híbrido';
}

/**
 * Tenta extrair cidade/estado/país a partir de um texto livre (descrição).
 * Retorna { city, state, country, rawMatch } com strings normalizadas (lowercase, trimmed).
 */
function extractLocationHints(text?: string) {
  const t = String(text || '').replace(/\r/g, ' ').replace(/\s+/g, ' ').trim();
  if (!t) return { city: '', state: '', country: '', rawMatch: '' };

  // 1) padrão "Cidade, UF" ou "Cidade, XX" (ex: "São Paulo, SP")
  const cityStateRegex = /([A-Za-zÀ-ÖØ-öø-ÿ\-\s\.]{2,60})\s*,\s*([A-Za-z]{2,3})\b/;
  const m1 = t.match(cityStateRegex);
  if (m1) {
    const city = normalize(m1[1]);
    const state = normalize(m1[2]);
    return { city, state, country: '', rawMatch: m1[0] };
  }

  // 2) padrão "Cidade - Estado/País" ou "Cidade (UF)"
  const cityCountryRegex = /([A-Za-zÀ-ÖØ-öø-ÿ\-\s\.]{2,60})\s*(?:-|\(|–)\s*([A-Za-zÀ-ÖØ-öø-ÿ\-\s]{2,60})/;
  const m2 = t.match(cityCountryRegex);
  if (m2) {
    const city = normalize(m2[1]);
    const second = normalize(m2[2]);
    if (second.length <= 3) return { city, state: second, country: '', rawMatch: m2[0] };
    return { city, state: '', country: second, rawMatch: m2[0] };
  }

  // 3) procurar siglas de estados BR isoladas (SP, RJ, MG, etc.)
  const stateRegex = /\b(AC|AL|AP|AM|BA|CE|DF|ES|GO|MA|MT|MS|MG|PA|PB|PR|PE|PI|RJ|RN|RS|RO|RR|SC|SP|SE|TO)\b/i;
  const m3 = t.match(stateRegex);
  if (m3) {
    return { city: '', state: normalize(m3[1]), country: '', rawMatch: m3[0] };
  }

  return { city: '', state: '', country: '', rawMatch: '' };
}

/* -----------------------
   Keyword helpers
   ----------------------- */

function normalizeArray(arr?: unknown): string[] {
  if (!arr) return [];
  if (Array.isArray(arr)) return arr.map(a => normalize(String(a))).filter(Boolean);
  if (typeof arr === 'string') {
    try {
      const parsed = JSON.parse(arr);
      if (Array.isArray(parsed)) return parsed.map(a => normalize(String(a))).filter(Boolean);
    } catch { /* ignore */ }
    return arr.split(',').map(s => normalize(s)).filter(Boolean);
  }
  return [];
}

/* -----------------------
   PreFilterService
   ----------------------- */

export class PreFilterService {
  private static createResult(action: FilterAction, reason?: string, matchedKeywords: string[] = []): PreFilterResult {
    return { passed: action !== 'reject', action, reason, matchedKeywords };
  }

  private static containsAnyText(text: string, expressions: string[]): string[] {
    if (!expressions || expressions.length === 0) return [];
    const found: string[] = [];
    for (const exp of expressions) {
      const n = normalize(exp);
      if (!n) continue;
      // deterministic boundary match first, then fuzzy
      if (wordBoundaryMatch(text, n) || fuzzyMatchAny(n, [text])) found.push(exp);
    }
    return found;
  }

  public static evaluate(input: JobEvaluationInput): PreFilterResult {
    try {
      const profile = (input as any).profile ?? {};
      const title = normalize(input.title ?? '');
      const description = normalize(String(input.description ?? ''));
      const locationRaw = String(input.location ?? '');
      const modalityRaw = String((input as any).modality ?? '');

      if (!title) {
        return this.createResult('reject', 'Pré-filtro: título ausente.', []);
      }

      // Normalização dinâmica baseada exclusivamente no perfil injetado
      const hybridCities = normalizeArray(profile.hybridCities);
      const allowedModalities = normalizeArray(profile.allowedModalities);
      const negativeKeywords = normalizeArray(profile.negativeKeywords);

      // 1. Validação de elegibilidade por título e senioridade do perfil
      try {
        const titleCheck = TitleEligibilityValidator.validate(input.title ?? '', {
          targetRoles: profile.targetRoles,
          seniority: profile.seniority,
          negativeKeywords: profile.negativeKeywords,
          allowedModalities: profile.allowedModalities,
          hybridCities: profile.hybridCities,
        });
        
        if (!titleCheck.eligible) {
          return this.createResult('reject', `Pré-filtro: título inválido (${titleCheck.reason || 'não elegível'})`, []);
        }
      } catch (tvErr) {
        console.warn('[PreFilter] TitleEligibilityValidator falhou, prosseguindo com fluxo secundário', tvErr);
      }

      // 2. Detecção unificada de modalidade e localidade
      const modality = detectModality(modalityRaw, locationRaw, input.description);
      const { state } = parseLocation(locationRaw);

      const normalizedAllowedModalities = allowedModalities.map(a => normalize(String(a)));
      const allowsRemote = normalizedAllowedModalities.some(a => a.includes('remote') || a.includes('remoto'));
      const allowsHybrid = normalizedAllowedModalities.some(a => a.includes('hybrid') || a.includes('hibrido'));
      const allowsOnsite = normalizedAllowedModalities.some(a => a.includes('presencial') || a.includes('onsite'));

      const normalizedHybridCities = hybridCities.map(h => String(h || '').trim().toLowerCase());
      const matchesAllowedRegion = (candidate?: string) => {
        if (!candidate) return false;
        const c = String(candidate).trim().toLowerCase();
        return normalizedHybridCities.includes(c);
      };

      let modalityPassed = false;
      let modalityReason = '';

      // 3. Avaliação dinâmica de modalidades permitidas pelo perfil
      if (modality === 'Remoto') {
        if (!allowsRemote) {
          return this.createResult('reject', 'Pré-filtro: vaga remota não permitida pelas configurações do perfil.', []);
        }
        modalityPassed = true;
        modalityReason = 'Vaga remota aceita pelas diretrizes do perfil.';
      } 
      else if (modality === 'Híbrido') {
        if (state && matchesAllowedRegion(state)) {
          modalityPassed = true;
          modalityReason = `Híbrido em região permitida pelo perfil: ${state}`;
        } else if (!state) {
          const locHints = extractLocationHints(description);
          if (locHints.state && matchesAllowedRegion(locHints.state)) {
            modalityPassed = true;
            modalityReason = `Híbrido detectado na descrição em região permitida: ${locHints.state}`;
          }
        }

        if (!modalityPassed) {
          if (!allowsHybrid) {
            return this.createResult('reject', 'Pré-filtro: vaga híbrida não permitida pelas configurações do perfil.', []);
          }
          return this.createResult('reject', `Pré-filtro: vaga híbrida fora das localidades permitidas pelo perfil (${locationRaw || 'sem localidade'}).`, []);
        }
      } 
      else if (modality === 'Presencial') {
        if (state && matchesAllowedRegion(state)) {
          modalityPassed = true;
          modalityReason = `Presencial em região permitida pelo perfil: ${state}`;
        } else if (!state) {
          const locHints = extractLocationHints(description);
          if (locHints.state && matchesAllowedRegion(locHints.state)) {
            modalityPassed = true;
            modalityReason = `Presencial detectado na descrição em região permitida: ${locHints.state}`;
          }
        }

        if (!modalityPassed) {
          if (!allowsOnsite) {
            return this.createResult('reject', 'Pré-filtro: vaga presencial não permitida pelas configurações do perfil.', []);
          }
          return this.createResult('reject', `Pré-filtro: vaga presencial fora do escopo geográfico do perfil (${locationRaw || 'sem localidade'}).`, []);
        }
      }

      // 4. Varredura universal de palavras-chave negativas definidas no perfil (Soft Reject)
      if (negativeKeywords.length > 0) {
        const matchedDesc = this.containsAnyText(description, negativeKeywords);
        if (matchedDesc.length > 0) {
          return this.createResult('soft_reject', 'Pré-filtro: termo restrito encontrado na descrição.', matchedDesc);
        }
      }

      // 5. Retorno padrão validado
      return this.createResult('accept', modalityReason || 'Pré-filtro aprovado com sucesso.', []);

    } catch (err) {
      console.warn('[PreFilter] Erro interno executando avaliação, acionando fallback de segurança', err);
      return {
        passed: true,
        action: 'accept',
        reason: 'prefilter error fallback',
        matchedKeywords: [],
        _error: { message: (err as any)?.message ?? String(err), code: 'PREFILTER_INTERNAL_ERROR', errorBy: 'prefilter' }
      } as PreFilterResult & { _error?: any };
    }
  }
}
