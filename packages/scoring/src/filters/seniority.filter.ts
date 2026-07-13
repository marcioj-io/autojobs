import {
    FilterDecision,
    PreFilter,
    PreFilterContext
} from "../preFilter/preFilter.types";

const LEVELS = {
    internship: [
        "intern",
        "internship",
        "estágio",
        "estagiário"
    ],

    trainee: [
        "trainee"
    ],

    junior: [
        "junior",
        "jr"
    ],

    pleno: [
        "pleno",
        "mid",
        "middle",
        "mid-level",
        "mid level"
    ],

    senior: [
        "senior",
        "sr"
    ],

    staff: [
        "staff"
    ],

    lead: [
        "lead",
        "tech lead",
        "technical lead"
    ],

    principal: [
        "principal"
    ],

    architect: [
        "architect",
        "arquiteto",
        "solutions architect"
    ]
} as const;

type Level = keyof typeof LEVELS;

const COMPATIBILITY: Record<Level, Level[]> = {

    internship: [
        "internship"
    ],

    trainee: [
        "trainee"
    ],

    junior: [
        "junior"
    ],

    pleno: [
        "pleno",
        "junior"
    ],

    senior: [
        "senior",
        "lead",
        "staff"
    ],

    staff: [
        "staff",
        "principal",
        "lead"
    ],

    lead: [
        "lead",
        "staff"
    ],

    principal: [
        "principal"
    ],

    architect: [
        "architect"
    ]
};

function detectLevel(title: string): Level | undefined {
    const lower = title.toLowerCase();
    const matches = Object.entries(LEVELS)
        .filter(([_, aliases]) =>
            aliases.some(alias =>
                lower.includes(alias)
            )
        )
        .map(([level]) => level as Level);

    if (!matches.length) {
        return undefined;
    }

    const priority: Level[] = [
        "architect",
        "principal",
        "staff",
        "lead",
        "senior",
        "pleno",
        "junior",
        "trainee",
        "internship"
    ];

    return priority.find(level =>
        matches.includes(level)
    );
}

export class SeniorityFilter implements PreFilter {
    evaluate(
        ctx: PreFilterContext
    ): FilterDecision {

        const detected =
            detectLevel(ctx.job.title);

        if (!detected) {
            return {
                approved: true
            };
        }

        const expected =
            ctx.profile.seniority
                .toLowerCase() as Level;

        const allowed =
            COMPATIBILITY[expected] ?? [];

        if (!allowed.includes(detected)) {
            return {
                approved: false,
                reason:
                    `Senioridade incompatível (${detected})`
            };
        }

        return {
            approved: true
        };
    }
}