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

/**
 * normalizeProfileInput
 * - Garante tipos mínimos e defaults
 * - Normaliza arrays e strings
 * - Canonicalização simples de cidades (lowercase, remove acentos)
 */
export function normalizeProfileInput(input: any): any {
  if (!input || typeof input !== 'object') return {};

  const safe = { ...input };

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

  const normalizeText = (s: any) =>
    typeof s === 'string' ? s.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim() : s;

  // 1. Criamos APENAS os campos conhecidos já devidamente normalizados
  const baseNormalized: any = {
    id: safe.id ?? undefined,
    name: String(safe.name || '').trim(),
    targetRoles: ensureArray(safe.targetRoles, ['Desenvolvedor']),
    targetAreas: ensureArray(safe.targetAreas, []),
    seniority: ensureArray(safe.seniority, []),
    searchLocation: ensureArray(safe.searchLocation, ['Brasil']),
    allowedModalities: ensureArray(safe.allowedModalities, ['remoto', 'híbrido']),
    hybridCities: ensureArray(safe.hybridCities, []).map(normalizeText),
    skillMatrix: safe.skillMatrix ?? {},
    languages: safe.languages ?? {},
    negativeKeywords: ensureArray(safe.negativeKeywords, []),
    aiApplicationContext: String(safe.aiApplicationContext || ''),
    minScore: typeof safe.minScore === 'number' ? safe.minScore : 75,
    dailyLimit: typeof safe.dailyLimit === 'number' ? safe.dailyLimit : 10,
  };

  // 2. Retornamos o objeto fundindo os campos extras que vieram na requisição
  // e sobrescrevendo os conhecidos com a versão limpa/normalizada que criamos acima.
  return {
    ...safe,
    ...baseNormalized
  };
}