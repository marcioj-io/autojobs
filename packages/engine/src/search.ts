// packages/engine/src/search.ts
import crypto from 'crypto';
import type { Page } from 'playwright';
import { LinkedInJobRecord, LinkedInSearchOptions } from './types/types';

const DEFAULTS = {
  SCROLL_STEP_MS: 150,
  SCROLL_STEP_PX: 300,
  JOBS_PER_PAGE: 25,
  MAX_PAGES_TO_SCRAPE: 10,
  MIN_JOBS_TO_CONTINUE: 15,
  SCROLL_NO_NEW_LIMIT: 3,
  NAVIGATION_TIMEOUT_MS: 40000,
  LIST_SELECTOR_TIMEOUT_MS: 30000
};

interface ScrapedJob {
  id: string;
  title: string;
  company: string;
  location: string;
  url: string;
  easyApply: boolean;
  postedAt: string;
}

interface ScrollResult {
  success?: boolean;
  reason?: string;
  finalCount?: number;
  iterations?: number;
}

/* ---------- Utilitários: retry/backoff, validação ---------- */

async function retry<T>(fn: () => Promise<T>, attempts = 3, baseMs = 500): Promise<T> {
  let lastErr: any;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (i === attempts - 1) break;
      const backoff = baseMs * Math.pow(2, i) + Math.floor(Math.random() * 100);
      await new Promise((r) => setTimeout(r, backoff));
    }
  }
  throw lastErr;
}

function safeString(v: any): string {
  return v == null ? '' : String(v);
}

