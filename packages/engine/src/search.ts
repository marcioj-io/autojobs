// packages/engine/src/search.ts
import type { Page } from 'playwright';
import { normalize } from '@autojobs/scoring/src/utils/normalize';
import { LinkedInJobRecord, LinkedInSearchOptions } from './types/types';

/**
 * searchLinkedInJobs
 * - Navega a página de resultados já carregada no `page` (ou usa query/url já aplicada).
 * - Suporta infinite scroll e paginação por botão "Next".
 * - Respeita options.maxResults e options.processedJobIds para deduplicação.
 * - Retorna array de LinkedInJobRecord (campos mínimos preenchidos).
 *
 * Uso:
 *   const jobs = await searchLinkedInJobs(page, { query, location, profileName, profile, maxResults: 100, processedJobIds: [] });
 */

const DEFAULTS = {
  PAGE_SIZE_ESTIMATE: 25,
  SCROLL_STEP_MS: 600,
  SCROLL_ATTEMPTS: 40,
  JOB_CARD_SELECTORS: [
    '[data-job-id]',
    '[data-occludable-job-id]',
    '.job-card-container',
    '.result-card'
  ].join(',')
};

function safeText(el: Element | null): string {
  try {
    if (!el) return '';
    return (el.textContent || '').replace(/\s+/g, ' ').trim();
  } catch {
    return '';
  }
}

