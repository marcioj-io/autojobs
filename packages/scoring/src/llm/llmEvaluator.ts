// packages/scoring/src/llm/llmEvaluator.ts
import { generateObject } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import { z } from 'zod';
import type { JobEvaluationInput } from '@autojobs/shared';
import { normalizeText, fuzzyMatchAny } from '../utils/llmUtils';

/**
 * LlmEvaluator (versão final, clean)
 * - Recebe JobEvaluationInput e retorna LlmEvaluationResult conforme schema.
 * - Aceita negativeKeywords já normalizadas ou em formato livre; faz parsing leve e injeta no prompt.
 * - Validações menos sensíveis: tolerância maior para inconsistências de score.
 * - Re-prompt controlado com mensagens claras.
 */

const evaluationSchema = z.object({
  hrThoughtProcess: z.object({
    roleAnalysis: z.string(),
    transferableSkills: z.string(),
    careerRisks: z.string()
  }),
  rawScore: z.number().min(0).max(100),
  isMatch: z.boolean(),
  reason: z.string(),
  classification: z.object({
    area: z.string(),
    role: z.string(),
    seniority: z.string()
  }),
  requiredSkillsFound: z.array(z.string()),
  optionalSkillsFound: z.array(z.string()),
  missingRequired: z.array(z.string()),
  matchedSkills: z.array(z.string()),
  missingSkills: z.array(z.string()),
  scoreBreakdown: z.object({
    essentialMatches: z.number(),
    optionalMatches: z.number(),
    negativeKeywordsFound: z.number(),
    computedBase: z.number()
  })
});

export type LlmEvaluationResult = z.infer<typeof evaluationSchema>;

export class LlmEvaluator {
  private readonly model: ReturnType<ReturnType<typeof createOpenAI>>;
  private readonly maxAttempts = 3;

  constructor() {
    const customBaseUrl = process.env.LLM_API_URL?.replace('/chat/completions', '');
    const provider = createOpenAI({
      baseURL: customBaseUrl,
      apiKey: process.env.LLM_API_KEY ?? ''
    });
    const modelName = process.env.LLM_MODEL ?? 'gpt-4o-mini';
    this.model = provider(modelName);
  }

  private buildSystemPrompt(): string {
    const methodology = `
Você é um Headhunter Sênior. Retorne apenas JSON válido conforme o schema fornecido.
Regras obrigatórias:
1) Para cada skill em matchedSkills ou missingRequired inclua uma evidence (quote) extraída da descrição ou do perfil.
2) RoleAnalysis: 3 bullets conectando rotina da vaga aos objetivos do candidato.
3) TransferableSkills: liste 2-3 com justificativa.
4) CareerRisks: identifique até 3 riscos com justificativa.
5) ScoreBreakdown: essentialMatches, optionalMatches, negativeKeywordsFound, computedBase.
6) Explique numericamente a fórmula usada para rawScore (breve).
7) Use linguagem objetiva; retorne apenas JSON válido conforme schema.
`;
    return methodology.trim();
  }

  private buildUserPrompt(input: JobEvaluationInput): string {
    const profile = input.profile || ({} as any);
    const negativeKeywords = this.formatNegativeKeywords(profile.negativeKeywords || []);
    const essentials = this.extractEssentialSkills(profile);
    const optional = this.extractOptionalSkills(profile);

    return `
OPORTUNIDADE:
Título: ${input.title}
Descrição (resumo): ${(input.description || '').slice(0, 4000)}

PERFIL (resumo):
TargetRoles: ${Array.isArray(profile.targetRoles) ? profile.targetRoles.join(', ') : 'N/A'}
Seniority: ${Array.isArray(profile.seniority) ? profile.seniority.join(', ') : 'N/A'}
Essenciais (pré-processado): ${essentials.join(', ') || 'N/A'}
Opcionais (pré-processado): ${optional.join(', ') || 'N/A'}
NegativeKeywords (parsed): ${negativeKeywords || 'Nenhuma'}
Contexto adicional: ${(profile.aiApplicationContext || '').slice(0, 2000)}

INSTRUÇÃO:
Execute a avaliação completa e retorne apenas o JSON conforme o schema.
Cite evidências textuais (quotes) para cada matchedSkill. Se alguma evidência não existir, não inclua a skill em matchedSkills.
Explique brevemente a fórmula numérica usada para rawScore.
`.trim();
  }

  private formatNegativeKeywords(raw: any): string {
    // Aceita array de strings ou array de objetos { term, severity }
    try {
      if (!raw) return '';
      if (Array.isArray(raw)) {
        const mapped = raw.map((r) => {
          if (typeof r === 'string') return r;
          if (typeof r === 'object' && r.term) return `${r.term}${r.severity ? `:${r.severity}` : ''}`;
          return String(r);
        });
        return mapped.join(' | ');
      }
      if (typeof raw === 'string') return raw;
      return JSON.stringify(raw);
    } catch {
      return '';
    }
  }

  private extractEssentialSkills(profile: any): string[] {
    const matrix = profile?.skillMatrix ?? {};
    const essentials: string[] = [];

    for (const [_, v] of Object.entries(matrix)) {
      try {
        const tools = (v as any).tools || [];
        const level = String((v as any).level || '').toLowerCase();
        if (['especialista', 'avançado', 'advanced', 'expert'].includes(level)) {
          essentials.push(...tools.slice(0, 8));
        }
      } catch {
        // ignore
      }
    }

    const ctx = String(profile?.aiApplicationContext || '');
    const ctxTokens = ctx
      .split(/[\n\.,;|-]/)
      .map(s => s.trim())
      .filter(Boolean)
      .slice(0, 20);
    essentials.push(...ctxTokens);

    return Array.from(new Set(essentials)).slice(0, 60);
  }

