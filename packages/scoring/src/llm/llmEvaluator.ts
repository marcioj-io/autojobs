// packages/scoring/src/llm/llmEvaluator.ts
import { generateObject } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import { z } from 'zod';
import type { JobEvaluationInput } from '@autojobs/shared';
import { createHash } from 'crypto';

const evaluationSchema = z.object({
  hrThoughtProcess: z
    .object({
      roleAnalysis: z.string(),
      transferableSkills: z.string(),
      careerRisks: z.string()
    })
    .optional(),

  rawScore: z.number().min(0).max(100),
  isMatch: z.boolean(),
  reason: z.string(),
  classification: z
    .object({
      area: z.string(),
      role: z.string(),
      seniority: z.string()
    })
    .optional(),

  requiredSkillsFound: z.array(z.string()).optional().default([]),
  optionalSkillsFound: z.array(z.string()).optional().default([]),
  missingRequired: z.array(z.string()).optional().default([]),
  matchedSkills: z.array(z.string()).optional().default([]),
  missingSkills: z.array(z.string()).optional().default([]),
  scoreBreakdown: z.record(z.number()).optional()
});

export type LlmEvaluationResult = z.infer<typeof evaluationSchema> & {
  llmFallback?: boolean;
  // internal diagnostics (optional)
  _error?: { message: string; code?: string; errorBy?: string; [k: string]: any };
  _llmRawSafe?: any;
};

// Pure function para achatar a Skill Matrix e reduzir carga cognitiva da LLM
function formatSkillMatrixForLlm(skillMatrix: any): string {
  if (!skillMatrix || Object.keys(skillMatrix).length === 0) return 'N/A';

  let formatted = '';
  for (const [category, data] of Object.entries(skillMatrix)) {
    const catData = data as any;
    if (catData.tools && Array.isArray(catData.tools)) {
      formatted += `- ${category.toUpperCase()}: ${catData.tools.join(', ')} (${catData.years} anos, nível ${catData.level})\n`;
    }
  }
  return formatted.trim() || 'N/A';
}

function extractImportantSections(description?: string) {
  const text = (description || '').replace(/\r/g, '');
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);

  const responsibilities: string[] = [];
  const mustHave: string[] = [];
  const niceToHave: string[] = [];
  const modalityHints: string[] = [];
  const locationHints: string[] = [];
  const rawBullets: string[] = [];

  const mustKeywords = ['obrigat', 'must', 'required', 'necessário', 'experiência com', 'experiência em'];
  const niceKeywords = ['desejável', 'nice to have', 'prefer', 'diferencial', 'diferencial:'];

  // State machine para rastrear em qual bloco de cabeçalho o bullet se encontra
  type SectionContext = 'neutral' | 'mustHave' | 'niceToHave' | 'responsibilities';
  let currentSection: SectionContext = 'neutral';

  for (const l of lines) {
    const low = l.toLowerCase();

    // 1. Detectar hints gerais
    if (low.includes('remoto') || low.includes('híbrido') || low.includes('hybrid') || low.includes('presencial') || low.includes('onsite')) {
      modalityHints.push(l);
    }
    if (low.match(/\b(sp|são paulo|sao paulo|brasil|manaus|cuiabá|cuiaba)\b/)) {
      locationHints.push(l);
    }

    // 2. Transições de estado baseadas em cabeçalhos
    if (/(requisit|obrigat|must have|qualificaç)/.test(low)) {
      currentSection = 'mustHave';
    } else if (/(desej|diferencial|nice to have)/.test(low)) {
      currentSection = 'niceToHave';
    } else if (/(responsabilidad|atribuiç|responsibilit|o que voc)/.test(low)) {
      currentSection = 'responsibilities';
    }

    // 3. Processamento de Bullets com awareness de contexto
    if (/^[-*•\s]\s+/.test(l) || /^\d+\./.test(l)) {
      rawBullets.push(l);
      const cleanBullet = l.replace(/^[-*•\s\d\.]+/, '').trim();

      // Avalia keyword inline ou herda do cabeçalho
      if (mustKeywords.some(k => low.includes(k)) || currentSection === 'mustHave') {
        mustHave.push(cleanBullet);
      } else if (niceKeywords.some(k => low.includes(k)) || currentSection === 'niceToHave') {
        niceToHave.push(cleanBullet);
      } else {
        responsibilities.push(cleanBullet);
      }
    }
  }

  const techLine = lines.find(l => /tech(stack|nology)|stack:|tecnologias:|tecnologias/i.test(l));
  if (techLine) {
    const parts = techLine.split(/:|-/).slice(1).join(':').split(/,|\/| e | and /).map(s => s.trim()).filter(Boolean);
    for (const p of parts) {
      if (p.length > 1 && !mustHave.includes(p)) niceToHave.push(p);
    }
  }

  return {
    responsibilities,
    mustHave,
    niceToHave,
    modalityHints,
    locationHints,
    rawBullets
  };
}

