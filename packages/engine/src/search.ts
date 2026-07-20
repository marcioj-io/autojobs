import type { Page } from 'playwright';
import type { LinkedInJobRecord, LinkedInSearchOptions } from './types/types';
import { selectorChains } from './selectors';
import { SelectorFallbackEngine } from './selectors/fallbacks/SelectorFallbackEngine';
import { buildLinkedInJobRecord } from './parsers';
import { randomDelay, retry } from './utils';

const SEARCH_URL = 'https://www.linkedin.com/jobs/search/';

const MODALITY_MAP: Record<string, string> = {
  'presencial': '1',
  'remoto': '2',
  'híbrido': '3'
};

function buildSearchUrl(query: string, location: string, modalities: string[] = ['remoto', 'híbrido']) {
  const fWT = modalities
    .map(m => MODALITY_MAP[m.toLowerCase()])
    .filter(Boolean)
    .join(',');

  const params = new URLSearchParams({ 
    keywords: query, 
    location: location,
    f_TPR: 'r86400',
    f_AL: 'true' // Vagas Easy Apply / Candidatura Simplificada
  });

  if (fWT) {
    params.append('f_WT', fWT);
  }

  return `${SEARCH_URL}?${params.toString()}`;
}

export async function searchLinkedInJobs(page: Page, options: LinkedInSearchOptions) {
  const fallbackEngine = new SelectorFallbackEngine();
  const url = buildSearchUrl(options.query, options.location, options.modalities);
  
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await randomDelay(1000, 2000);

  const jobCardSelector = await fallbackEngine.findFirstSelector(page, selectorChains.jobCard);
  if (!jobCardSelector) {
    throw new Error('Não foi possível localizar os cards de vagas do LinkedIn.');
  }

  await retry(async () => {
    await page.waitForSelector(jobCardSelector, { timeout: 15000 });
  }, 3, 1000);

  const rows = await page.$$eval(jobCardSelector, (cards, chains) => {
    const results = [];

    for (const card of cards) {
      const cardText = card.textContent?.toLowerCase() || '';

      // Descarta vagas já interagidas visualmente
      if (
        cardText.includes('candidatura enviada') || 
        cardText.includes('applied') ||   
        cardText.includes('aplicado') ||
        cardText.includes('viewed') ||  
        cardText.includes('visualizado')
      ) {
        continue;
      }

      // 1. Título
      let title = '';
      for (const sel of chains.title) {
        const el = card.querySelector(sel);
        if (el?.textContent?.trim()) { title = el.textContent.trim(); break; }
      }

      // 2. Empresa
      let company = '';
      for (const sel of chains.company) {
        const el = card.querySelector(sel);
        if (el?.textContent?.trim()) { company = el.textContent.trim(); break; }
      }

      // 3. Localização Resiliente (Estratégia em Camadas)
      let location = '';
      
      // Passagem A: Seletores configurados
      for (const sel of chains.location) {
        const el = card.querySelector(sel);
        if (el?.textContent?.trim()) { 
          location = el.textContent.trim(); 
          break; 
        }
      }

      // Passagem B: Caso os seletores falhem, busca em elementos específicos de metadata do LinkedIn
      if (!location) {
        const metaElements = card.querySelectorAll(
          '.job-card-container__metadata-item, .artdeco-entity-lockup__caption, ul.job-card-list__footer-wrapper li, .job-card-container__metadata-wrapper li'
        );
        for (const meta of Array.from(metaElements)) {
          const text = meta.textContent?.trim() || '';
          // Evita capturar contadores ou status
          if (text && !text.toLowerCase().includes('visualizad') && !text.toLowerCase().includes('candidat')) {
            location = text;
            break;
          }
        }
      }

      // 4. Data / Postado
      let postedAt = '';
      for (const sel of chains.postedAt) {
        const el = card.querySelector(sel);
        if (el?.textContent?.trim()) { postedAt = el.textContent.trim(); break; }
      }

      // 5. Descrição
      let description = '';
      for (const sel of chains.description) {
        const el = card.querySelector(sel);
        if (el?.textContent?.trim()) { description = el.textContent.trim(); break; }
      }

      // 6. URL
      let rawUrl = '';
      for (const sel of chains.url) {
        const el = card.querySelector(sel) as HTMLAnchorElement | null;
        if (el?.href) {
          rawUrl = el.href;
          break;
        }
      }

      if (!title || !rawUrl) continue;

      results.push({
        id: rawUrl,
        company,
        title,
        location,
        url: rawUrl,
        easyApply: true,
        postedAt,
        description
      });
    }

    return results;
  }, selectorChains);

  let parsedJobs = rows.map((job) =>
    buildLinkedInJobRecord({
      ...job,
      language: options.language,
      profileName: options.profileName
    })
  );

  if (options.processedJobIds && options.processedJobIds.length > 0) {
    parsedJobs = parsedJobs.filter(job => !options.processedJobIds!.includes(job.id));
  }

  return parsedJobs.slice(0, options.maxResults ?? 20);
}