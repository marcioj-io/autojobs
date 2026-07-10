import { z } from 'zod';
export declare const LlmEvaluationSchema: z.ZodObject<{
    score: z.ZodNumber;
    is_match: z.ZodBoolean;
    reason: z.ZodString;
}, "strip", z.ZodTypeAny, {
    score: number;
    is_match: boolean;
    reason: string;
}, {
    score: number;
    is_match: boolean;
    reason: string;
}>;
export type LlmEvaluation = z.infer<typeof LlmEvaluationSchema>;
export declare class LlmEvaluator {
    private apiUrl;
    private model;
    private readonly MAX_RETRIES;
    private readonly TIMEOUT_MS;
    constructor();
    evaluate(jobTitle: string, jobDescription: string, profileDefinition: any): Promise<LlmEvaluation>;
    /**
     * Executa a requisição com tentativas embutidas e timeout
     * Isso evita que a esteira morra por pequenas quedas de rede no WSL ou lentidão na VRAM.
     */
    private fetchWithResilience;
    private buildSystemPrompt;
    private sanitizeText;
}
