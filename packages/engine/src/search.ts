// packages/engine/src/search.ts
import type { Page } from 'playwright';
import type { LinkedInJobRecord, LinkedInSearchOptions } from './types';
import { selectorChains } from './selectors';
import { SelectorFallbackEngine } from './selectors/fallbacks/SelectorFallbackEngine';
import { buildLinkedInJobRecord } from './parsers';
import { randomDelay, retry } from './utils';

const SEARCH_URL = 'https://www.linkedin.com/jobs/search/';

// Mapeamento simples para os códigos do LinkedIn
const MODALITY_MAP: Record<string, string> = {
  'presencial': '1',
  'remoto': '2',
  'híbrido': '3'
};

function buildSearchUrl(query: string, location: string, modalities: string[] = ['remoto', 'híbrido']) {
  // Converte ["remoto", "híbrido"] para "2,3"
  const fWT = modalities
    .map(m => MODALITY_MAP[m.toLowerCase()])
    .filter(Boolean)
    .join(',');

  const params = new URLSearchParams({ 
    keywords: query, 
    location: location,
    f_TPR: 'r86400',
    f_AL: 'true'
  });

  if (fWT) {
    params.append('f_WT', fWT);
  }

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

      // 🚨 O FALLBACK INDESTRUTÍVEL
      // Se os seletores falharem, pegamos todo o texto bruto do card da vaga!
      if (!location) {
        location = card.textContent || '';
      }

      // Limpeza para remover espaços gigantescos ou quebras de linha do HTML
      location = location.replace(/\s+/g, ' ').trim();


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
        if (el && el instanceof HTMLAnchorElement) {
          rawUrl = el.href;
          break;
        }
      }

      // A busca já utiliza f_AL=true na URL.
      // Todas as vagas retornadas devem ser Easy Apply.
      const easyApply = true;

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