  private extractOptionalSkills(profile: any): string[] {
    const matrix = profile?.skillMatrix ?? {};
    const optional: string[] = [];
    for (const [_, v] of Object.entries(matrix)) {
      try {
        const tools = (v as any).tools || [];
        optional.push(...tools.slice(8, 16));
      } catch {
        // ignore
      }
    }
    return Array.from(new Set(optional)).slice(0, 60);
  }

  private async callModel(system: string, user: string, attempt: number) {
    const params: any = {
      model: this.model,
      system,
      prompt: user,
      temperature: 0.12
    };

    const runtimeOptions = {
      maxTokens: 2000,
      topP: 0.95
    };

    const callPayload = {
      ...params,
      ...runtimeOptions,
      schema: evaluationSchema
    };

    return generateObject(callPayload as unknown as any);
  }

  private async postValidateAndMaybeReprompt(
    input: JobEvaluationInput,
    object: any
  ): Promise<LlmEvaluationResult> {
    const jobText = `${input.title}\n${input.description || ''}`;
    const profileText = `${input.profile?.aiApplicationContext || ''}\n${JSON.stringify(input.profile?.skillMatrix || {})}`;

    const roleAnalysis = object.hrThoughtProcess?.roleAnalysis || '';
    if (roleAnalysis.length < 90) {
      throw new Error('HR_THOUGHT_TOO_SHORT');
    }

    const matched: string[] = object.matchedSkills || [];
    const invalidMatches = matched.filter(s => !fuzzyMatchAny(s, [jobText, profileText]));
    if (invalidMatches.length > 0 && invalidMatches.length / Math.max(1, matched.length) > 0.5) {
      throw new Error('INVALID_MATCHES_TOO_MANY');
    }

    const sb = object.scoreBreakdown || {};
    const recomputed = (sb.essentialMatches || 0) * 20 + (sb.optionalMatches || 0) * 2 - (sb.negativeKeywordsFound || 0) * 15;
    const computedBase = Math.max(0, Math.min(100, Math.round(recomputed)));
    // tolerância aumentada para inconsistências
    if (Math.abs((object.rawScore || 0) - computedBase) > 20) {
      throw new Error('SCORE_INCONSISTENT');
    }

    return object as LlmEvaluationResult;
  }

  public async evaluate(input: JobEvaluationInput): Promise<LlmEvaluationResult> {
    const system = this.buildSystemPrompt();
    const user = this.buildUserPrompt(input);

    let lastError: any = null;
    const maxAttempts = this.maxAttempts;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const { object } = await this.callModel(system, user, attempt);
        const validated = await this.postValidateAndMaybeReprompt(input, object);
        return validated;
      } catch (err) {
        lastError = err;

        // backoff
        await new Promise((r) => setTimeout(r, 300 * attempt)).catch(() => {});

        // re-prompt strategies
        const errStr = String(err || '');
        if (errStr.includes('HR_THOUGHT_TOO_SHORT')) {
          const reSystem = system + '\n\nRE-RUN: Expanda roleAnalysis para pelo menos 3 bullets e inclua quotes como evidência.';
          try {
            const { object } = await generateObject({
              model: this.model,
              system: reSystem,
              prompt: user,
              temperature: 0.05,
              maxTokens: 2000,
              topP: 0.95,
              schema: evaluationSchema
            } as unknown as any);
            const validated = await this.postValidateAndMaybeReprompt(input, object);
            return validated;
          } catch (e) {
            lastError = e;
            continue;
          }
        }

        if (errStr.includes('INVALID_MATCHES_TOO_MANY') || errStr.includes('SCORE_INCONSISTENT')) {
          const reSystem = system + '\n\nRE-RUN: Use apenas skills com evidência textual direta. Recalcule scoreBreakdown e explique fórmula numérica.';
          try {
            const { object } = await generateObject({
              model: this.model,
              system: reSystem,
              prompt: user,
              temperature: 0.05,
              maxTokens: 2000,
              topP: 0.95,
              schema: evaluationSchema
            } as unknown as any);
            const validated = await this.postValidateAndMaybeReprompt(input, object);
            return validated;
          } catch (e) {
            lastError = e;
            continue;
          }
        }

        // continue loop for other transient errors
        continue;
      }
    }

    console.error('LLM Evaluator failed after attempts:', lastError);
    return {
      hrThoughtProcess: {
        roleAnalysis: 'Erro ao processar análise do perfil.',
        transferableSkills: 'N/A',
        careerRisks: 'Falha na avaliação de riscos.'
      },
      rawScore: 0,
      isMatch: false,
      reason: 'Falha no processamento do modelo de inteligência artificial.',
      classification: { area: 'Desconhecida', role: 'Desconhecido', seniority: 'Desconhecida' },
      requiredSkillsFound: [],
      optionalSkillsFound: [],
      missingRequired: [],
      matchedSkills: [],
      missingSkills: [],
      scoreBreakdown: { essentialMatches: 0, optionalMatches: 0, negativeKeywordsFound: 0, computedBase: 0 }
    };
  }
}
