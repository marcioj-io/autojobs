// packages/scoring/src/pipeline/scoringPipeline.ts
import type { JobEvaluationInput, ScoringResult } from '@autojobs/shared';
import { LlmEvaluator, LlmEvaluationResult } from '../llm/llmEvaluator';
import { PreFilterService, PreFilterResult } from '../filters/preFilter.service';
import { createHash } from 'crypto';
import { fuzzyMatchAny } from '../utils';

export class ScoringPipeline {
  private readonly llmEvaluator: LlmEvaluator;
  private readonly preFilterService: typeof PreFilterService;
  private readonly cache: Map<string, LlmEvaluationResult> | null;

  private readonly MIN_SCORE_DEFAULT = Number(process.env.MIN_SCORE_DEFAULT ?? 75);
  private readonly SOFT_REJECT_PENALTY = Number(process.env.SOFT_REJECT_PENALTY ?? 5);
  private readonly HIGH_CONF_OVERRIDE = Number(process.env.HIGH_CONF_OVERRIDE ?? 90);
  private readonly REVIEW_FLOOR = Number(process.env.REVIEW_FLOOR ?? 62);
  private readonly LLM_TIMEOUT_MS = Number(process.env.LLM_TIMEOUT_MS ?? 200000);
  private readonly LLM_CACHE_ENABLED = (process.env.LLM_CACHE_ENABLED === 'true');

  constructor(deps?: { llmEvaluator?: LlmEvaluator; preFilterService?: typeof PreFilterService }) {
    this.llmEvaluator = deps?.llmEvaluator ?? new LlmEvaluator();
    this.preFilterService = deps?.preFilterService ?? PreFilterService;
    this.cache = this.LLM_CACHE_ENABLED ? new Map() : null;
  }

