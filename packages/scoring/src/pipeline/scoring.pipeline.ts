import { Profile } from "@autojobs/db";

import { PreFilterService } from "../preFilter/preFilter.service";
import { LlmEvaluator } from "../llm/llmEvaluator";

export interface ScoringInput {
    title: string;
    description: string;
    location: string;
    profile: Profile;
}

export interface ScoringResult {
    approved: boolean;
    score: number;
    reason: string;
    source: "pre_filter" | "llm";
}

export class ScoringPipeline {

    private readonly preFilter = new PreFilterService();
    private readonly llm = new LlmEvaluator();

    async evaluate(
        input: ScoringInput
    ): Promise<ScoringResult> {

        const pre = this.preFilter.evaluate({
            job: {
                title: input.title,
                description: input.description,
                location: input.location
            },
            profile: {
                seniority: input.profile.seniority,
                keywords: input.profile.keywords
                    .split(",")
                    .map(x => x.trim())
                    .filter(Boolean),
                negativeKeywords: input.profile.negativeKeywords
                    .split(",")
                    .map(x => x.trim())
                    .filter(Boolean)
            }
        });

        if (!pre.approved) {
            return {
                approved: false,
                score: 0,
                reason: pre.reason ?? "Reprovado pelo pré-filtro",
                source: "pre_filter"
            };
        }

        const llm = await this.llm.evaluate(
            input.title,
            input.description,
            {
                seniority: input.profile.seniority,
                keywords: input.profile.keywords,
                negativeKeywords: input.profile.negativeKeywords,
                searches: input.profile.searches,
                minScore: input.profile.minScore
            }
        );

        return {
            approved: llm.is_match,
            score: llm.score,
            reason: llm.reason,
            source: "llm"
        };
    }
}