/**
 * Build a description context that preserves important parts while keeping token usage reasonable.
 * Strategy: if description is short, include full. If long, include head + tail with a truncated marker.
 */
function buildDescriptionContext(fullDesc?: string, maxChars = 8000) {
  if (!fullDesc) return '\nNo description provided.';
  const cleaned = fullDesc.replace(/\r/g, '\n').trim();
  if (cleaned.length <= maxChars) {
    return `\n--- START FULL DESCRIPTION ---\n${cleaned}\n--- END FULL DESCRIPTION ---`;
  }
  // head + tail strategy: keep first 3000 and last 2000 chars (adjustable)
  const head = cleaned.slice(0, 3000);
  const tail = cleaned.slice(-2000);
  return `\n--- START DESCRIPTION SNIPPET (truncated) ---\n${head}\n\n... [TRUNCATED MIDDLE] ...\n\n${tail}\n--- END DESCRIPTION SNIPPET ---`;
}

export class LlmEvaluator {
  private readonly providerFactory: ReturnType<typeof createOpenAI>;
  private readonly primaryModelName: string;
  private readonly fallbackModelName?: string;
  private readonly temperature: number;
  private readonly maxOutputTokens: number;
  private readonly timeoutMs: number;
  private readonly cache: Map<string, LlmEvaluationResult> | null;

  constructor() {
    const customBaseUrl = process.env.LLM_API_URL?.replace('/chat/completions', '');
    this.providerFactory = createOpenAI({
      baseURL: customBaseUrl,
      apiKey: process.env.LLM_API_KEY ?? ''
    });

    this.primaryModelName = process.env.LLM_MODEL ?? 'gpt-4o-mini';
    this.fallbackModelName = process.env.LLM_MODEL_FALLBACK;
    // default determinístico; allow override via env for experiments
    const envTemp = process.env.LLM_TEMPERATURE;
    this.temperature = typeof envTemp !== 'undefined' ? Number(envTemp) : 0;
    this.maxOutputTokens = Number(process.env.LLM_MAX_OUTPUT_TOKENS ?? 512);
    this.timeoutMs = Number(process.env.LLM_TIMEOUT_MS ?? 200000);
    this.cache = (process.env.LLM_CACHE_ENABLED === 'true') ? new Map() : null;
  }

  private buildSystemPrompt(): string {
    return `
Você é um Headhunter Sênior e Especialista em Recrutamento Tech. Avalie a aderência técnica e comportamental entre candidato e vaga.

REGRAS CRÍTICAS DE AVALIAÇÃO:
1. Cruzamento Inteligente: Compare os requisitos da vaga prioritariamente com a "SkillMatrix" do candidato.
2. Ecossistema Tech: Reconheça sinonímia e dependências óbvias (ex: C# engloba .NET; Node.js implica JavaScript; AWS engloba EC2). Não penalize nomenclaturas equivalentes.
3. Não suponha a ausência de uma habilidade se ela estiver explicitamente na "SkillMatrix", mesmo que não conste no resumo ("AdditionalContext").
4. AVALIAÇÃO UNIVERSAL: Considere aprendizado, mudança de stack, transferibilidade e experiência adjacente como sinais positivos de potencial; não descarte automaticamente candidatos por termos ligeiramente diferentes.
5. Negative Keywords são sinais importantes de incompatibilidade forte, mas não devem virar veto absoluto se houver evidência clara de adaptabilidade e compatibilidade parcial. Use-os como penalidade moderada, não como rejeição automática.
6. Matriz de Pontuação: 0-40 (Desalinhado), 41-69 (Parcial), 70-84 (Aderente), 85-100 (Fortemente Aderente).

Preencha a chave "hrThoughtProcess" fundamentando o racional da análise antes de emitir o "rawScore". Siga o schema JSON estritamente.
`;
  }