  public async evaluate(input: JobEvaluationInput & { bypassPrefilter?: boolean }): Promise<ScoringResult> {
    try {
      // --- Fase 1: Pré-filtro
      const preFilter = this.runPrefilter(input);
      if (preFilter.action === 'reject') {
        return this.buildPrefilterReject(preFilter);
      }

      // --- Fase 2: Preparação de input
      const llmInput = this.prepareLlmInput(input);

      // --- Fase 3: Avaliação LLM
      const llm = await this.callLlmWithTimeoutAndCache(llmInput);

      // --- Fase 4: Validação de skills
      const { validatedMatched, falsePositives } = this.validateSkills(llm, input);
      const negativeKeywordMatches = this.findNegativeKeywordMatches(input);

      // --- Fase 5: Cálculo de score
      const computed = this.computeScore(llm, validatedMatched, falsePositives, negativeKeywordMatches);

      // --- Fase 6: Decisão final
      const approved = this.decideApproval({
        finalScore: computed.finalScore,
        llmIsMatch: Boolean(llm.isMatch),
        profileMin: input.profile?.minScore ?? this.MIN_SCORE_DEFAULT,
        preFilterAction: preFilter.action,
        bypassPrefilter: Boolean(input.bypassPrefilter),
        missingRequiredCount: Array.isArray(llm.missingRequired) ? llm.missingRequired.length : 0,
        llmFallback: Boolean((llm as any).llmFallback)
      });

      const result = this.buildResult(computed.finalScore, approved, llm, preFilter, validatedMatched, computed.breakdown, negativeKeywordMatches) as ScoringResult & { status?: string; error?: any };
      result.status = approved ? 'ok' : 'fail';

      // propagar erros do prefilter e do llm
      if ((preFilter as any)?._error) {
        result.metadata.preFilterError = (preFilter as any)._error;
        result.error = result.error ?? (preFilter as any)._error;
      }
      if ((llm as any)?._error) {
        result.metadata.llmError = (llm as any)._error;
        result.error = result.error ?? (llm as any)._error;
        if (!approved) result.status = 'error';
      }
      return result;
    } catch (error) {
      console.error('Erro crítico no ScoringPipeline:', error);
      return this.buildErrorResult();
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

  private prepareLlmInput(input: JobEvaluationInput): JobEvaluationInput {
    return {
      title: input.title,
      description: input.description,
      location: input.location,
      profile: {
        ...input.profile,
        // Evita enviar arrays vazios que possam confundir a LLM
        targetAreas: Array.isArray(input.profile?.targetAreas) && input.profile.targetAreas.length > 0
          ? input.profile.targetAreas
          : undefined
      } as any
    };
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
    } catch (err: any) {
      console.warn('[ScoringPipeline] LLM call failed or timed out:', (err as Error).message);
      llm = this.buildLlmFallback();
      (llm as any)._error = {
        message: err?.message ?? String(err),
        code: err?.message === 'LLM_TIMEOUT' ? 'LLM_TIMEOUT' : 'LLM_ERROR',
        errorBy: 'llm'
      };
    }


    if (promptKey && this.cache) {
      try { this.cache.set(promptKey, llm); } catch { /* ignorar erro de cache */ }
    }
    return llm;
  }

  private validateSkills(llm: LlmEvaluationResult, input: JobEvaluationInput) {
    const jobText = `${input.title}\n${input.description || ''}`;
    
    // Flatten da SkillMatrix: Extrai unicamente o texto das ferramentas para a validação fuzzy
    const profileSkills: string[] = [];
    if (input.profile?.skillMatrix) {
      for (const categoryData of Object.values(input.profile.skillMatrix)) {
        const tools = (categoryData as any)?.tools;
        if (Array.isArray(tools)) {
          profileSkills.push(...tools);
        }
      }
    }
    
    const contextText = input.profile?.aiApplicationContext || '';
    const profileText = `${contextText}\n${profileSkills.join(', ')}`;
    
    const rawMatched: string[] = Array.isArray(llm.matchedSkills) ? llm.matchedSkills : [];
    
    // Fuzzy match roda sobre uma base textual livre de chaves/brackets de JSON
    const validatedMatched = rawMatched.filter(s => fuzzyMatchAny(s, [jobText, profileText]));
    const falsePositives = rawMatched.filter(s => !validatedMatched.includes(s));
    
    return { validatedMatched, falsePositives };
  }

  private findNegativeKeywordMatches(input: JobEvaluationInput): string[] {
    const profile = (input as any).profile ?? {};
    const rawKeywords = Array.isArray(profile.negativeKeywords)
      ? profile.negativeKeywords
      : (typeof profile.negativeKeywords === 'string' ? profile.negativeKeywords.split(',') : []);

    const haystack = `${input.title ?? ''}\n${input.description ?? ''}`.toLowerCase();
    return rawKeywords
      .map((kw: unknown) => String(kw ?? '').trim())
      .filter(Boolean)
      .filter((kw: any) => {
        const normalized = kw.toLowerCase();
        return haystack.includes(normalized) || haystack.includes(normalized.replace(/\s+/g, ''));
      });
  }

  private computeScore(llm: LlmEvaluationResult, validatedMatched: string[], falsePositives: string[], negativeKeywordMatches: string[]) {
    const baseScore = typeof llm.rawScore === 'number' ? llm.rawScore : 0;
    const missingRequiredCount = Array.isArray(llm.missingRequired) ? llm.missingRequired.length : 0;
    const optionalFoundCount = Array.isArray(llm.optionalSkillsFound) ? llm.optionalSkillsFound.length : 0;
    const matchedCount = validatedMatched.length;
    const falsePositivesCount = falsePositives.length;

    const falsePositivePenalty = matchedCount >= 2 ? Math.round(2.5 * (falsePositivesCount / Math.max(1, matchedCount))) : 0;
    const missingRequiredPenalty = missingRequiredCount * 4;
    const optionalBonus = Math.min(8, optionalFoundCount * 1.5);
    const negativeKeywordPenalty = negativeKeywordMatches.length > 0 ? Math.min(12, Math.round(negativeKeywordMatches.length * 6)) : 0;

    const breakdown: Record<string, number> = {
      baseScore: Math.round(baseScore),
      optionalBonus,
      missingRequiredPenalty: -missingRequiredPenalty,
      falsePositivePenalty: -falsePositivePenalty,
      negativeKeywordPenalty: -negativeKeywordPenalty,
      matchedCount,
      falsePositivesCount,
      negativeKeywordMatches: negativeKeywordMatches.length
    };

    let adjusted = Math.round(baseScore + optionalBonus - missingRequiredPenalty - falsePositivePenalty - negativeKeywordPenalty);
    if (!llm.isMatch) adjusted = Math.max(0, adjusted - 6);

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
    llmFallback?: boolean;
  }): boolean {
    const { finalScore, llmIsMatch, profileMin, preFilterAction, bypassPrefilter, missingRequiredCount, llmFallback } = params;

    if (llmFallback) return false;

    let effectiveMin = profileMin;
    if (preFilterAction === 'soft_reject') {
      effectiveMin = Math.max(60, profileMin - this.SOFT_REJECT_PENALTY);
    }
    if (bypassPrefilter) effectiveMin = profileMin;

    const reviewFloor = Math.max(this.REVIEW_FLOOR, effectiveMin - 8);

    if (finalScore >= this.HIGH_CONF_OVERRIDE && missingRequiredCount === 0) return true;
    if (finalScore >= effectiveMin && llmIsMatch) return true;
    if (finalScore >= reviewFloor && llmIsMatch && missingRequiredCount <= 1) return true;

    return false;
  }

