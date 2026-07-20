// packages/scoring/src/filters/preFilter.service.ts
import type { JobEvaluationInput } from '@autojobs/shared';
import { normalize, wordBoundaryMatch } from '../utils/normalize';

export class PreFilterService {
  public static evaluate(input: JobEvaluationInput): { passed: boolean; reason?: string } {
    const title = normalize(input.title || '');
    const profile = input.profile;

    if (profile.negativeKeywords && profile.negativeKeywords.length > 0) {
      for (const keyword of profile.negativeKeywords) {
        if (wordBoundaryMatch(title, keyword)) {
          return {
            passed: false,
            reason: `Reprovado no pré-filtro: Título contém a palavra restrita "${keyword}".`
          };
        }
      }
    }

    const avoidSeniorities = this.getOppositeSeniorities(profile.seniority || []);
    for (const sen of avoidSeniorities) {
      if (wordBoundaryMatch(title, sen)) {
        return {
          passed: false,
          reason: `Reprovado no pré-filtro: Nível incompatível identificado no título (${sen}).`
        };
      }
    }

    return { passed: true };
  }

  private static getOppositeSeniorities(targetSeniorities: string[]): string[] {
    const targetLower = (targetSeniorities || []).map(s => normalize(s));
    const avoid: string[] = [];

    if (!targetLower.includes('sênior') && !targetLower.includes('senior')) {
      avoid.push('sênior', 'senior', 'sr', 'especialista', 'staff', 'principal', 'lead', 'manager', 'gestor', 'diretor');
    }

    if (!targetLower.includes('estágio') && !targetLower.includes('júnior') && !targetLower.includes('junior')) {
      avoid.push('estágio', 'estagiário', 'intern', 'trainee', 'jovem aprendiz', 'junior', 'jr');
    }

    return avoid;
  }
}
