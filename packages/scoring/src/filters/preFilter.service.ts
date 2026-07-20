import type { JobEvaluationInput } from '@autojobs/shared';
import { normalize, wordBoundaryMatch } from '../utils/normalize';

export class PreFilterService {
  public static evaluate(input: JobEvaluationInput): { passed: boolean; reason?: string } {
    const title = normalize(input.title || '');
    const descriptionSnippet = normalize((input.description || '').slice(0, 1500));
    const profile = input.profile;

    // 1. Bloqueio por Negative Keywords configuradas pelo próprio Usuário (Qualquer Profissão)
    if (profile.negativeKeywords && profile.negativeKeywords.length > 0) {
      for (const keyword of profile.negativeKeywords) {
        const normalizedKeyword = normalize(keyword);
        if (
          wordBoundaryMatch(title, normalizedKeyword) || 
          wordBoundaryMatch(descriptionSnippet, normalizedKeyword)
        ) {
          return {
            passed: false,
            reason: `Descartado no pré-filtro: Encontrada a palavra restrita "${keyword}" configurada no perfil.`
          };
        }
      }
    }

    // 2. Bloqueio por Senioridade Incompatível (Algoritmo Dinâmico Universal)
    const avoidSeniorities = this.getOppositeSeniorities(profile.seniority || []);
    for (const sen of avoidSeniorities) {
      if (wordBoundaryMatch(title, sen)) {
        return {
          passed: false,
          reason: `Descartado no pré-filtro: Nível de senioridade no título ("${sen}") diverge do perfil.`
        };
      }
    }

    return { passed: true };
  }

  private static getOppositeSeniorities(targetSeniorities: string[]): string[] {
    const targetLower = (targetSeniorities || []).map(s => normalize(s));
    const avoid: string[] = [];

    const isSeniorTarget = targetLower.some(s => 
      s.includes('senior') || s.includes('sênior') || s.includes('sr') || s.includes('lead') || s.includes('head')
    );
    const isJuniorTarget = targetLower.some(s => 
      s.includes('junior') || s.includes('júnior') || s.includes('jr') || s.includes('intern') || s.includes('estagio')
    );

    // Se o candidato NÃO busca vagas sênior/gestão, bloqueie títulos de liderança/sênior no pré-filtro
    if (!isSeniorTarget) {
      avoid.push('sênior', 'senior', 'sr', 'especialista', 'staff', 'principal', 'lead', 'manager', 'diretor', 'head');
    }

    // Se o candidato NÃO busca vagas de início de carreira, bloqueie estágios e trainees
    if (!isJuniorTarget) {
      avoid.push('estágio', 'estagiário', 'intern', 'trainee', 'jovem aprendiz', 'junior', 'jr');
    }

    return avoid;
  }
}