import type { JobEvaluationInput } from '@autojobs/shared';
import { LlmEvaluator } from '../llm/llmEvaluator';
import { PreFilterService } from '../filters/preFilter.service';

export interface ScoringResult {
  score: number;
  approved: boolean;
  reason: string;
  metadata: {
    classification: { area: string; role: string; seniority: string };
    matchedSkills: string[];
    missingSkills: string[];
    scoreBreakdown?: Record<string, number>;
    llmRaw?: any;
  };
}

export class ScoringPipeline {
  private llmEvaluator: LlmEvaluator;

  constructor() {
    this.llmEvaluator = new LlmEvaluator();
  }

  public async evaluate(input: JobEvaluationInput): Promise<ScoringResult> {
    try {
      // 1. Pré-filtro rápido e determinístico
      const preFilter = PreFilterService.evaluate(input);
      if (!preFilter.passed) {
        return {
          score: 0,
          approved: false,
          reason: preFilter.reason || 'Descartado no pré-filtro.',
          metadata: {
            classification: { area: '', role: '', seniority: '' },
            matchedSkills: [],
            missingSkills: []
          }
        };
      }

      // 2. Avaliação Semântica com LLM
      const llm = await this.llmEvaluator.evaluate(input);

      const baseScore = typeof llm.rawScore === 'number' ? llm.rawScore : 0;
      const missingRequiredPenalty = (llm.missingRequired?.length || 0) * -10;
      const optionalBonus = (llm.optionalSkillsFound?.length || 0) * 2;

      let finalScore = Math.max(0, Math.min(100, Math.round(baseScore + optionalBonus + missingRequiredPenalty)));

      // 🛡️ TRAVA HARDWARE DE SEGURANÇA:
      // Se a LLM marcou isMatch como false (ex: desvio de função), forçamos teto de nota e reprovação.
      if (!llm.isMatch) {
        finalScore = Math.min(finalScore, 40);
      }

      const minScore = input.profile?.minScore ?? 75;
      const approved = finalScore >= minScore && Boolean(llm.isMatch);

      return {
        score: finalScore,
        approved,
        reason: llm.reason || (approved ? 'Vaga compatível com o perfil' : 'Pontuação insuficiente ou desalinhamento de papel'),
        metadata: {
          classification: llm.classification ?? { area: '', role: '', seniority: '' },
          matchedSkills: Array.isArray(llm.matchedSkills) ? llm.matchedSkills : [],
          missingSkills: Array.isArray(llm.missingSkills) ? llm.missingSkills : [],
          scoreBreakdown: llm.scoreBreakdown,
          llmRaw: llm
        }
      };
    } catch (error) {
      console.error('Erro crítico no ScoringPipeline:', error);
      return {
        score: 0,
        approved: false,
        reason: 'Erro interno no pipeline de scoring.',
        metadata: {
          classification: { area: '', role: '', seniority: '' },
          matchedSkills: [],
          missingSkills: []
        }
      };
    }
  }
}