  private buildResult(finalScore: number, approved: boolean, llm: LlmEvaluationResult, preFilter: PreFilterResult, matched: string[], breakdown: Record<string, number>, negativeKeywordMatches: string[] = []): ScoringResult {
    return {
      score: finalScore,
      approved,
      reason: llm.reason || (approved ? 'Vaga compatível com o perfil' : 'Pontuação insuficiente ou desalinhamento de papel'),
      metadata: {
        preFilterAction: preFilter.action,
        preFilterReason: preFilter.reason,
        preFilterSource: preFilter.action && preFilter.action !== 'accept' ? 'prefilter' : 'system',
        classification: llm.classification ?? { area: '', role: '', seniority: '' },
        matchedSkills: matched,
        missingSkills: Array.isArray(llm.missingSkills) ? llm.missingSkills : [],
        scoreBreakdown: breakdown,
        negativeKeywordMatches,
        llmRaw: llm,
        llmRawSafe: {
          reason: llm.reason,
          rawScore: typeof llm.rawScore === 'number' ? llm.rawScore : 0,
          isMatch: Boolean(llm.isMatch),
          classification: llm.classification ?? { area: '', role: '', seniority: '' },
          matchedSkills: Array.isArray(llm.matchedSkills) ? llm.matchedSkills.slice(0, 50) : [],
          missingRequired: Array.isArray(llm.missingRequired) ? llm.missingRequired.slice(0, 10) : [],
          llmFallback: Boolean((llm as any).llmFallback),
          rawSnippet: JSON.stringify(llm).slice(0, 2000)
        },
        llmFallback: Boolean((llm as any).llmFallback)
      }
    };
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

  private buildErrorResult(): ScoringResult {
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

  private buildLlmFallback(): LlmEvaluationResult {
    const fallback: LlmEvaluationResult = {
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

    (fallback as any).llmFallback = true;
    return fallback;
  }

  private hashInput(input: JobEvaluationInput): string {
    try {
      const str = JSON.stringify({
        title: input.title,
        description: input.description ? input.description.slice(0, 2000) : '',
        profile: input.profile ? { id: input.profile.id ?? null, minScore: input.profile.minScore ?? null } : {}
      });
      return createHash('sha256').update(str).digest('hex');
    } catch {
      return String(Math.random());
    }
  }
}