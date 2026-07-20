// packages/scoring/src/llm/llmEvaluator.ts
import { generateObject } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import { z } from 'zod';
import type { JobEvaluationInput } from '@autojobs/shared';

const evaluationSchema = z.object({
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
  scoreBreakdown: z.record(z.number()).optional()
});

export type LlmEvaluationResult = z.infer<typeof evaluationSchema>;

export class LlmEvaluator {
  private readonly model: ReturnType<ReturnType<typeof createOpenAI>>;

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
    return `
Você é um avaliador técnico de carreira. Seu objetivo é comparar uma vaga com o perfil do candidato e retornar um objeto JSON estrito conforme o schema.
Seja rigoroso e objetivo. Classifique skills em "required" e "optional" quando possível.
Explique em uma frase a decisão no campo "reason".
Retorne campos: rawScore (0-100), isMatch (boolean), reason, classification, requiredSkillsFound, optionalSkillsFound, missingRequired, matchedSkills, missingSkills, scoreBreakdown.
`;
  }

  private buildUserPrompt(input: JobEvaluationInput): string {
    const profile = input.profile;
    const userContext = `
Candidato: ${profile.name}
Objetivos: ${profile.targetRoles?.join(', ') || ''}
Senioridade: ${profile.seniority?.join(', ') || ''}
Idiomas: ${JSON.stringify(profile.languages ?? {})}
Skills (skillMatrix): ${JSON.stringify(profile.skillMatrix ?? {})}
Restrições: ${profile.negativeKeywords?.join(', ') || ''}
Contexto: ${profile.aiApplicationContext ?? ''}
`;
    return `
VAGA
Título:
${input.title}

Descrição:
${input.description || ''}

PERFIL DO CANDIDATO
${userContext}

Instruções:
1) Identifique skills obrigatórias (required) e opcionais (optional) mencionadas na vaga.
2) Liste quais required foram encontradas e quais faltam.
3) Liste quais optional foram encontradas.
4) Gere um rawScore 0-100 baseado na compatibilidade.
5) Preencha scoreBreakdown com pesos por categoria.
6) Seja conciso.
`;
  }

  public async evaluate(input: JobEvaluationInput): Promise<LlmEvaluationResult> {
    const system = this.buildSystemPrompt();
    const user = this.buildUserPrompt(input);

    try {
      const { object } = await generateObject({
        model: this.model,
        system,
        prompt: user,
        schema: evaluationSchema
      });

      const parsed = evaluationSchema.safeParse(object);
      if (!parsed.success) {
        console.error('LLM schema mismatch', parsed.error);
        // fallback conservative result
        return {
          rawScore: 0,
          isMatch: false,
          reason: 'LLM returned invalid schema',
          classification: { area: '', role: '', seniority: '' },
          requiredSkillsFound: [],
          optionalSkillsFound: [],
          missingRequired: [],
          matchedSkills: [],
          missingSkills: [],
          scoreBreakdown: {}
        };
      }

      return parsed.data;
    } catch (error) {
      console.error('Erro crítico na avaliação LLM:', error);
      throw error;
    }
  }
}