function extractJobIdFromElement(el: Element): string | null {
  try {
    const id = el.getAttribute('data-job-id') || el.getAttribute('data-occludable-job-id');
    if (id) return id;
    // fallback: try href with /jobs/view/<id>
    const a = el.querySelector('a[href*="/jobs/view/"]') as HTMLAnchorElement | null;
    if (a && a.href) {
      const m = a.href.match(/jobs\/view\/([^/?#]+)/);
      if (m) return m[1];
    }
    return null;
  } catch {
    return null;
  }
}

export async function searchLinkedInJobs(page: Page, options: LinkedInSearchOptions): Promise<LinkedInJobRecord[]> {
  const maxResults = options.maxResults ?? 100;
  const processed = new Set(options.processedJobIds || []);
  const out: LinkedInJobRecord[] = [];
  const startTs = Date.now();

  console.info('[SEARCH] Iniciando coleta de vagas', { query: options.query, location: options.location, maxResults });

  // Helper: collect job cards currently in DOM
  async function collectFromDom(): Promise<void> {
    try {
      const jobsOnPage = await page.evaluate((selectors) => {
        const nodes = Array.from(document.querySelectorAll(selectors));
        const items: any[] = [];
        for (const n of nodes) {
          try {
            const el = n as HTMLElement;
            const id = el.getAttribute('data-job-id') || el.getAttribute('data-occludable-job-id') || '';
            const titleEl = el.querySelector('.job-card-list__title, .job-card-container__link, a.job-card-list__title') as HTMLElement | null;
            const companyEl = el.querySelector('.job-card-container__company-name, .job-card-container__company, .job-result-card__subtitle') as HTMLElement | null;
            const locationEl = el.querySelector('.job-card-container__metadata-item, .job-card-container__location, .job-result-card__location') as HTMLElement | null;
            const easyApplyBtn = el.querySelector('button.jobs-apply-button, button[aria-label*="Easy apply"]') ? true : false;
            const urlEl = el.querySelector('a.job-card-list__title, a.job-card-container__link, a[href*="/jobs/view/"]') as HTMLAnchorElement | null;
            const postedAtEl = el.querySelector('time, .job-card-list__footer-wrapper time, .job-result-card__listdate') as HTMLElement | null;

            items.push({
              id: id || (urlEl ? urlEl.href : ''),
              title: titleEl ? titleEl.textContent?.trim() : '',
              company: companyEl ? companyEl.textContent?.trim() : '',
              location: locationEl ? locationEl.textContent?.trim() : '',
              url: urlEl ? urlEl.href : '',
              easyApply: Boolean(easyApplyBtn),
              postedAt: postedAtEl ? postedAtEl.textContent?.trim() : ''
            });
          } catch {
            // ignore per-node errors
          }
        }
        return items;
      }, DEFAULTS.JOB_CARD_SELECTORS);

      for (const j of jobsOnPage) {
        const id = String(j.id || '').trim();
        if (!id) continue;
        if (processed.has(id)) continue;
        processed.add(id);

        out.push({
          id,
          company: j.company || '',
          title: j.title || '',
          location: j.location || '',
          url: j.url || '',
          easyApply: Boolean(j.easyApply),
          postedAt: j.postedAt || '',
          description: '',
          language: 'PT',
          profileName: options.profileName
        } as LinkedInJobRecord);

        if (out.length >= maxResults) break;
      }
    } catch (e) {
      console.warn('[SEARCH] Erro ao coletar cards do DOM', e);
    }
  }

  // Strategy:
  // 1) Try to collect current DOM
  // 2) If not enough, perform incremental scrolls to trigger lazy load
  // 3) If still not enough, try "See more jobs" / Next button if present
  // 4) Stop when maxResults reached or no new items after several attempts

  await collectFromDom();

  // If already enough, return early
  if (out.length >= maxResults) {
    console.info('[SEARCH] Coleta inicial já atingiu maxResults', { found: out.length, elapsedMs: Date.now() - startTs });
    return out.slice(0, maxResults);
  }

  // 2) Infinite scroll attempts
  let lastCount = out.length;
  for (let attempt = 0; attempt < DEFAULTS.SCROLL_ATTEMPTS && out.length < maxResults; attempt++) {
    try {
      // Scroll near bottom to trigger lazy load
      await page.evaluate(() => window.scrollBy(0, Math.max(document.body.scrollHeight, window.innerHeight)));
      await page.waitForTimeout(DEFAULTS.SCROLL_STEP_MS);

      await collectFromDom();

      if (out.length > lastCount) {
        console.info('[SEARCH] Novas vagas carregadas via scroll', { attempt, newTotal: out.length });
        lastCount = out.length;
      } else {
        // small pause; if no new items for several attempts, break to next strategy
        if (attempt % 5 === 0) {
          // try clicking "See more jobs" or "Next" if exists
          const clicked = await page.evaluate(() => {
            const nextSelectors = [
              'button[aria-label*="See more jobs"]',
              'button[aria-label*="Ver mais vagas"]',
              'button[aria-label*="Next"]',
              'button[aria-label*="Próxima"]',
              'a[aria-label*="Next"]',
              'a[aria-label*="Próxima"]'
            ];
            for (const sel of nextSelectors) {
              const el = document.querySelector(sel) as HTMLElement | null;
              if (el && (el as HTMLButtonElement).click) {
                try { (el as HTMLElement).click(); return true; } catch { /* ignore */ }
              }
            }
            return false;
          });
          if (clicked) {
            await page.waitForTimeout(1200);
            await collectFromDom();
            if (out.length >= maxResults) break;
          }
        }
      }
    } catch (e) {
      console.warn('[SEARCH] Erro durante scroll attempt', attempt, e);
      await page.waitForTimeout(500);
    }
  }

  // 3) Final attempt: try to paginate via "Next" link if present (some LinkedIn views)
  if (out.length < maxResults) {
    try {
      const nextHref = await page.evaluate(() => {
        const a = document.querySelector('a[aria-label*="Next"], a[aria-label*="Próxima"], a[rel="next"]') as HTMLAnchorElement | null;
        return a ? a.href : null;
      });
      if (nextHref) {
        console.info('[SEARCH] Paginação via link Next detectada; navegando para próxima página', { nextHref });
        await page.goto(nextHref, { waitUntil: 'domcontentloaded', timeout: 10000 }).catch(() => {});
        await page.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => {});
        await collectFromDom();
      }
    } catch (e) {
      console.warn('[SEARCH] Falha ao tentar paginação via Next', e);
    }
  }

  // 4) Trim to maxResults and return
  const elapsed = Date.now() - startTs;
  console.info('[SEARCH] Coleta finalizada', { found: out.length, elapsedMs: elapsed });

  return out.slice(0, maxResults);
}
