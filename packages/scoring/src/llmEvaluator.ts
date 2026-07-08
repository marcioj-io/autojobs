// packages/scoring/src/llmEvaluator.ts
import { z } from 'zod';

// O contrato blindado de resposta da IA
export const LlmEvaluationSchema = z.object({
  score: z.number(),
  is_match: z.boolean(),
  reason: z.string()
});

export type LlmEvaluation = z.infer<typeof LlmEvaluationSchema>;

export class LlmEvaluator {
  private apiUrl: string;
  private model: string;

  constructor() {
    // Aponta para o Ollama local por padrão
    this.apiUrl = process.env.LLM_API_URL || 'http://localhost:11434/v1/chat/completions';
    this.model = process.env.LLM_MODEL || 'llama3';
  }

  // public async evaluate(jobTitle: string, jobDescription: string, profileDefinition: any): Promise<LlmEvaluation> {
  //   const cleanDescription = this.sanitizeText(jobDescription);
  //   const systemPrompt = this.buildSystemPrompt(profileDefinition);

  //   const payload = {
  //     model: this.model,
  //     // Forçamos o modelo a devolver JSON (Ollama e Groq suportam isso)
  //     response_format: { type: "json_object" }, 
  //     messages: [
  //       { role: 'system', content: systemPrompt },
  //       { 
  //         role: 'user', 
  //         content: `VAGA A SER AVALIADA:\n\nTítulo: ${jobTitle}\nDescrição: ${cleanDescription}` 
  //       }
  //     ],
  //     temperature: 0.1 
  //   };

  //   try {
  //     const response = await fetch(this.apiUrl, {
  //       method: 'POST',
  //       headers: {
  //         'Content-Type': 'application/json',
  //         'Authorization': `Bearer ${process.env.LLM_API_KEY || 'no-key'}`
  //       },
  //       body: JSON.stringify(payload)
  //     });

  //     if (!response.ok) throw new Error(`API retornou ${response.status}: ${response.statusText}`);

  //     const data = await response.json();
  //     const content = data.choices[0].message.content;
      
  //     const parsedData = JSON.parse(content);
  //     return LlmEvaluationSchema.parse(parsedData);

  //   } catch (error) {
  //     console.error('🧠 ❌ Erro na avaliação LLM (Fallback para rejeição):', error);
  //     return { 
  //       score: 0, 
  //       is_match: false, 
  //       reason: 'Falha na avaliação da IA ou JSON malformado.' 
  //     };
  //   }
  // }

  public async evaluate(jobTitle: string, jobDescription: string, profileDefinition: any): Promise<LlmEvaluation> {
    const cleanDescription = this.sanitizeText(jobDescription);
    const systemPrompt = this.buildSystemPrompt(profileDefinition);

    // 1. Prepara os headers de forma dinâmica
    const headers: Record<string, string> = {
      'Content-Type': 'application/json'
    };

    // 2. Só adiciona Authorization SE existir uma chave real no .env
    // Não enviamos o header se for o fallback local
    if (process.env.LLM_API_KEY && process.env.LLM_API_KEY !== 'local-no-key-needed') {
      headers['Authorization'] = `Bearer ${process.env.LLM_API_KEY}`;
    }

    const payload = {
      model: this.model,
      response_format: { type: "json_object" },
      messages: [
        { role: 'system', content: systemPrompt },
        { 
          role: 'user', 
          content: `VAGA A SER AVALIADA:\n\nTítulo: ${jobTitle}\nDescrição: ${cleanDescription}` 
        }
      ],
      temperature: 0.1
    };

    try {
      // Log de depuração (remover depois de validar)
      console.log(`[LlmEvaluator] Chamando: ${this.apiUrl} com auth? ${!!headers['Authorization']}`);

      const response = await fetch(this.apiUrl, {
        method: 'POST',
        headers, // Headers dinâmicos
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const errorText = await response.text(); // Captura o erro real do servidor
        throw new Error(`API retornou ${response.status}: ${errorText}`);
      }

      const data = await response.json();
      const content = data.choices[0].message.content;
      
      const parsedData = JSON.parse(content);
      return LlmEvaluationSchema.parse(parsedData);

    } catch (error) {
      console.error('🧠 ❌ Erro na avaliação LLM:', error);
      return { 
        score: 0, 
        is_match: false, 
        reason: 'Falha na avaliação: ' + (error instanceof Error ? error.message : 'Erro desconhecido') 
      };
    }
  }
  
  private buildSystemPrompt(profile: any): string {
    return `
Você é um Tech Recruiter Senior avaliando o fit de uma vaga para um candidato.

PERFIL DO CANDIDATO:
- Nível: ${profile.seniority}
- Keywords Positivas (Trazem pontos): ${Array.isArray(profile.keywords) ? profile.keywords.join(', ') : profile.keywords}
- Stack Principal (Obrigatório ter ao menos uma): ${Array.isArray(profile.searches) ? profile.searches.join(', ') : profile.searches}
- Keywords Negativas (Zeram a vaga): ${Array.isArray(profile.negativeKeywords) ? profile.negativeKeywords.join(', ') : profile.negativeKeywords}
- Score Mínimo para Aprovação: ${profile.minScore || 75}

REGRAS DE PONTUAÇÃO (0 a 100):
1. Inicie com 50 pontos.
2. ZERE O SCORE (0) e defina is_match=false imediatamente se a vaga exigir alguma Keyword Negativa.
3. Adicione 15 pontos se a vaga mencionar a Stack Principal.
4. Adicione 5 pontos para cada Keyword Positiva encontrada no contexto da vaga.
5. Se score >= ${profile.minScore || 75}, defina is_match=true, senão false.

ATENÇÃO: Responda APENAS em JSON válido, com este exato formato:
{
  "score": numero,
  "is_match": booleano,
  "reason": "Explicação concisa em pt-br do porquê desta nota baseada na descrição."
}
`.trim();
  }

  private sanitizeText(text: string): string {
    return text.replace(/\s+/g, ' ').trim().substring(0, 4000); // Evita estourar o limite de tokens da IA local
  }
}