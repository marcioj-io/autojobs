export interface JobForPreFilter {
    title: string;
    description: string;
    location: string;
}


export interface ProfileForPreFilter {

    seniority: string;

    keywords: string[];

    negativeKeywords: string[];

}


export interface PreFilterContext {

    job: JobForPreFilter;

    profile: ProfileForPreFilter;

}


export interface FilterDecision {

    approved: boolean;

    reason?: string;

}


export interface PreFilter {

    evaluate(
        ctx: PreFilterContext
    ): FilterDecision;

}