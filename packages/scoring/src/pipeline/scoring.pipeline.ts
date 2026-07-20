// packages/scoring/src/pipeline/scoring.pipeline.ts
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
      const preFilter = PreFilterService.evaluate(input);
      if (!preFilter.passed) {
        return {
          score: 0,
          approved: false,
          reason: preFilter.reason || 'Descartado no pré-filtro',
          metadata: {
            classification: { area: '', role: '', seniority: '' },
            matchedSkills: [],
            missingSkills: []
          }
        };
      }

      const llm = await this.llmEvaluator.evaluate(input);

      // Deterministic scoring rules
      const base = llm.rawScore ?? 0;
      const missingRequiredCount = (llm.missingRequired?.length || 0);
      const optionalFoundCount = (llm.optionalSkillsFound?.length || 0);

      // Weights: each missing required -1, each optional present +2
      const requiredPenalty = missingRequiredCount * -1;
      const optionalBonus = optionalFoundCount * 2;

      const finalScore = Math.max(0, Math.min(100, Math.round(base + optionalBonus + requiredPenalty)));

      const minScore = (input.profile.minScore ?? 75);
      const approved = finalScore >= minScore && llm.isMatch;

      const reason = llm.reason || (approved ? 'Aprovado pelo pipeline' : 'Rejeitado pelo pipeline');

      return {
        score: finalScore,
        approved,
        reason,
        metadata: {
          classification: llm.classification,
          matchedSkills: llm.matchedSkills || [],
          missingSkills: llm.missingSkills || [],
          scoreBreakdown: llm.scoreBreakdown,
          llmRaw: llm
        }
      };
    } catch (error) {
      console.error('Erro no ScoringPipeline:', error);
      return {
        score: 0,
        approved: false,
        reason: 'Erro no pipeline de scoring',
        metadata: {
          classification: { area: '', role: '', seniority: '' },
          matchedSkills: [],
          missingSkills: []
        }
      };
    }
  }
}