  private buildUserPrompt(input: JobEvaluationInput, extracted: ReturnType<typeof extractImportantSections>): string {
    const profile = input.profile ?? {};
    const must = extracted.mustHave.length ? `[MUST HAVE - Obrigatório]\n- ${extracted.mustHave.join('\n- ')}\n\n` : '';
    const nice = extracted.niceToHave.length ? `[NICE TO HAVE - Diferencial]\n- ${extracted.niceToHave.join('\n- ')}\n\n` : '';
    const resp = extracted.responsibilities.length ? `[RESPONSIBILITIES - Atribuições]\n- ${extracted.responsibilities.join('\n- ')}\n\n` : '';
    const modality = extracted.modalityHints.length ? `[MODALITY HINTS]: ${extracted.modalityHints.join(' | ')}\n` : '';
    const location = extracted.locationHints.length ? `[LOCATION HINTS]: ${extracted.locationHints.join(' | ')}\n` : '';

    const descriptionContext = buildDescriptionContext(input.description, Number(process.env.LLM_MAX_DESCRIPTION_CHARS ?? 8000));

    const formattedSkills = formatSkillMatrixForLlm(profile.skillMatrix);

    return `
=== DADOS DA VAGA (EXTRAÍDOS) ===
${must}${nice}${resp}${modality}${location}

=== PERFIL DO CANDIDATO ===
Name: ${profile.name ?? 'Candidato'}
TargetRoles: ${Array.isArray(profile.targetRoles) ? profile.targetRoles.join(', ') : (profile.targetRoles ?? 'N/A')}
Seniority: ${Array.isArray(profile.seniority) ? profile.seniority.join(', ') : (profile.seniority ?? 'N/A')}

[SkillMatrix (Competências Técnicas)]
${formattedSkills}

[NegativeKeywords (Filtros de Exclusão)]
${Array.isArray(profile.negativeKeywords) ? profile.negativeKeywords.join(', ') : (profile.negativeKeywords ?? 'N/A')}

[AdditionalContext (Resumo Profissional)]
${profile.aiApplicationContext ?? 'N/A'}

=== INSTRUÇÕES ===
1. Utilize os dados extraídos da vaga e avalie contra a SkillMatrix e o AdditionalContext.
2. Use a DESCRIPTION SNIPPET apenas para resolver ambiguidades (ex: entender a arquitetura base ou core business).
3. Seja determinístico na avaliação e trate NegativeKeywords como sinal de incompatibilidade forte, mas não absoluto.
4. Se houver compatibilidade parcial ou evidência de aprendizado/transferibilidade, preserve um julgamento equilibrado e não rejeite automaticamente.
${descriptionContext}
`;
  }

  private hashInput(input: JobEvaluationInput) {
    try {
      const skillSnippet = input.profile?.skillMatrix ? JSON.stringify(input.profile.skillMatrix).slice(0, 2000) : '';
      const contextSnippet = String(input.profile?.aiApplicationContext || '').slice(0, 1000);
      const s = JSON.stringify({
        title: input.title,
        profileId: input.profile?.id ?? null,
        descHash: (input.description || '').slice(0, 2000),
        skillSnippet,
        contextSnippet,
        profileMin: input.profile?.minScore ?? null
      });
      return createHash('sha256').update(s).digest('hex');
    } catch {
      return String(Math.random());
    }
  }

  private async callGenerateObjectWithModel(modelName: string, system: string, prompt: string) {
    return generateObject({
      model: this.providerFactory(modelName),
      system,
      prompt,
      schema: evaluationSchema,
      // @ts-ignore
      temperature: this.temperature,
      // @ts-ignore
      max_output_tokens: this.maxOutputTokens
    });
  }