function isValidUrl(u: string): boolean {
  try {
    const parsed = new URL(u);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

function validateScrapedJob(j: Partial<ScrapedJob>): j is ScrapedJob {
  if (!j) return false;
  const id = safeString(j.id).trim();
  const title = safeString(j.title).trim();
  const url = safeString(j.url).trim();
  if (!id) return false;
  if (!title) return false;
  if (!url) return false;
  if (!isValidUrl(url) && !/^\d+$/.test(id)) return false;
  return true;
}

/* ---------- Exported function: searchLinkedInJobs ---------- */

export async function searchLinkedInJobs(page: Page, options: LinkedInSearchOptions): Promise<LinkedInJobRecord[]> {
  const maxResults = Number(options.maxResults ?? 100);
  const processed = new Set<string>(Array.isArray(options.processedJobIds) ? options.processedJobIds : []);
  const seenFingerprints = new Set<string>();
  const out: LinkedInJobRecord[] = [];

  function buildSearchUrl(startOffset = 0): string {
    const url = new URL('https://www.linkedin.com/jobs/search/');
    if (options.query) url.searchParams.set('keywords', options.query);
    if (options.location) url.searchParams.set('location', options.location);
    url.searchParams.set('f_AL', 'true');      // Easy Apply
    url.searchParams.set('f_TPR', 'r86400');   // Últimas 24h
    url.searchParams.set('sortBy', 'DD');      // Mais recentes
    url.searchParams.set('start', String(startOffset));
    return url.toString();
  }

  for (let pageIndex = 0; pageIndex < DEFAULTS.MAX_PAGES_TO_SCRAPE; pageIndex++) {
    if (out.length >= maxResults) break;

    const offset = pageIndex * DEFAULTS.JOBS_PER_PAGE;
    const currentUrl = buildSearchUrl(offset);

    // Navegação com retry/backoff
    try {
      await retry(
        () => page.goto(currentUrl, { waitUntil: 'domcontentloaded', timeout: DEFAULTS.NAVIGATION_TIMEOUT_MS }),
        3,
        800
      );
    } catch (navErr) {
      console.error(`❌ Falha crítica ao navegar para a página do LinkedIn. Interrompendo busca.`);
      break;
    }

    // Verifica se a lista de resultados apareceu
    const listSelectors = [
      '.jobs-search-results-list',
      '.scaffold-layout__list',
      'ul.scaffold-layout__list-container',
      '.jobs-search__left-rail'
    ];
    let listAttached = null;
    try {
      listAttached = await retry(
        () => page.waitForSelector(listSelectors.join(','), { state: 'attached', timeout: DEFAULTS.LIST_SELECTOR_TIMEOUT_MS }),
        2,
        500
      ).catch(() => null);
    } catch {
      listAttached = null;
    }

    if (!listAttached) {
      // Detecta bloqueio/CAPTCHA
      const isBlocked = await page.$('iframe#captcha-internal, .px-captcha, #challenge-form').catch(() => null);
      if (isBlocked) {
        console.error('🛑 CAPTCHA ou bloqueio do LinkedIn detectado. A busca foi interrompida.');
        break;
      }

      // Detecta "no results"
      const noResults = await page.$('.jobs-search-two-pane__no-results-banner--expand, .jobs-search-no-results-banner, .jobs-search-results-list__text-no-results').catch(() => null);
      if (noResults) {
        break; // Sai silenciosamente, pois só acabaram as vagas
      }
      break;
    }

    // Aguarda pelo menos 1 card (hidratação)
    await page.waitForSelector('.job-card-container', { state: 'attached', timeout: 5000 }).catch(() => null);

    // Scroll robusto e nativo no Playwright
    try {
      const containerSelectors = ['.jobs-search-results-list', '.scaffold-layout__list', '.jobs-search__left-rail', 'ul.scaffold-layout__list-container'];
      
      await page.evaluate(
        async ({ stepPx, stepMs, noNewLimit, cardSelector, selectors }) => {
          const findContainer = () => {
            for (const sel of selectors) {
              const el = document.querySelector(sel);
              if (el) return el;
            }
            return null;
          };

          const container = findContainer();
          if (!container) return { success: false, reason: 'container_not_found' };

          let prevCount = 0;
          let sameCount = 0;
          const getCardCount = () => container.querySelectorAll(cardSelector).length;

          const maxIterations = 200;
          let iterations = 0;
          while (sameCount < noNewLimit && iterations < maxIterations) {
            container.scrollBy(0, stepPx);
            await new Promise(r => setTimeout(r, stepMs));
            const count = getCardCount();
            if (count === prevCount) sameCount++; else { sameCount = 0; prevCount = count; }
            iterations++;
          }

          container.scrollTo(0, 0);
          return { success: true, finalCount: prevCount, iterations };
        },
        { 
          stepPx: DEFAULTS.SCROLL_STEP_PX, 
          stepMs: DEFAULTS.SCROLL_STEP_MS, 
          noNewLimit: DEFAULTS.SCROLL_NO_NEW_LIMIT, 
          cardSelector: '.job-card-container', 
          selectors: containerSelectors 
        }
      ).catch(() => null); // Falhas de scroll são silenciadas para não sujar o log
    } catch (scrollErr) {
      // Ignorado
    }

    // Pequena espera pós-scroll
    await page.waitForTimeout(500);

    // Coleta do DOM (executado no browser) - anti-viewed reforçado
    const jobsOnPage: ScrapedJob[] = await page.evaluate(() => {
      const cards = Array.from(document.querySelectorAll('.job-card-container'));
      const items: ScrapedJob[] = [];

      for (const el of cards) {
        try {
          const footerText = (el.querySelector('.job-card-container__footer-wrapper, .tvm__text')?.textContent || '').toLowerCase();
          const badgeText = (el.querySelector('.job-card-list__footer, .job-card-badge')?.textContent || '').toLowerCase();
          const ariaLabel = (el.getAttribute('aria-label') || '').toLowerCase();
          const combined = `${footerText} ${badgeText} ${ariaLabel}`;

          const viewedIndicators = ['visualizada', 'viewed', 'candidatura enviada', 'applied', 'already applied', 'you applied', 'candidatura', 'inscrito'];
          const isViewed = viewedIndicators.some(ind => combined.includes(ind));

          if (isViewed) continue;

          const id = el.getAttribute('data-job-id') || el.getAttribute('data-occludable-job-id') || '';
          const titleEl = el.querySelector('.job-card-list__title, .job-card-container__link');
          const companyEl = el.querySelector('.job-card-container__company-name');
          const locationEl = el.querySelector('.job-card-container__metadata-item, .job-card-container__location');
          const urlEl = titleEl as HTMLAnchorElement | null;

          items.push({
            id: id || '',
            title: titleEl ? titleEl.textContent?.trim() || '' : '',
            company: companyEl ? companyEl.textContent?.trim() || '' : '',
            location: locationEl ? locationEl.textContent?.trim() || '' : '',
            url: urlEl && urlEl.href ? urlEl.href.split('?')[0] : '',
            easyApply: true,
            postedAt: 'Últimas 24h'
          });
        } catch {
          // swallow per-card errors
        }
      }
      return items;
    }).catch(() => {
      return [];
    });

    for (const j of jobsOnPage) {
      if (out.length >= maxResults) break;

      const id = String(j.id || '').trim();
      if (!id) continue;

      // Normaliza URL fallback
      const url = j.url && isValidUrl(j.url) ? j.url : `https://www.linkedin.com/jobs/view/${id}`;
      const title = safeString(j.title || '').trim();

      // fingerprint para deduplicação adicional
      const fp = crypto.createHash('sha1').update(`${url}|${title}`).digest('hex');

      if (processed.has(id) || seenFingerprints.has(fp)) {
        processed.add(id);
        seenFingerprints.add(fp);
        continue;
      }

      processed.add(id);
      seenFingerprints.add(fp);

      const scraped: Partial<ScrapedJob> = {
        id,
        title: j.title || '',
        company: j.company || '',
        location: j.location || '',
        url,
        easyApply: Boolean(j.easyApply),
        postedAt: j.postedAt || ''
      };

      if (!validateScrapedJob(scraped)) continue; // Sem logs, apenas pula

      out.push({
        id,
        company: scraped.company,
        title: scraped.title,
        location: scraped.location,
        url: scraped.url,
        easyApply: Boolean(scraped.easyApply),
        postedAt: scraped.postedAt || '',
        description: '',
        language: 'PT',
        profileName: options.profileName
      } as LinkedInJobRecord);
    }

    // Heurística de fim de paginação
    if (jobsOnPage.length < DEFAULTS.MIN_JOBS_TO_CONTINUE) {
      break;
    }
  }

  return out;
}