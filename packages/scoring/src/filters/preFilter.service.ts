import type { JobEvaluationInput } from '@autojobs/shared'; // Ajuste o caminho se necessário

export class PreFilterService {
  /**
   * Avalia regras rápidas de texto.
   * Retorna { passed: false, reason: "..." } se a vaga dever ser descartada imediatamente.
   */
  public static evaluate(input: JobEvaluationInput): { passed: boolean; reason?: string } {
    const titleLower = input.title.toLowerCase();
    const { profile } = input;

    // 1. FILTRO DE PALAVRAS NEGATIVAS NO TÍTULO
    // Se a palavra proibida está no *título*, descartamos na hora.
    // (Se estiver na descrição, deixamos para o LLM analisar o contexto).
    if (profile.negativeKeywords && profile.negativeKeywords.length > 0) {
      for (const keyword of profile.negativeKeywords) {
        if (titleLower.includes(keyword.toLowerCase())) {
          return {
            passed: false,
            reason: `Reprovado no pré-filtro: Título contém a palavra restrita "${keyword}".`
          };
        }
      }
    }

    // 2. FILTRO BÁSICO DE SENIORIDADE EXPLICITA NO TÍTULO
    const avoidSeniorities = this.getOppositeSeniorities(profile.seniority || []);
    for (const sen of avoidSeniorities) {
      if (titleLower.includes(sen)) {
        return {
          passed: false,
          reason: `Reprovado no pré-filtro: Nível incompatível identificado no título (${sen}).`
        };
      }
    }

    // Passou pela triagem inicial
    return { passed: true };
  }

  /**
   * Lógica simples: Se o perfil é de Junior, bloqueia palavras de liderança/senior.
   * Se o perfil é Senior, bloqueia palavras de estágio.
   */
  private static getOppositeSeniorities(targetSeniorities: string[]): string[] {
    const targetLower = targetSeniorities.map(s => s.toLowerCase());
    const avoid: string[] = [];

    // Se NÃO procura vaga Sênior/Liderança, evite essas palavras no título
    if (!targetLower.includes('sênior') && !targetLower.includes('senior')) {
      avoid.push('sênior', 'senior', 'sr', 'especialista', 'staff', 'principal', 'lead', 'manager', 'gestor', 'diretor');
    }
    
    // Se NÃO procura vaga de Estágio/Junior, evite essas palavras
    if (!targetLower.includes('estágio') && !targetLower.includes('júnior') && !targetLower.includes('junior')) {
      avoid.push('estágio', 'estagiário', 'intern', 'trainee', 'jovem aprendiz');
    }

    return avoid;
  }
}