// packages/engine/src/search.ts
import type { Page } from 'playwright';
import type { LinkedInJobRecord, LinkedInSearchOptions } from './types';
import { selectorChains } from './selectors';
import { SelectorFallbackEngine } from './selectors/fallbacks/SelectorFallbackEngine';
import { buildLinkedInJobRecord } from './parsers';
import { randomDelay, retry } from './utils';

const SEARCH_URL = 'https://www.linkedin.com/jobs/search/';

function buildSearchUrl(query: string, location: string) {
  const params = new URLSearchParams({ 
    keywords: query, 
    location: location,
    f_TPR: 'r86400' // ⏳ FILTRO MAGNO: Apenas vagas das últimas 24 horas!
  });
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

  // OPÇÃO NUCLEAR: Zero funções auxiliares dentro do evaluate.
  // Código 100% plano procedural (for loops) para o esbuild não injetar variáveis globais.
  const rows = await page.$$eval(jobCardSelector, (cards, chains) => {
    const results = [];

    for (const card of cards) {
      // Busca Title
      let title = '';
      for (const sel of chains.title) {
        const el = card.querySelector(sel);
        if (el?.textContent?.trim()) { title = el.textContent.trim(); break; }
      }

      // Busca Company
      let company = '';
      for (const sel of chains.company) {
        const el = card.querySelector(sel);
        if (el?.textContent?.trim()) { company = el.textContent.trim(); break; }
      }

      // Busca Location
      let location = '';
      for (const sel of chains.location) {
        const el = card.querySelector(sel);
        if (el?.textContent?.trim()) { location = el.textContent.trim(); break; }
      }

      // Busca Data de Postagem
      let postedAt = '';
      for (const sel of chains.postedAt) {
        const el = card.querySelector(sel);
        if (el?.textContent?.trim()) { postedAt = el.textContent.trim(); break; }
      }

      // Busca Descrição
      let description = '';
      for (const sel of chains.description) {
        const el = card.querySelector(sel);
        if (el?.textContent?.trim()) { description = el.textContent.trim(); break; }
      }

      // Busca URL
      let rawUrl = '';
      for (const sel of chains.url) {
        const el = card.querySelector(sel);
        if (el && el instanceof HTMLAnchorElement) { rawUrl = el.href; break; }
      }

      // Busca Easy Apply
      let easyApply = false;
      for (const sel of chains.easyApply) {
        const el = card.querySelector(sel);
        if (el) { 
          easyApply = el.textContent?.includes('Easy Apply') ?? true; 
          break; 
        }
      }

      const id = rawUrl || `${title}-${company}`;

      results.push({
        id,
        company,
        title,
        location,
        url: rawUrl,
        easyApply,
        postedAt,
        description
      });
    }

    return results;
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