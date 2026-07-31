// packages/scoring/src/pipeline/scoringPipeline.ts
import type { JobEvaluationInput } from '@autojobs/shared';
import { LlmEvaluator } from '../llm/llmEvaluator';
import { PreFilterService } from '../filters/preFilter.service';
import { fuzzyMatchAny } from '../utils/llmUtils';

export interface ScoringResult {
  score: number;
  approved: boolean;
  reason: string;
  metadata: {
    preFilterAction: 'accept' | 'soft_reject' | 'reject';
    preFilterReason?: string;
    preFilterSource?: 'prefilter' | 'system';
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

  /**
   * Evaluate a job input.
   * - If prefilter returns action 'reject' => immediate reject.
   * - If prefilter returns 'soft_reject' => still call LLM for contextual decision.
   * - If input.bypassPrefilter === true => skip prefilter entirely.
   * - targetAreas are ignored when empty.
   */
  public async evaluate(input: JobEvaluationInput & { bypassPrefilter?: boolean }): Promise<ScoringResult> {
    try {
      // 1) PreFilter (can be bypassed)
      let preFilter = { passed: true, reason: 'Bypass prefilter', action: 'accept' as 'accept' | 'soft_reject' | 'reject' };

      if (!input.bypassPrefilter) {
        const raw = PreFilterService.evaluate(input) as any;
        preFilter = {
          passed: Boolean(raw?.passed),
          reason: typeof raw?.reason === 'string' ? raw.reason : '',
          action: raw?.action === 'soft_reject' || raw?.action === 'reject' ? raw.action : 'accept'
        };
      }

      // If preFilter explicitly rejects -> stop early and return structured result
      if (!preFilter.passed && preFilter.action === 'reject') {
        return {
          score: 0,
          approved: false,
          reason: preFilter.reason || 'Descartado no pré-filtro.',
          metadata: {
            preFilterAction: 'reject',
            preFilterReason: preFilter.reason,
            preFilterSource: 'prefilter',
            classification: { area: '', role: '', seniority: '' },
            matchedSkills: [],
            missingSkills: []
          }
        };
      }

      // 2) Call LLM in all other cases (accept or soft_reject or bypass)
      // Build input for LLM: ensure we do not include targetAreas when empty
      const llmInput: JobEvaluationInput = {
        title: input.title,
        description: input.description,
        location: input.location,
        profile: {
          ...input.profile,
          // ensure targetAreas is an array; if empty, remove to avoid influencing prompt
          targetAreas: Array.isArray(input.profile?.targetAreas) && input.profile.targetAreas.length > 0 ? input.profile.targetAreas : []
        }
      } as any;

      const llm = await this.llmEvaluator.evaluate(llmInput);

      // 3) Validate matched skills against job/profile text
      const jobText = `${input.title}\n${input.description || ''}`;
      const profileText = `${input.profile?.aiApplicationContext || ''}\n${JSON.stringify(input.profile?.skillMatrix || {})}`;
      const validatedMatched = (llm.matchedSkills || []).filter(s => fuzzyMatchAny(s, [jobText, profileText]));
      const falsePositives = (llm.matchedSkills || []).filter(s => !validatedMatched.includes(s));

      if (falsePositives.length > 0 && falsePositives.length / Math.max(1, (llm.matchedSkills || []).length) > 0.3) {
        // penalize rawScore when many false positives
        llm.rawScore = Math.max(0, (llm.rawScore || 0) - 10);
      }

      // 4) Compute final score with deterministic adjustments
      const baseScore = typeof llm.rawScore === 'number' ? llm.rawScore : 0;
      const missingRequiredPenalty = (llm.missingRequired?.length || 0) * -10;
      const optionalBonus = (llm.optionalSkillsFound?.length || 0) * 2;
      let finalScore = Math.max(0, Math.min(100, Math.round(baseScore + optionalBonus + missingRequiredPenalty)));

      // If LLM explicitly says not a match, cap score to 40 (keeps LLM veto power)
      if (!llm.isMatch) {
        finalScore = Math.min(finalScore, 40);
      }

      // 5) Approval logic
      const profileMin = input.profile?.minScore ?? 75;

      // If preFilter flagged soft_reject, relax threshold slightly but require LLM positive signal
      let effectiveMin = profileMin;
      if (preFilter.action === 'soft_reject') {
        effectiveMin = Math.max(60, profileMin - 10);
      }

      if (input.bypassPrefilter) effectiveMin = profileMin;

      const approved = finalScore >= effectiveMin && Boolean(llm.isMatch);

      // 6) Return structured result with metadata (including preFilter info and raw LLM output)
      return {
        score: finalScore,
        approved,
        reason: llm.reason || (approved ? 'Vaga compatível com o perfil' : 'Pontuação insuficiente ou desalinhamento de papel'),
        metadata: {
          preFilterAction: preFilter.action,
          preFilterReason: preFilter.reason,
          preFilterSource: preFilter.action && preFilter.action !== 'accept' ? 'prefilter' : 'system',
          classification: llm.classification ?? { area: '', role: '', seniority: '' },
          matchedSkills: validatedMatched,
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
          preFilterAction: 'reject',
          preFilterReason: 'Erro interno',
          preFilterSource: 'system',
          classification: { area: '', role: '', seniority: '' },
          matchedSkills: [],
          missingSkills: []
        }
      };
    }
  }
}
