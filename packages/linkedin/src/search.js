"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.searchLinkedInJobs = searchLinkedInJobs;
const selectors_1 = require("./selectors");
const SelectorFallbackEngine_1 = require("./selectors/fallbacks/SelectorFallbackEngine");
const parsers_1 = require("./parsers");
const utils_1 = require("./utils");
const SEARCH_URL = 'https://www.linkedin.com/jobs/search/';
function buildSearchUrl(query, location) {
    const params = new URLSearchParams({ keywords: query, location });
    return `${SEARCH_URL}?${params.toString()}`;
}
async function searchLinkedInJobs(page, options) {
    const fallbackEngine = new SelectorFallbackEngine_1.SelectorFallbackEngine();
    const url = buildSearchUrl(options.query, options.location);
    await page.goto(url, { waitUntil: 'domcontentloaded' });
    await (0, utils_1.randomDelay)(1000, 2000);
    const jobCardSelector = await fallbackEngine.findFirstSelector(page, selectors_1.selectorChains.jobCard);
    if (!jobCardSelector) {
        throw new Error('Unable to locate LinkedIn job cards with fallback selectors.');
    }
    await (0, utils_1.retry)(async () => {
        await page.waitForSelector(jobCardSelector, { timeout: 15000 });
    }, 3, 1000);
    const rows = await page.$$eval(jobCardSelector, (cards, selectorChains) => {
        const getText = (card, selectors) => {
            for (const query of selectors) {
                const el = card.querySelector(query);
                if (el?.textContent?.trim()) {
                    return el.textContent.trim();
                }
            }
            return '';
        };
        return cards.map((card) => {
            const easyApplyElement = selectorChains.easyApply
                .map((query) => card.querySelector(query))
                .find((el) => Boolean(el));
            const easyApply = easyApplyElement ? easyApplyElement.textContent?.includes('Easy Apply') ?? true : false;
            const linkElement = selectorChains.url
                .map((query) => card.querySelector(query))
                .find((el) => Boolean(el) && el instanceof HTMLAnchorElement);
            const rawUrl = linkElement?.href ?? '';
            const id = rawUrl || `${getText(card, selectorChains.title)}-${getText(card, selectorChains.company)}`;
            return {
                id,
                company: getText(card, selectorChains.company),
                title: getText(card, selectorChains.title),
                location: getText(card, selectorChains.location),
                url: rawUrl,
                easyApply,
                postedAt: getText(card, selectorChains.postedAt),
                description: getText(card, selectorChains.description)
            };
        });
    }, selectors_1.selectorChains);
    return rows
        .filter((job) => job.url)
        .slice(0, options.maxResults ?? 20)
        .map((job) => (0, parsers_1.buildLinkedInJobRecord)({
        ...job,
        language: options.language,
        profile: options.profile
    }));
}
