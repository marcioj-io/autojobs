import { z } from 'zod';

// Contrato blindado de resposta da IA
export const LlmEvaluationSchema = z.object({
  score: z.number(),
  is_match: z.boolean(),
  reason: z.string()
});

export type LlmEvaluation = z.infer<typeof LlmEvaluationSchema>;

export interface LlmProfileInput {
  seniority: string;
  keywords: string;
  negativeKeywords: string;
  searches: string;
  minScore: number;
}

export class LlmEvaluator {
  private apiUrl: string;
  private model: string;

  private readonly MAX_RETRIES = 2;
  private readonly TIMEOUT_MS = 15000;

  constructor() {
    this.apiUrl =
      process.env.LLM_API_URL ||
      'http://localhost:11434/v1/chat/completions';

    this.model =
      process.env.LLM_MODEL ||
      'llama3';
  }

  public async evaluate(
    jobTitle: string,
    jobDescription: string,
    profileDefinition: LlmProfileInput
  ): Promise<LlmEvaluation> {

    const cleanDescription = this.sanitizeText(jobDescription);

    const systemPrompt =
      this.buildSystemPrompt(profileDefinition);

    const headers: Record<string, string> = {
      'Content-Type': 'application/json'
    };

    if (
      process.env.LLM_API_KEY &&
      process.env.LLM_API_KEY !== 'local-no-key-needed'
    ) {
      headers['Authorization'] =
        `Bearer ${process.env.LLM_API_KEY}`;
    }

    const payload = {
      model: this.model,
      response_format: {
        type: "json_object"
      },
      messages: [
        {
          role: 'system',
          content: systemPrompt
        },
        {
          role: 'user',
          content:
            `VAGA A SER AVALIADA:\n\nTítulo: ${jobTitle}\nDescrição: ${cleanDescription}`
        }
      ],
      temperature: 0.1
    };

    return this.fetchWithResilience(
      headers,
      payload
    );
  }

  private async fetchWithResilience(
    headers: Record<string, string>,
    payload: any,
    attempt = 1
  ): Promise<LlmEvaluation> {

    try {
      const controller = new AbortController();

      const timeoutId = setTimeout(
        () => controller.abort(),
        this.TIMEOUT_MS
      );

      const response = await fetch(
        this.apiUrl,
        {
          method: 'POST',
          headers,
          body: JSON.stringify(payload),
          signal: controller.signal
        }
      );

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();

        throw new Error(
          `HTTP ${response.status}: ${errorText}`
        );
      }

      const data = await response.json();

      const parsedData =
        JSON.parse(
          data.choices[0].message.content
        );

      return LlmEvaluationSchema.parse(
        parsedData
      );

    } catch (error: any) {

      const isNetworkError =
        error.name === 'AbortError' ||
        error.code === 'ECONNREFUSED' ||
        error.message.includes('fetch failed');

      if (
        isNetworkError &&
        attempt <= this.MAX_RETRIES
      ) {

        console.warn(
          `[LLM] Falha tentativa ${attempt}. Retentando em 2s... ${error.message}`
        );

        await new Promise(resolve =>
          setTimeout(resolve, 2000)
        );

        return this.fetchWithResilience(
          headers,
          payload,
          attempt + 1
        );
      }

      console.error(
        `[LLM] Falha definitiva após ${attempt} tentativas:`,
        error.message
      );

      return {
        score: 0,
        is_match: false,
        reason:
          'Erro de comunicação com o LLM: ' +
          error.message
      };
    }
  }

  private buildSystemPrompt(
    profile: LlmProfileInput
  ): string {

    return `
Você é um Tech Recruiter Senior avaliando o fit de uma vaga para um candidato.

PERFIL DO CANDIDATO:
- Nível: ${profile.seniority || 'Não especificado'}
- Keywords Positivas: ${profile.keywords || ''}
- Stack Principal: ${profile.searches || ''}
- Keywords Negativas (Zeram a vaga): ${profile.negativeKeywords || ''}
- Score Mínimo para Aprovação: ${profile.minScore || 75}

REGRAS DE PONTUAÇÃO (0 a 100):

1. Inicie com 50 pontos.
2. ZERE O SCORE (0) e defina is_match=false imediatamente se a vaga exigir alguma Keyword Negativa.
3. Adicione 15 pontos se a vaga mencionar a Stack Principal.
4. Adicione 5 pontos para cada Keyword Positiva encontrada no contexto da vaga.
5. Se score >= ${profile.minScore || 75}, defina is_match=true, caso contrário false.

ATENÇÃO:
Responda APENAS em JSON válido neste formato:

{
  "score": numero,
  "is_match": booleano,
  "reason": "Explicação concisa em pt-br baseada na vaga."
}
`.trim();
  }

  private sanitizeText(
    text: string
  ): string {

    return text
      .replace(/\s+/g, ' ')
      .trim()
      .substring(0, 4000);
  }
}