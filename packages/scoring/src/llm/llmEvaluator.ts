import { generateObject } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import { z } from 'zod';
import type { JobEvaluationInput, LlmEvaluationResult } from '@autojobs/shared';

const evaluationSchema = z.object({
  score: z.number().min(0).max(100),
  isMatch: z.boolean(),
  reason: z.string(),
  classification: z.object({
    area: z.string(),
    role: z.string(),
    seniority: z.string(),
  }),
  matchedSkills: z.array(z.string()),
  missingSkills: z.array(z.string()),
});

export class LlmEvaluator {
  private readonly model: ReturnType<ReturnType<typeof createOpenAI>>;

  constructor() {
    const customBaseUrl = process.env.LLM_API_URL
      ?.replace('/chat/completions', '');

    const provider = createOpenAI({
      baseURL: customBaseUrl,
      apiKey: process.env.LLM_API_KEY ?? '',
    });

    const modelName = process.env.LLM_MODEL ?? 'gpt-4o-mini';

    this.model = provider(modelName);

    console.log(
      `🤖 LLM Evaluator inicializado | modelo=${modelName} | provider=${
        customBaseUrl ?? 'openai'
      }`,
    );
  }

  public async evaluate(
    input: JobEvaluationInput,
  ): Promise<LlmEvaluationResult> {
    const { title, description, profile } = input;

    const userContext = `
Candidato: ${profile.name}
Objetivos: ${profile.targetRoles?.join(', ') || ''}
Senioridade: ${profile.seniority?.join(', ') || ''}
Idiomas: ${JSON.stringify(profile.languages ?? {})}
Skills: ${JSON.stringify(profile.skillMatrix ?? {})}
Restrições: ${profile.negativeKeywords?.join(', ') || ''}
Contexto: ${profile.aiApplicationContext ?? ''}
`;

    const systemPrompt = `
Você é um avaliador técnico de carreira.

Avalie a compatibilidade entre uma vaga e o perfil do candidato.
Seja rigoroso, evitando falsos positivos.
Considere senioridade, stack, experiência e requisitos obrigatórios.
`;

    const userPrompt = `
VAGA

Título:
${title}

Descrição:
${description}


PERFIL DO CANDIDATO

${userContext}
`;

    try {
      const { object } = await generateObject({
        model: this.model,
        system: systemPrompt,
        prompt: userPrompt,
        schema: evaluationSchema,
      });

      return object;
    } catch (error) {
      console.error(
        '🚨 Erro crítico na avaliação LLM:',
        error,
      );

      throw error;
    }
  }
}