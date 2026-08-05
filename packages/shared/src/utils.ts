// packages/shared/src/utils.ts
import { z } from 'zod';

export const ProfileInputSchema = z.object({
  id: z.string().optional(),
  name: z.string(),
  targetRoles: z.array(z.string()).optional(),
  targetAreas: z.array(z.string()).optional(),
  seniority: z.array(z.string()).optional(),
  searchLocation: z.array(z.string()).optional(),
  allowedModalities: z.array(z.string()).optional(),
  hybridCities: z.array(z.string()).optional(),
  skillMatrix: z.record(z.any()).optional(),
  languages: z.record(z.string()).optional(),
  negativeKeywords: z.array(z.any()).optional(),
  aiApplicationContext: z.string().optional(),
  minScore: z.number().optional(),
  dailyLimit: z.number().optional()
});

// packages/shared/src/utils/normalize.ts
export function normalize(s?: string): string {
  if (!s) return "";
  // NFD + remoção de diacríticos; mantém espaços e pontuação mínima
  return s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase().trim();
}

export function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * wordBoundaryMatch: usa normalize + escapeRegex e testa com \b para evitar matches parciais.
 * Retorna true se 'word' aparece como token independente em 'text'.
 */
export function wordBoundaryMatch(text: string, word: string): boolean {
  const t = normalize(text);
  const w = escapeRegex(normalize(word));
  try {
    const re = new RegExp(`\\b${w}\\b`, "i");
    return re.test(t);
  } catch {
    // fallback seguro
    return t.includes(normalize(word));
  }
}



// packages/shared/src/utils/encoding.ts
export function looksLikeMojibake(s: string): boolean {
  if (!s || typeof s !== 'string') return false;
  // padrões comuns: Ã, Ã£, Ã©, Ã§, etc.
  return /Ã[¡-ÿ]|Â|Ã§|Ã£|Ã©|Ãª|Ãº|Ã±/.test(s);
}

/**
 * Tenta recuperar strings que sofreram mojibake (UTF-8 bytes interpretados como latin1)
 * Estratégia: se detectar padrão, converte via Buffer latin1 -> utf8.
 */
export function fixMojibake(s: string): string {
  if (!s || typeof s !== 'string') return s;
  if (!looksLikeMojibake(s)) return s;
  try {
    // Em runtime Node: Buffer
    // Em Cloudflare Workers (no Buffer) usar TextDecoder/TextEncoder fallback
    if (typeof Buffer !== 'undefined') {
      return Buffer.from(s, 'latin1').toString('utf8');
    } else {
      // Fallback para ambientes sem Buffer (Workers): reinterpreta bytes
      const latin1Bytes = new Uint8Array([...s].map(ch => ch.charCodeAt(0) & 0xff));
      const dec = new TextDecoder('utf-8');
      return dec.decode(latin1Bytes);
    }
  } catch {
    return s;
  }
}

/**
 * Aplica fixMojibake recursivamente em objetos/arrays/strings.
 */
export function fixEncodingDeep(obj: any): any {
  if (obj == null) return obj;
  if (typeof obj === 'string') return fixMojibake(obj);
  if (Array.isArray(obj)) return obj.map(fixEncodingDeep);
  if (typeof obj === 'object') {
    const out: any = {};
    for (const k of Object.keys(obj)) {
      out[k] = fixEncodingDeep(obj[k]);
    }
    return out;
  }
  return obj;
}

const ensureArray = (v: any, fallback: any[] = []) => {
  if (!v) return fallback;
  if (Array.isArray(v)) return v;
  if (typeof v === 'string') {
    try {
      const parsed = JSON.parse(v);
      if (Array.isArray(parsed)) return parsed;
    } catch {}
    return v.split(',').map((s: string) => s.trim()).filter(Boolean);
  }
  return fallback;
};

const normalizeText = (s: any) => {
  if (typeof s !== 'string') return s;
  // primeiro tenta recuperar mojibake, depois normaliza e remove diacríticos
  const fixed = fixMojibake(s);
  return fixed.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
};

export function normalizeProfileInput(input: any): any {
  if (!input || typeof input !== 'object') return {};

  const safe = { ...input };

  const baseNormalized: any = {
    id: safe.id ?? undefined,
    name: String(fixMojibake(safe.name || '')).trim(),
    targetRoles: ensureArray(safe.targetRoles, ['Desenvolvedor']).map((r: any) => typeof r === 'string' ? fixMojibake(r) : r),
    targetAreas: ensureArray(safe.targetAreas, []).map((r: any) => typeof r === 'string' ? fixMojibake(r) : r),
    seniority: ensureArray(safe.seniority, []).map((r: any) => typeof r === 'string' ? fixMojibake(r) : r),
    searchLocation: ensureArray(safe.searchLocation, ['Brasil']).map((r: any) => typeof r === 'string' ? fixMojibake(r) : r),
    allowedModalities: ensureArray(safe.allowedModalities, ['remoto', 'híbrido']).map((r: any) => typeof r === 'string' ? fixMojibake(r) : r),
    hybridCities: ensureArray(safe.hybridCities, []).map(normalizeText),
    skillMatrix: safe.skillMatrix ?? {},
    languages: safe.languages ?? {},
    negativeKeywords: ensureArray(safe.negativeKeywords, []).map((r: any) => typeof r === 'string' ? fixMojibake(r) : r),
    aiApplicationContext: String(fixMojibake(safe.aiApplicationContext || '')),
    minScore: typeof safe.minScore === 'number' ? safe.minScore : 75,
    dailyLimit: typeof safe.dailyLimit === 'number' ? safe.dailyLimit : 10,
  };

  return {
    ...safe,
    ...baseNormalized
  };
}