  private normalizeEvaluationResult(result: any): LlmEvaluationResult {
    const normalized = {
      hrThoughtProcess: result?.hrThoughtProcess ?? { roleAnalysis: 'N/A', transferableSkills: 'N/A', careerRisks: 'N/A' },
      rawScore: Math.max(0, Math.min(100, Number(result?.rawScore ?? 0))),
      isMatch: Boolean(result?.isMatch),
      reason: typeof result?.reason === 'string' && result.reason.trim() ? result.reason : 'Compatibilidade moderada',
      classification: result?.classification ?? { area: 'Desconhecida', role: 'Desconhecido', seniority: 'Desconhecida' },
      requiredSkillsFound: Array.isArray(result?.requiredSkillsFound) ? result.requiredSkillsFound : [],
      optionalSkillsFound: Array.isArray(result?.optionalSkillsFound) ? result.optionalSkillsFound : [],
      missingRequired: Array.isArray(result?.missingRequired) ? result.missingRequired : [],
      matchedSkills: Array.isArray(result?.matchedSkills) ? result.matchedSkills : [],
      missingSkills: Array.isArray(result?.missingSkills) ? result.missingSkills : [],
      scoreBreakdown: result?.scoreBreakdown && typeof result.scoreBreakdown === 'object' ? result.scoreBreakdown : {}
    } as LlmEvaluationResult;

    return normalized;
  }

