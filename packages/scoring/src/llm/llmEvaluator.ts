// packages/scoring/src/llm/llmEvaluator.ts
import { generateObject } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import { z } from 'zod';
import type { JobEvaluationInput } from '@autojobs/shared';
import { normalizeText, fuzzyMatchAny } from '../utils/llmUtils';

const evaluationSchema = z.object({
  hrThoughtProcess: z.object({
    roleAnalysis: z.string().describe('Análise do papel funcional real da vaga versus os objetivos do candidato.'),
    transferableSkills: z.string().describe('Competências transversais/transferíveis identificadas.'),
    careerRisks: z.string().describe('Riscos de desvio de função, subqualificação ou superqualificação.')
  }),
  rawScore: z.number().min(0).max(100).describe('Nota final de compatibilidade de 0 a 100.'),
  isMatch: z.boolean().describe('Verdadeiro se a vaga for recomendada para candidatura.'),
  reason: z.string().describe('Justificativa resumida da decisão (máximo 2 frases).'),
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
  private readonly maxAttempts = 2;

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
    const fewShotHigh = `EXEMPLO_ALTO:
INPUT:
Título: Coordenador de Operações
Descrição: Gestão de equipes, melhoria de processos, indicadores de desempenho, comunicação com stakeholders.
Perfil: Gestão de operações; melhoria contínua; liderança; 5 anos.
OUTPUT_JSON:
{
  "hrThoughtProcess": {
    "roleAnalysis": "A rotina da vaga envolve coordenação operacional e gestão de indicadores, alinhada ao objetivo do candidato de atuar em liderança operacional.",
    "transferableSkills": "Liderança, gestão de processos, comunicação com stakeholders.",
    "careerRisks": "Baixo risco; seniority e responsabilidades compatíveis."
  },
  "rawScore": 92,
  "isMatch": true,
  "reason": "Alto alinhamento de responsabilidades e senioridade.",
  "classification": {"area":"Operações","role":"Coordenador","seniority":"Pleno"},
  "requiredSkillsFound":["Gestão de equipes","Melhoria de processos","KPI"],
  "optionalSkillsFound":["Comunicação com stakeholders"],
  "missingRequired":[],
  "matchedSkills":["Gestão de equipes","Melhoria de processos","KPI","Comunicação com stakeholders"],
  "missingSkills":[],
  "scoreBreakdown":{"essentialMatches":3,"optionalMatches":1,"negativeKeywordsFound":0,"computedBase":90}
}`;

    const fewShotLow = `EXEMPLO_BAIXO:
INPUT:
Título: Assistente de Atendimento ao Cliente
Descrição: Atendimento telefônico, registro de chamados, suporte básico.
Perfil: Especialista em análise de dados; 6 anos; busca posição sênior.
OUTPUT_JSON:
{
  "hrThoughtProcess": {
    "roleAnalysis": "A vaga é operacional e de atendimento; não corresponde ao objetivo do candidato que busca posição analítica sênior.",
    "transferableSkills": "Comunicação e registro de informações são parcialmente transferíveis.",
    "careerRisks": "Alto risco de desalinhamento de carreira e insatisfação."
  },
  "rawScore": 22,
  "isMatch": false,
  "reason": "Mismatch de área funcional e senioridade.",
  "classification": {"area":"Atendimento","role":"Assistente","seniority":"Júnior"},
  "requiredSkillsFound":["Atendimento telefônico"],
  "optionalSkillsFound":[],
  "missingRequired":["Análise de dados","Liderança"],
  "matchedSkills":["Atendimento telefônico"],
  "missingSkills":["Análise de dados","Liderança"],
  "scoreBreakdown":{"essentialMatches":1,"optionalMatches":0,"negativeKeywordsFound":0,"computedBase":20}
}`;

    const methodology = `
Você é um Headhunter Sênior. Siga estritamente o formato JSON do schema fornecido.
Regras obrigatórias antes de emitir rawScore:
1) Evidence Table: para cada skill listada em matchedSkills ou missingRequired, inclua evidence (quote) extraída da descrição ou do perfil.
2) RoleAnalysis: 3 bullets conectando rotina da vaga aos objetivos do candidato.
3) TransferableSkills: liste 2-3 com justificativa.
4) CareerRisks: identifique até 3 riscos com justificativa.
5) ScoreBreakdown: essentialMatches, optionalMatches, negativeKeywordsFound, computedBase (número antes de ajustes).
6) Explique numericamente a fórmula usada para rawScore.
7) Use linguagem objetiva; retorne apenas JSON válido conforme schema.
`;

    return `${fewShotHigh}\n\n${fewShotLow}\n\n${methodology}`;
  }

  private buildUserPrompt(input: JobEvaluationInput): string {
    const profile = input.profile;
    const essentials = this.extractEssentialSkills(profile);
    const optional = this.extractOptionalSkills(profile);

    return `
OPORTUNIDADE:
Título: ${input.title}
Descrição (resumo): ${(input.description || '').slice(0, 4000)}

PERFIL (resumo):
TargetRoles: ${profile.targetRoles?.join(', ') || 'N/A'}
Seniority: ${profile.seniority?.join(', ') || 'N/A'}
Essenciais (pré-processado): ${essentials.join(', ') || 'N/A'}
Opcionais (pré-processado): ${optional.join(', ') || 'N/A'}
NegativeKeywords: ${profile.negativeKeywords?.join(', ') || 'Nenhuma'}
Contexto adicional: ${(profile.aiApplicationContext || '').slice(0, 2000)}

INSTRUÇÃO:
Execute a avaliação completa e retorne apenas o JSON conforme o schema. Cite evidências textuais (quotes) para cada matchedSkill. Se alguma evidência não existir, não inclua a skill em matchedSkills.
`;
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
    // Parâmetros compatíveis com typing
    const params: any = {
      model: this.model,
      system,
      prompt: user,
      temperature: 0.12
    };

    // Opções extras que o runtime pode aceitar, mas que o typing local pode não expor
    const runtimeOptions = {
      maxTokens: 2000,
      topP: 0.95
    };

    const callPayload = {
      ...params,
      ...runtimeOptions,
      schema: evaluationSchema
    };

    // Cast localizado para contornar typing do SDK apenas aqui
    return generateObject(callPayload as unknown as any);
  }

  private async postValidateAndMaybeReprompt(
    input: JobEvaluationInput,
    object: any
  ): Promise<LlmEvaluationResult> {
    const jobText = `${input.title}\n${input.description || ''}`;
    const profileText = `${input.profile?.aiApplicationContext || ''}\n${JSON.stringify(input.profile?.skillMatrix || {})}`;

    const roleAnalysis = object.hrThoughtProcess?.roleAnalysis || '';
    if (roleAnalysis.length < 120) {
      throw new Error('HR_THOUGHT_TOO_SHORT');
    }

    const matched: string[] = object.matchedSkills || [];
    const invalidMatches = matched.filter(s => !fuzzyMatchAny(s, [jobText, profileText]));
    if (invalidMatches.length > 0 && invalidMatches.length / Math.max(1, matched.length) > 0.3) {
      throw new Error('INVALID_MATCHES_TOO_MANY');
    }

    const sb = object.scoreBreakdown || {};
    const recomputed = (sb.essentialMatches || 0) * 20 + (sb.optionalMatches || 0) * 2 - (sb.negativeKeywordsFound || 0) * 15;
    const computedBase = Math.max(0, Math.min(100, Math.round(recomputed)));
    if (Math.abs((object.rawScore || 0) - computedBase) > 15) {
      throw new Error('SCORE_INCONSISTENT');
    }

    return object as LlmEvaluationResult;
  }

  public async evaluate(input: JobEvaluationInput): Promise<LlmEvaluationResult> {
    const system = this.buildSystemPrompt();
    const user = this.buildUserPrompt(input);

    let lastError: any = null;
    for (let attempt = 1; attempt <= this.maxAttempts; attempt++) {
      try {
        const { object } = await this.callModel(system, user, attempt);
        const validated = await this.postValidateAndMaybeReprompt(input, object);
        return validated;
      } catch (err) {
        lastError = err;
        // Re-prompt strategies using localized cast payloads
        if (String(err).includes('HR_THOUGHT_TOO_SHORT')) {
          const reSystem = system + '\n\nRE-RUN: Expanda roleAnalysis para pelo menos 3 frases e inclua quotes como evidência.';
          const rePayload = {
            model: this.model,
            system: reSystem,
            prompt: user,
            temperature: 0.05,
            maxTokens: 2000,
            topP: 0.95,
            schema: evaluationSchema
          };
          try {
            const { object } = await generateObject(rePayload as unknown as any);
            const validated = await this.postValidateAndMaybeReprompt(input, object);
            return validated;
          } catch (e) {
            lastError = e;
            continue;
          }
        }

        if (String(err).includes('INVALID_MATCHES_TOO_MANY') || String(err).includes('SCORE_INCONSISTENT')) {
          const reSystem = system + '\n\nRE-RUN: Use apenas skills com evidência textual direta. Recalcule scoreBreakdown e explique fórmula numérica.';
          const rePayload = {
            model: this.model,
            system: reSystem,
            prompt: user,
            temperature: 0.05,
            maxTokens: 2000,
            topP: 0.95,
            schema: evaluationSchema
          };
          try {
            const { object } = await generateObject(rePayload as unknown as any);
            const validated = await this.postValidateAndMaybeReprompt(input, object);
            return validated;
          } catch (e) {
            lastError = e;
            continue;
          }
        }

        // fallback: try again (loop will continue)
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
