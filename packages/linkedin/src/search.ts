import type { Page } from 'playwright';
import type { LinkedInJobRecord, LinkedInSearchOptions } from './types';
import { selectorChains } from './selectors';
import { SelectorFallbackEngine } from './selectors/fallbacks/SelectorFallbackEngine';
import { buildLinkedInJobRecord } from './parsers';
import { randomDelay, retry } from './utils';

const SEARCH_URL = 'https://www.linkedin.com/jobs/search/';

function buildSearchUrl(query: string, location: string) {
  const params = new URLSearchParams({ keywords: query, location });
  return `${SEARCH_URL}?${params.toString()}`;
}

export async function searchLinkedInJobs(page: Page, options: LinkedInSearchOptions) {
  const fallbackEngine = new SelectorFallbackEngine();
  const url = buildSearchUrl(options.query, options.location);
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await randomDelay(1000, 2000);

  const jobCardSelector = await fallbackEngine.findFirstSelector(page, selectorChains.jobCard);
  if (!jobCardSelector) {
    throw new Error('Unable to locate LinkedIn job cards with fallback selectors.');
  }

  await retry(async () => {
    await page.waitForSelector(jobCardSelector, { timeout: 15000 });
  }, 3, 1000);

  const rows = await page.$$eval(jobCardSelector, (cards, selectorChains) => {
    const getText = (card: Element, selectors: string[]) => {
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
        .find((el): el is Element => Boolean(el));
      const easyApply = easyApplyElement ? easyApplyElement.textContent?.includes('Easy Apply') ?? true : false;
      const linkElement = selectorChains.url
        .map((query) => card.querySelector(query))
        .find((el): el is HTMLAnchorElement => Boolean(el) && el instanceof HTMLAnchorElement) as HTMLAnchorElement | null;
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
  }, selectorChains);

  return rows
    .filter((job) => job.url)
    .slice(0, options.maxResults ?? 20)
    .map((job) =>
      buildLinkedInJobRecord({
        ...job,
        language: options.language,
        profile: options.profile
      })
    );
}