  public async evaluate(input: JobEvaluationInput): Promise<LlmEvaluationResult> {
    const start = Date.now();
    const cacheKey = this.cache ? this.hashInput(input) : null;
    if (cacheKey && this.cache?.has(cacheKey)) {
      const cached = this.cache.get(cacheKey)!;
      console.info('[LLM] cache hit', { key: cacheKey, title: input.title });
      return cached;
    }

    const extracted = extractImportantSections(input.description);
    const system = this.buildSystemPrompt();
    const userPrompt = this.buildUserPrompt(input, extracted);

    const tryModel = async (modelName: string) => {
      const call = this.callGenerateObjectWithModel(modelName, system, userPrompt);
      const timeout = new Promise((_, rej) => setTimeout(() => rej(new Error('LLM_TIMEOUT')), this.timeoutMs));
      return await Promise.race([call, timeout]) as any;
    };

    // retry wrapper with simple backoff
    const tryWithRetry = async (modelName: string, attempts = 2) => {
      let lastErr: any = null;
      for (let i = 0; i < attempts; i++) {
        try {
          if (i > 0) await new Promise(r => setTimeout(r, 500 * i)); // backoff 0.5s, 1s...
          return await tryModel(modelName);
        } catch (e: any) {
          lastErr = e;
          console.warn(`[LLM][retry] attempt ${i + 1} failed for ${modelName}`, e?.message ?? e);
        }
      }
      throw lastErr;
    };

    let object: any;
    let usedModel = this.primaryModelName;
    let usedFallback = false;

    try {
      try {
        object = await tryWithRetry(this.primaryModelName, 2);
      } catch (err) {
        usedFallback = true;
        console.warn('[LLM] primary model failed, attempting fallback', { err: (err as any)?.message ?? String(err) });
        if (this.fallbackModelName) {
          usedModel = this.fallbackModelName;
          object = await tryWithRetry(this.fallbackModelName, 2);
        } else {
          throw err;
        }
      }

      const resultObj = object?.object ?? object;
      const parsed = evaluationSchema.parse(this.normalizeEvaluationResult(resultObj));

      const elapsed = Date.now() - start;
      console.info('[LLM] evaluate ok', {
        model: usedModel,
        elapsedMs: elapsed,
        title: input.title,
        fallbackUsed: usedFallback,
        cacheKey: cacheKey ?? null
      });

      const out = parsed as LlmEvaluationResult;
      if (usedFallback) out.llmFallback = true;

      // attach a safe, truncated raw snapshot for auditing (caller can read _llmRawSafe)
      (out as any)._llmRawSafe = {
        reason: out.reason,
        rawScore: out.rawScore,
        isMatch: out.isMatch,
        classification: out.classification,
        matchedSkills: Array.isArray(out.matchedSkills) ? out.matchedSkills.slice(0, 50) : [],
        missingRequired: Array.isArray(out.missingRequired) ? out.missingRequired.slice(0, 10) : [],
        llmFallback: Boolean(out.llmFallback),
        rawSnippet: JSON.stringify(resultObj).slice(0, 2000)
      };

      if (cacheKey && this.cache) {
        try { this.cache.set(cacheKey, out); } catch { /* ignore cache errors */ }
      }
      return out;
    } catch (err: any) {
      console.warn('[LLM] primary/fallback failed or schema invalid, attempting repair call', err?.message ?? err);

      try {
        const repairPrompt = `
O JSON retornado anteriormente está inválido ou incompleto. Corrija apenas o formato para obedecer estritamente ao schema:
${evaluationSchema.toString()}
Retorne somente o JSON válido.
`;
        const repairCall = generateObject({
          model: this.providerFactory(this.primaryModelName),
          system,
          prompt: `${userPrompt}\n\n${repairPrompt}`,
          schema: evaluationSchema,
          // @ts-ignore
          temperature: 0,
          // @ts-ignore
          max_output_tokens: Math.min(512, this.maxOutputTokens)
        });
        const repairRes = await Promise.race([repairCall, new Promise((_, rej) => setTimeout(() => rej(new Error('LLM_TIMEOUT')), this.timeoutMs))]) as any;
        const repaired = repairRes?.object ?? repairRes;
        const parsed = evaluationSchema.parse(this.normalizeEvaluationResult(repaired));

        if (cacheKey && this.cache) {
          try { this.cache.set(cacheKey, parsed as LlmEvaluationResult); } catch { /* ignore */ }
        }

        const out = parsed as LlmEvaluationResult;
        (out as any)._llmRawSafe = {
          reason: out.reason,
          rawScore: out.rawScore,
          isMatch: out.isMatch,
          classification: out.classification,
          matchedSkills: Array.isArray(out.matchedSkills) ? out.matchedSkills.slice(0, 50) : [],
          missingRequired: Array.isArray(out.missingRequired) ? out.missingRequired.slice(0, 10) : [],
          llmFallback: Boolean(out.llmFallback),
          rawSnippet: JSON.stringify(repaired).slice(0, 2000)
        };

        return out;
      } catch (repairErr) {
        console.error('[LLM] repair failed, returning conservative fallback', repairErr);
        const fallback: LlmEvaluationResult = {
          hrThoughtProcess: { roleAnalysis: 'N/A', transferableSkills: 'N/A', careerRisks: 'N/A' },
          rawScore: 0,
          isMatch: false,
          reason: 'Fallback por erro/timeout do LLM',
          classification: { area: 'Desconhecida', role: 'Desconhecido', seniority: 'Desconhecida' },
          requiredSkillsFound: [],
          optionalSkillsFound: [],
          missingRequired: [],
          matchedSkills: [],
          missingSkills: [],
          scoreBreakdown: {}
        };
        (fallback as any).llmFallback = true;
        (fallback as any)._error = {
          message: (repairErr as any)?.message ?? String(repairErr),
          code: (repairErr as any)?.message === 'LLM_TIMEOUT' ? 'LLM_TIMEOUT' : 'LLM_ERROR',
          errorBy: 'llm'
        };
        (fallback as any)._llmRawSafe = {
          reason: fallback.reason,
          rawScore: fallback.rawScore,
          isMatch: fallback.isMatch,
          classification: fallback.classification,
          matchedSkills: [],
          missingRequired: [],
          llmFallback: true,
          rawSnippet: JSON.stringify({ error: (repairErr as any)?.message ?? String(repairErr) }).slice(0, 2000)
        };
        if (cacheKey && this.cache) {
          try { this.cache.set(cacheKey, fallback as LlmEvaluationResult); } catch { /* ignore */ }
        }
        return fallback as LlmEvaluationResult;
      }
    }
  }
}
