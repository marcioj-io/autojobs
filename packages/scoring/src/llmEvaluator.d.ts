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
    constructor();
    evaluate(jobTitle: string, jobDescription: string, profileDefinition: any): Promise<LlmEvaluation>;
    private buildSystemPrompt;
    private sanitizeText;
}
