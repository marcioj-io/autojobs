// packages/scoring/src/filters/preFilter.service.ts
import type { JobEvaluationInput } from '@autojobs/shared';
import { normalize, wordBoundaryMatch } from '../utils/normalize';

export type PreFilterResult = {
  passed: boolean;
  reason: string;
  action: 'accept' | 'soft_reject' | 'reject';
};

export class PreFilterService {
  public static evaluate(input: JobEvaluationInput): PreFilterResult {
    const title = normalize(input.title || '');
    const descriptionSnippet = normalize((input.description || '').slice(0, 1500));
    const profile = input.profile;

    // 1) Negative keywords: seniority/presencial continuam veto absoluto; tecnologias viram soft_reject
    if (profile.negativeKeywords && profile.negativeKeywords.length > 0) {
      for (const keyword of profile.negativeKeywords) {
        const normalizedKeyword = normalize(keyword);

        if (
          wordBoundaryMatch(title, normalizedKeyword) ||
          wordBoundaryMatch(descriptionSnippet, normalizedKeyword)
        ) {
          // Keywords que devem permanecer como veto (hard reject)
          if (/\b(estagi|estágio|júnior|junior|jr|sênior|senior|presencial|presencialmente)\b/.test(normalizedKeyword)) {
            return {
              passed: false,
              reason: `Descartado no pré-filtro: Encontrada a palavra restrita "${keyword}" (veto explícito) configurada no perfil.`,
              action: 'reject'
            };
          }

          // Para tecnologias/stack/termos técnicos, marcar como soft_reject para LLM/revisão manual
          return {
            passed: true,
            reason: `Pré-filtro detectou termo restrito "${keyword}" — marcar para revisão (soft flag).`,
            action: 'soft_reject'
          };
        }
      }
    }

    // 2) Seniority handling mais inteligente
    const profileLevels = this.normalizeProfileSeniorities(profile.seniority || []);
    const titleLevels = this.detectLevelsInText(title);
    const descLevels = this.detectLevelsInText(descriptionSnippet);
    const detectedLevels = new Set([...titleLevels, ...descLevels]);

    // Se não detectou níveis no título/descrição, aceita (deixa LLM decidir)
    if (detectedLevels.size === 0) {
      return { passed: true, reason: 'Nenhum nível detectado; deixar LLM decidir.', action: 'accept' };
    }

    // Se perfil aceita senior (ex: busca Senior), aceitar qualquer nível igual ou inferior
    if (profileLevels.has('senior')) {
      return { passed: true, reason: 'Perfil aceita Senior; aceitar vaga.', action: 'accept' };
    }

    // Se perfil é pleno/intermediário
    if (profileLevels.has('mid')) {
      // Se vaga é junior -> rejeitar
      if (detectedLevels.has('junior')) {
        return {
          passed: false,
          reason: 'Descartado no pré-filtro: vaga de nível Júnior/Estágio incompatível com perfil Pleno.',
          action: 'reject'
        };
      }
      // Se vaga é senior -> soft_reject (marcar para revisão manual/LLM)
      if (detectedLevels.has('senior')) {
        return {
          passed: true,
          reason: 'Vaga marcada como Sênior; perfil é Pleno — enviar para revisão manual/LLM (soft flag).',
          action: 'soft_reject'
        };
      }
      // Se vaga é mid/intermediate/pleno -> aceitar
      if (detectedLevels.has('mid')) {
        return { passed: true, reason: 'Vaga nível Pleno detectada; aceitar.', action: 'accept' };
      }
    }

    // Se perfil é junior
    if (profileLevels.has('junior')) {
      // aceitar junior; se vaga senior -> rejeitar
      if (detectedLevels.has('senior')) {
        return {
          passed: false,
          reason: 'Descartado no pré-filtro: vaga Sênior incompatível com perfil Júnior.',
          action: 'reject'
        };
      }
      // vaga mid -> soft_reject (pode ser aceitável dependendo do contexto)
      if (detectedLevels.has('mid')) {
        return {
          passed: true,
          reason: 'Vaga Intermediária/Pleno detectada; perfil é Júnior — enviar para revisão manual/LLM (soft flag).',
          action: 'soft_reject'
        };
      }
      // vaga junior -> aceitar
      if (detectedLevels.has('junior')) {
        return { passed: true, reason: 'Vaga Júnior detectada; aceitar.', action: 'accept' };
      }
    }

    // Fallback: aceitar e deixar LLM decidir
    return { passed: true, reason: 'Fallback: aceitar e deixar LLM decidir.', action: 'accept' };
  }

  /**
   * Normaliza seniorities do profile para um conjunto de níveis: 'junior' | 'mid' | 'senior'
   */
  private static normalizeProfileSeniorities(targetSeniorities: string[]): Set<'junior' | 'mid' | 'senior'> {
    const s = new Set<'junior' | 'mid' | 'senior'>();
    for (const raw of targetSeniorities || []) {
      const n = normalize(raw);
      if (/junior|júnior|jr|estagi|intern|trainee|jovem aprendiz/.test(n)) s.add('junior');
      else if (/pleno|intermedi|intermediário|mid|intermediate/.test(n)) s.add('mid');
      else if (/senior|sênior|sr|lead|staff|principal|manager|diretor|head/.test(n)) s.add('senior');
    }
    // Se não houver seniority explícita, assumir mid (Pleno) como default para evitar rejeições agressivas
    if (s.size === 0) s.add('mid');
    return s;
  }

  /**
   * Detecta níveis mencionados em um texto e retorna um Set com 'junior'|'mid'|'senior'
   */
  private static detectLevelsInText(text: string): Set<'junior' | 'mid' | 'senior'> {
    const found = new Set<'junior' | 'mid' | 'senior'>();
    const t = normalize(text || '');

    if (/\b(estagi(ar|o|ário)|trainee|jovem aprendiz|junior|júnior|jr)\b/.test(t)) found.add('junior');
    if (/\b(pleno|intermedi(ário|o)|mid|intermediate)\b/.test(t)) found.add('mid');
    if (/\b(senior|sênior|sr|lead|staff|principal|manager|diretor|head)\b/.test(t)) found.add('senior');

    return found;
  }
}
