// packages/scoring/src/llm/llmEvaluator.ts
import { generateObject } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import { z } from 'zod';
import type { JobEvaluationInput } from '@autojobs/shared';
import crypto from 'crypto';

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
  scoreBreakdown: z.record(z.number()).optional()
});

export type LlmEvaluationResult = z.infer<typeof evaluationSchema>;

/**
 * Heurística leve para extrair seções importantes da descrição.
 * - Retorna: { responsibilities, mustHave, niceToHave, modality, locationHints, rawBullets }
 * - Não tenta "resumir" semanticamente com LLM; usa regex/lines/bullets para preservar conteúdo.
 */
function extractImportantSections(description?: string) {
  const text = (description || '').replace(/\r/g, '');
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);

  const bullets = lines.filter(l => /^[-*•\u2022]\s+/.test(l) || /^\d+\./.test(l));
  const responsibilities: string[] = [];
  const mustHave: string[] = [];
  const niceToHave: string[] = [];
  const modalityHints: string[] = [];
  const locationHints: string[] = [];

  // heurística simples: linhas que contain keywords
  const mustKeywords = ['obrigat', 'must', 'required', 'necessário', 'experiência com', 'experiência em'];
  const niceKeywords = ['desejável', 'nice to have', 'prefer', 'diferencial', 'diferencial:'];

  for (const l of lines) {
    const low = l.toLowerCase();
    if (low.includes('remoto') || low.includes('híbrido') || low.includes('hybrid') || low.includes('presencial') || low.includes('onsite')) {
      modalityHints.push(l);
    }
    if (low.match(/\b(sp|são paulo|sao paulo|brasil)\b/)) locationHints.push(l);
  }

  for (const b of bullets) {
    const low = b.toLowerCase();
    if (mustKeywords.some(k => low.includes(k))) mustHave.push(b.replace(/^[-*•\s\d\.]+/, '').trim());
    else if (niceKeywords.some(k => low.includes(k))) niceToHave.push(b.replace(/^[-*•\s\d\.]+/, '').trim());
    else responsibilities.push(b.replace(/^[-*•\s\d\.]+/, '').trim());
  }

  // fallback: try to extract tech stack line (common patterns)
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
    rawBullets: bullets
  };
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
    this.fallbackModelName = process.env.LLM_MODEL_FALLBACK; // optional
    this.temperature = Number(process.env.LLM_TEMPERATURE ?? 0); // deterministic by default
    this.maxOutputTokens = Number(process.env.LLM_MAX_OUTPUT_TOKENS ?? 1024);
    this.timeoutMs = Number(process.env.LLM_TIMEOUT_MS ?? 30000);
    this.cache = (process.env.LLM_CACHE_ENABLED === 'true') ? new Map() : null;
  }

  private buildSystemPrompt(): string {
    return `
Você é um Headhunter Sênior e Especialista em Recrutamento e Seleção. Avalie aderência entre candidato e vaga.
Siga estritamente o schema JSON solicitado. Seja objetivo, conciso e use linguagem técnica quando necessário.
Use a matriz de pontuação fornecida: 0-40, 41-69, 70-84, 85-100.
Preencha hrThoughtProcess antes de rawScore.
`;
  }

  private buildUserPrompt(input: JobEvaluationInput, extracted: ReturnType<typeof extractImportantSections>): string {
    const profile = input.profile ?? {};
    // include extracted sections as structured fields to avoid losing info
    const must = extracted.mustHave.length ? `MustHave:\n- ${extracted.mustHave.join('\n- ')}\n` : '';
    const nice = extracted.niceToHave.length ? `NiceToHave:\n- ${extracted.niceToHave.join('\n- ')}\n` : '';
    const resp = extracted.responsibilities.length ? `Responsibilities:\n- ${extracted.responsibilities.join('\n- ')}\n` : '';
    const modality = extracted.modalityHints.length ? `ModalityHints: ${extracted.modalityHints.join(' | ')}\n` : '';
    const location = extracted.locationHints.length ? `LocationHints: ${extracted.locationHints.join(' | ')}\n` : '';

    // Provide the full description as "context" but instruct model to prioritize structured fields
    const descriptionContext = input.description ? `FULL_DESCRIPTION_START\n${input.description}\nFULL_DESCRIPTION_END` : 'No description provided.';

    return `
VAGA (campos extraídos):
${must}${nice}${resp}${modality}${location}

PERFIL DO CANDIDATO:
Name: ${profile.name ?? 'Candidato'}
TargetRoles: ${Array.isArray(profile.targetRoles) ? profile.targetRoles.join(', ') : (profile.targetRoles ?? 'N/A')}
Seniority: ${Array.isArray(profile.seniority) ? profile.seniority.join(', ') : (profile.seniority ?? 'N/A')}
SkillMatrix: ${JSON.stringify(profile.skillMatrix ?? {})}
NegativeKeywords: ${Array.isArray(profile.negativeKeywords) ? profile.negativeKeywords.join(', ') : (profile.negativeKeywords ?? '[]')}
AdditionalContext: ${profile.aiApplicationContext ?? 'N/A'}

INSTRUÇÕES:
1) Priorize os campos "MustHave" e "Responsibilities" ao decidir requisitos obrigatórios.
2) Use a FULL_DESCRIPTION apenas como referência; não repita tudo no JSON.
3) Retorne apenas o JSON que segue o schema solicitado. Não inclua comentários ou texto adicional.
4) Seja determinístico (temperature = ${this.temperature}).

Contexto completo (apenas referência):
${descriptionContext}
`;
  }

  private hashInput(input: JobEvaluationInput) {
    try {
      const s = JSON.stringify({
        title: input.title,
        profileId: input.profile?.id ?? null,
        descHash: (input.description || '').slice(0, 2000)
      });
      return crypto.createHash('sha256').update(s).digest('hex');
    } catch {
      return String(Math.random());
    }
  }

  private async callGenerateObjectWithModel(modelName: string, system: string, prompt: string) {
    // generateObject options may vary by provider; adapt keys if needed
    return generateObject({
      model: this.providerFactory(modelName),
      system,
      prompt,
      schema: evaluationSchema,
      // provider-specific tuning (if supported by wrapper)
      // e.g. temperature, max tokens
      // If generateObject doesn't accept these, set them via provider(modelName, { ... })
      // Here we pass them as part of model config if supported by the SDK
      // (SDK-specific: adapt to your provider)
      // @ts-ignore
      temperature: this.temperature,
      // @ts-ignore
      max_output_tokens: this.maxOutputTokens
    });
  }

  public async evaluate(input: JobEvaluationInput): Promise<LlmEvaluationResult> {
    const start = Date.now();
    const cacheKey = this.cache ? this.hashInput(input) : null;
    if (cacheKey && this.cache?.has(cacheKey)) {
      return this.cache.get(cacheKey)!;
    }

    // 1) Extract structured fields deterministically
    const extracted = extractImportantSections(input.description);

    // 2) Build prompts
    const system = this.buildSystemPrompt();
    const userPrompt = this.buildUserPrompt(input, extracted);

    // 3) Try primary model with timeout and fallback to fallbackModelName if configured
    const tryModel = async (modelName: string) => {
      const call = this.callGenerateObjectWithModel(modelName, system, userPrompt);
      const timeout = new Promise((_, rej) => setTimeout(() => rej(new Error('LLM_TIMEOUT')), this.timeoutMs));
      const res = await Promise.race([call, timeout]) as any;
      return res;
    };

    let object: any;
    try {
      try {
        object = await tryModel(this.primaryModelName);
      } catch (err) {
        // if fallback model configured, try it
        if (this.fallbackModelName) {
          try {
            object = await tryModel(this.fallbackModelName);
          } catch (err2) {
            throw err2;
          }
        } else {
          throw err;
        }
      }

      // generateObject returns { object } or similar; adapt if wrapper differs
      const resultObj = object?.object ?? object;
      // schema validation already applied by generateObject; but double-check
      const parsed = evaluationSchema.parse(resultObj);

      // cache and return
      if (cacheKey && this.cache) this.cache.set(cacheKey, parsed as LlmEvaluationResult);

      const elapsed = Date.now() - start;
      console.info('[LLM] evaluate ok', { model: this.primaryModelName, elapsedMs: elapsed, title: input.title });
      return parsed as LlmEvaluationResult;
    } catch (err : any) {
      console.warn('[LLM] primary/fallback failed or schema invalid, attempting repair call', err?.message ?? err);

      // Attempt a short "repair" call: ask model to fix JSON only, with strict schema and small token budget
      try {
        const repairPrompt = `
O JSON retornado anteriormente está inválido ou incompleto. Corrija apenas o JSON para obedecer ao schema:
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
          max_output_tokens: 512
        });
        const repairRes = await Promise.race([repairCall, new Promise((_, rej) => setTimeout(() => rej(new Error('LLM_TIMEOUT')), this.timeoutMs))]) as any;
        const repaired = repairRes?.object ?? repairRes;
        const parsed = evaluationSchema.parse(repaired);
        if (cacheKey && this.cache) this.cache.set(cacheKey, parsed as LlmEvaluationResult);
        return parsed as LlmEvaluationResult;
      } catch (repairErr) {
        console.error('[LLM] repair failed, returning conservative fallback', repairErr);
        // conservative fallback
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
        return fallback;
      }
    }
  }
}
