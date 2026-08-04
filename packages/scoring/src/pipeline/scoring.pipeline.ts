// packages/scoring/src/pipeline/scoringPipeline.ts
import type { JobEvaluationInput } from '@autojobs/shared';
import { LlmEvaluator, LlmEvaluationResult } from '../llm/llmEvaluator';
import { PreFilterService, PreFilterResult } from '../filters/preFilter.service';
import crypto from 'crypto';
import { fuzzyMatchAny } from '../utils';

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
  private preFilterService: typeof PreFilterService;
  private cache: Map<string, LlmEvaluationResult> | null = null;

  // Configurable thresholds via env
  private readonly MIN_SCORE_DEFAULT = Number(process.env.MIN_SCORE_DEFAULT ?? 75);
  private readonly SOFT_REJECT_PENALTY = Number(process.env.SOFT_REJECT_PENALTY ?? 5);
  private readonly HIGH_CONF_OVERRIDE = Number(process.env.HIGH_CONF_OVERRIDE ?? 90);
  private readonly LLM_TIMEOUT_MS = Number(process.env.LLM_TIMEOUT_MS ?? 30000);
  // private readonly LLM_CACHE_ENABLED = (process.env.LLM_CACHE_ENABLED ?? 'false') === 'true';
  private readonly LLM_CACHE_ENABLED = false;

  constructor(deps?: { llmEvaluator?: LlmEvaluator; preFilterService?: typeof PreFilterService }) {
    this.llmEvaluator = deps?.llmEvaluator ?? new LlmEvaluator();
    this.preFilterService = deps?.preFilterService ?? PreFilterService;
    if (this.LLM_CACHE_ENABLED) this.cache = new Map();
  }

  /**
   * Evaluate a job input and return a structured ScoringResult.
   * - prefilter can be bypassed with input.bypassPrefilter === true
   * - soft_reject from prefilter relaxes threshold slightly but does not remove LLM signal
   */
  public async evaluate(input: JobEvaluationInput & { bypassPrefilter?: boolean }): Promise<ScoringResult> {
    try {
      // 1) Run prefilter (unless bypassed)
      const preFilter = this.runPrefilter(input);

      if (!preFilter.passed && preFilter.action === 'reject') {
        return this.buildPrefilterReject(preFilter);
      }

      // 2) Prepare LLM input (avoid sending empty targetAreas)
      const llmInput: JobEvaluationInput = {
        title: input.title,
        description: input.description,
        location: input.location,
        profile: {
          ...input.profile,
          targetAreas: Array.isArray(input.profile?.targetAreas) && input.profile.targetAreas.length > 0
            ? input.profile.targetAreas
            : undefined
        } as any
      } as any;

      // 3) Call LLM with timeout + optional cache
      const llm = await this.callLlmWithTimeoutAndCache(llmInput);

      // 4) Validate matched skills against job/profile text
      const jobText = `${input.title}\n${input.description || ''}`;
      const profileText = `${input.profile?.aiApplicationContext || ''}\n${JSON.stringify(input.profile?.skillMatrix || {})}`;
      const rawMatched: string[] = Array.isArray(llm.matchedSkills) ? llm.matchedSkills : [];
      const validatedMatched = rawMatched.filter(s => fuzzyMatchAny(s, [jobText, profileText]));
      const falsePositives = rawMatched.filter(s => !validatedMatched.includes(s));

      // 5) Compute score with deterministic adjustments and breakdown
      const computed = this.computeScore(llm, validatedMatched, falsePositives);

      // 6) Decide approval based on effective threshold, LLM signal and high-confidence override
      const missingRequiredCount = Array.isArray(llm.missingRequired) ? llm.missingRequired.length : 0;
      const approved = this.decideApproval({
        finalScore: computed.finalScore,
        llmIsMatch: Boolean(llm.isMatch),
        profileMin: input.profile?.minScore ?? this.MIN_SCORE_DEFAULT,
        preFilterAction: preFilter.action,
        bypassPrefilter: Boolean(input.bypassPrefilter),
        missingRequiredCount
      });

      // 7) Build structured result
      return {
        score: computed.finalScore,
        approved,
        reason: llm.reason || (approved ? 'Vaga compatível com o perfil' : 'Pontuação insuficiente ou desalinhamento de papel'),
        metadata: {
          preFilterAction: preFilter.action,
          preFilterReason: preFilter.reason,
          preFilterSource: preFilter.action && preFilter.action !== 'accept' ? 'prefilter' : 'system',
          classification: llm.classification ?? { area: '', role: '', seniority: '' },
          matchedSkills: validatedMatched,
          missingSkills: Array.isArray(llm.missingSkills) ? llm.missingSkills : [],
          scoreBreakdown: computed.breakdown,
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

  // --- Helpers

  private runPrefilter(input: JobEvaluationInput & { bypassPrefilter?: boolean }): PreFilterResult {
    if (input.bypassPrefilter) {
      return { passed: true, action: 'accept', matchedKeywords: [] };
    }
    try {
      return this.preFilterService.evaluate(input as any) as PreFilterResult;
    } catch (err) {
      console.warn('[ScoringPipeline] Prefilter falhou, prosseguindo com LLM', err);
      return { passed: true, action: 'accept', matchedKeywords: [], reason: 'Prefilter failure, fallback to LLM' };
    }
  }

  private async callLlmWithTimeoutAndCache(llmInput: JobEvaluationInput): Promise<LlmEvaluationResult> {
    const promptKey = this.LLM_CACHE_ENABLED ? this.hashInput(llmInput) : null;
    if (promptKey && this.cache?.has(promptKey)) {
      return this.cache.get(promptKey)!;
    }

    const call = this.llmEvaluator.evaluate(llmInput);
    const timeout = new Promise<LlmEvaluationResult>((_, rej) =>
      setTimeout(() => rej(new Error('LLM_TIMEOUT')), this.LLM_TIMEOUT_MS)
    );

    let llm: LlmEvaluationResult;
    try {
      llm = await Promise.race([call, timeout]) as LlmEvaluationResult;
    } catch (err) {
      console.warn('[ScoringPipeline] LLM call failed or timed out:', (err as Error).message);
      // fallback conservative result
      llm = {
        hrThoughtProcess: { roleAnalysis: 'N/A', transferableSkills: 'N/A', careerRisks: 'N/A' },
        rawScore: 0,
        isMatch: false,
        reason: 'Fallback por timeout/erro do LLM',
        classification: { area: 'Desconhecida', role: 'Desconhecido', seniority: 'Desconhecida' },
        requiredSkillsFound: [],
        optionalSkillsFound: [],
        missingRequired: [],
        matchedSkills: [],
        missingSkills: [],
        scoreBreakdown: {}
      } as LlmEvaluationResult;
    }

    if (promptKey && this.cache) {
      try { this.cache.set(promptKey, llm); } catch { /* ignore cache errors */ }
    }

    return llm;
  }

  private computeScore(llm: LlmEvaluationResult, validatedMatched: string[], falsePositives: string[]) {
    const baseScore = typeof llm.rawScore === 'number' ? llm.rawScore : 0;
    const missingRequiredCount = Array.isArray(llm.missingRequired) ? llm.missingRequired.length : 0;
    const optionalFoundCount = Array.isArray(llm.optionalSkillsFound) ? llm.optionalSkillsFound.length : 0;
    const matchedCount = Array.isArray(llm.matchedSkills) ? llm.matchedSkills.length : 0;
    const falsePositivesCount = falsePositives.length;

    // false positive penalty: apply only when there are enough matched skills to be meaningful
    const falsePositivePenalty = matchedCount >= 3 ? Math.round(5 * (falsePositivesCount / Math.max(1, matchedCount))) : 0;

    // missing required penalty: stronger weight
    const missingRequiredPenalty = missingRequiredCount * 12;
    const optionalBonus = optionalFoundCount * 2;

    const breakdown: Record<string, number> = {
      baseScore: Math.round(baseScore),
      optionalBonus,
      missingRequiredPenalty: -missingRequiredPenalty,
      falsePositivePenalty: -falsePositivePenalty,
      matchedCount,
      falsePositivesCount
    };

    let adjusted = Math.round(baseScore + optionalBonus - missingRequiredPenalty - falsePositivePenalty);

    // If LLM explicitly says not a match, cap to a less aggressive value (not zero)
    if (!llm.isMatch) adjusted = Math.min(adjusted, 60);

    const finalScore = Math.max(0, Math.min(100, adjusted));
    return { finalScore, breakdown };
  }

  private decideApproval(params: {
    finalScore: number;
    llmIsMatch: boolean;
    profileMin: number;
    preFilterAction: 'accept' | 'soft_reject' | 'reject';
    bypassPrefilter: boolean;
    missingRequiredCount: number;
  }): boolean {
    const { finalScore, llmIsMatch, profileMin, preFilterAction, bypassPrefilter, missingRequiredCount } = params;

    let effectiveMin = profileMin;
    if (preFilterAction === 'soft_reject') {
      effectiveMin = Math.max(60, profileMin - this.SOFT_REJECT_PENALTY);
    }
    if (bypassPrefilter) effectiveMin = profileMin;

    // High-confidence override: very high score and no missing required skills
    if (finalScore >= this.HIGH_CONF_OVERRIDE && missingRequiredCount === 0) {
      return true;
    }

    // Primary rule: must reach threshold and have positive LLM signal
    if (finalScore >= effectiveMin && llmIsMatch) return true;

    return false;
  }

  private buildPrefilterReject(pref: PreFilterResult): ScoringResult {
    return {
      score: 0,
      approved: false,
      reason: pref.reason || 'Descartado no pré-filtro.',
      metadata: {
        preFilterAction: 'reject',
        preFilterReason: pref.reason,
        preFilterSource: 'prefilter',
        classification: { area: '', role: '', seniority: '' },
        matchedSkills: [],
        missingSkills: []
      }
    };
  }

  private hashInput(input: JobEvaluationInput): string {
    try {
      const str = JSON.stringify({
        title: input.title,
        description: input.description ? input.description.slice(0, 2000) : '',
        profile: input.profile ? { id: input.profile.id ?? null, minScore: input.profile.minScore ?? null } : {}
      });
      return crypto.createHash('sha256').update(str).digest('hex');
    } catch {
      return String(Math.random());
    }
  }
}
