import { generateObject } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import { z } from 'zod';
import type { JobEvaluationInput } from '@autojobs/shared';

const evaluationSchema = z.object({
  // Cadeia de Raciocínio (Força o LLM a pensar como RH antes de dar a nota)
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
    // Nota: Para precisão de RH em qualquer área do mercado, gpt-4o ou claude-3-5-sonnet são recomendados.
    const modelName = process.env.LLM_MODEL ?? 'gpt-4o-mini';
    this.model = provider(modelName);
  }

  private buildSystemPrompt(): string {
    return `
Você é um Headhunter Sênior e Especialista em Recrutamento e Seleção Global atuando na plataforma Autojobs.
Sua missão é avaliar a aderência real e profunda de qualquer profissional (TI, Saúde, Direito, Finanças, Marketing, Engenharia, etc.) a uma oportunidade de trabalho.

METODOLOGIA DE AVALIAÇÃO DE RH:
1. ANÁLISE DE ESSÊNCIA (Role Identity): Não se deixe enganar por palavras soltas em comum. Pergunte-se: "A rotina diária deste cargo atende aos objetivos de carreira deste candidato?"
2. COMPETÊNCIAS OBRIGATÓRIAS vs. DESEJÁVEIS: Separe o que é essencial para o dia 1 de trabalho do que pode ser aprendido no cargo.
3. RISCOS DE CARREIRA: Identifique se a vaga representa um desvio de função, retrocesso profissional ou desalinhamento com as preferências do candidato.
4. MATRIZ DE PONTUAÇÃO:
   - 0 - 40: Áreas funcionais incompatíveis ou risco alto de insatisfação profissional (isMatch = false).
   - 41 - 69: Mesma área, mas faltam requisitos obrigatórios cruciais (isMatch = false).
   - 70 - 84: Boa aderência, cobre a essência da função e requisitos principais (isMatch = true).
   - 85 - 100: Forte alinhamento de carreira, senioridade exata e grande sinergia técnica/cultural (isMatch = true).

Preencha obrigatoriamente a etapa 'hrThoughtProcess' antes de definir a nota final.
`;
  }

  private buildUserPrompt(input: JobEvaluationInput): string {
    const profile = input.profile;
    
    return `
OPORTUNIDADE DE EMPREGO:
Título da Vaga: ${input.title}
Descrição Completa:
${input.description || 'Descrição não informada.'}

PERFIL PROFISSIONAL DO CANDIDATO:
Nome: ${profile.name || 'Candidato'}
Objetivos de Carreira (Target Roles): ${profile.targetRoles?.join(', ') || 'Não especificado'}
Senioridade Alvo: ${profile.seniority?.join(', ') || 'Não especificada'}
Idiomas: ${JSON.stringify(profile.languages ?? {})}
Matriz de Competências / Skills: ${JSON.stringify(profile.skillMatrix ?? {})}
Restrições (Negative Keywords): ${profile.negativeKeywords?.join(', ') || 'Nenhuma'}
Contexto Adicional do Candidato: ${profile.aiApplicationContext ?? 'Nenhum'}

Execute a avaliação completa como um Especialista de RH e retorne o JSON estruturado.
`;
  }

  public async evaluate(input: JobEvaluationInput): Promise<LlmEvaluationResult> {
    try {
      const { object } = await generateObject({
        model: this.model,
        system: this.buildSystemPrompt(),
        prompt: this.buildUserPrompt(input),
        schema: evaluationSchema
      });

      return object;
    } catch (error) {
      console.error('Erro na avaliação do LLM Evaluator:', error);
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
        scoreBreakdown: {}
      };
    }
  }
}