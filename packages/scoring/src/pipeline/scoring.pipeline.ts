import type { JobEvaluationInput } from '@autojobs/shared';
import { LlmEvaluator } from '../llm/llmEvaluator';
import { PreFilterService } from '../filters/preFilter.service';

export class ScoringPipeline {
  private llmEvaluator: LlmEvaluator;

  constructor() {
    this.llmEvaluator = new LlmEvaluator();
  }

  public async evaluate(input: any) {
    try {
      // 1. Normaliza os dados
      const normalizedInput: JobEvaluationInput = {
        title: input.title,
        description: input.description || input.jobDescription, 
        location: input.location,
        profile: input.profile
      };

      // 2. PASSA PELO PRÉ-FILTRO (Custo Zero, Execução Instantânea)
      const preFilterResult = PreFilterService.evaluate(normalizedInput);
      if (!preFilterResult.passed) {
        console.log(`[ScoringPipeline] Vaga descartada no Pré-Filtro: ${normalizedInput.title}`);
        return {
          score: 0,
          reason: preFilterResult.reason || 'Descartado no pré-filtro.',
          approved: false
        };
      }

      // 3. SE PASSOU, CHAMA A INTELIGÊNCIA (LLM)
      const result = await this.llmEvaluator.evaluate(normalizedInput);

      return {
        score: result.score,
        reason: result.reason,
        approved: result.isMatch,
        metadata: {
          classification: result.classification,
          matched: result.matchedSkills,
          missing: result.missingSkills
        }
      };
    } catch (error) {
      console.error("Erro no ScoringPipeline:", error);
      return {
        score: 0,
        reason: "Erro no pipeline de scoring.",
        approved: false
      };
    }
  }
}