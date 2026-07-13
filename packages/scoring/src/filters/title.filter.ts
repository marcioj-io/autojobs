import {
    FilterDecision,
    PreFilter,
    PreFilterContext
} from "../preFilter/preFilter.types";

const ACCEPTED_GROUPS = [
    "backend",
    "back-end",
    "fullstack",
    "full stack",
    "software engineer",
    "software developer",
    "api",
    "server",
    "node",
    "nestjs"
];


const HARD_REJECT = [
    "qa",
    "quality assurance",
    "tester",
    "test engineer",
    "sdet",

    "security",
    "cybersecurity",

    "data engineer",
    "data scientist",
    "machine learning",
    "ml engineer",
    "ai engineer",

    "devops",
    "platform engineer",
    "site reliability",
    "sre",
    "cloud engineer",

    "mobile",
    "android",
    "ios",

    "frontend",
    "front-end",
    "react developer",
    "angular developer",
    "vue developer",

    "salesforce",
    "sap"
];

export class TitleFilter implements PreFilter {
    evaluate(
        ctx: PreFilterContext
    ): FilterDecision {

        const title =
            ctx.job.title
                .toLowerCase()
                .trim();

        for (const reject of HARD_REJECT) {
            if (title.includes(reject)) {
                return {
                    approved: false,
                    reason:
                        `Cargo incompatível (${reject})`
                };
            }
        }

        const hasAcceptedGroup =
            ACCEPTED_GROUPS.some(keyword =>
                title.includes(keyword)
            );

        if (!hasAcceptedGroup) {
            return {
                approved: false,
                reason:
                    "Cargo fora do escopo backend/software"
            };
        }

        return {
            approved: true
        };

    }

}