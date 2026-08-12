import crypto from 'crypto';
import type { Page } from 'playwright';

import {
  LinkedInJobRecord,
  LinkedInSearchOptions,
} from './types';
import { TitleEligibilityValidator, normalize } from '@autojobs/shared';


const DEFAULTS = {
  SCROLL_STEP_MS: 150,
  SCROLL_STEP_PX: 300,
  JOBS_PER_PAGE: 25,
  MAX_PAGES_TO_SCRAPE: 10,
  MIN_JOBS_TO_CONTINUE: 8,
  SCROLL_NO_NEW_LIMIT: 3,
  NAVIGATION_TIMEOUT_MS: 100000,
  LIST_SELECTOR_TIMEOUT_MS: 30000,
  MAX_SCROLL_ITERATIONS: 200,
  PAGE_DOWN_FALLBACK_ATTEMPTS: 6,
  PAGE_DOWN_WAIT_MS: 450,
};

type WorkplaceType =
  | 'REMOTE'
  | 'HYBRID'
  | 'ONSITE'
  | 'UNKNOWN';

type ScrapedJob = {
  id: string;
  title: string;
  company?: string;
  location?: string;
  workplaceType: WorkplaceType;
  url: string;
  easyApply: boolean;
  postedAt?: string;
  isViewed?: boolean;
  metadata: string[];
};

type SearchTelemetry = {
  pagesScraped: number;
  uniqueFound: number;
  blocked: boolean;
  reason?: string;
};

/* -----------------------
Utilities
----------------------- */

const safeString = (value: unknown): string =>
  value == null ? '' : String(value);

const normalizeUrl = (urlValue: string): string => {
  try {
    const url = new URL(urlValue);
    url.search = '';
    return url.toString().replace(/\/+$/, '');
  } catch {
    return urlValue.replace(/\?.*$/, '').replace(/\/+$/, '');
  }
};

const isValidUrl = (value: string): boolean => {
  try {
    const parsed = new URL(value);
    return (
      parsed.protocol === 'http:' ||
      parsed.protocol === 'https:'
    );
  } catch {
    return false;
  }
};

const fingerprintFor = (
  jobUrl: string,
  title: string
): string => {
  const normalized = `${normalizeUrl(jobUrl)}|${title.trim().toLowerCase()}`;
  return crypto
    .createHash('sha1')
    .update(normalized)
    .digest('hex');
};

const validateScrapedJob = (
  job: Partial<ScrapedJob>
): job is ScrapedJob => {
  const id = safeString(job.id).trim();
  const title = safeString(job.title).trim();
  const url = safeString(job.url).trim();

  if (!id || !title || !url) {
    return false;
  }

  if (!isValidUrl(url) && !/^\d+$/.test(id)) {
    return false;
  }

  return true;
};

/* -----------------------
Workplace Normalizer
----------------------- */

class WorkplaceNormalizer {
  static normalize(
    metadata: string[]
  ): {
    location: string;
    workplaceType: WorkplaceType;
  } {
    const text = metadata.join(' ').toLowerCase();
    let workplaceType: WorkplaceType = 'UNKNOWN';

    if (
      text.includes('remoto') ||
      text.includes('remote') ||
      text.includes('home office')
    ) {
      workplaceType = 'REMOTE';
    } else if (
      text.includes('híbrido') ||
      text.includes('hibrido') ||
      text.includes('hybrid')
    ) {
      workplaceType = 'HYBRID';
    } else if (
      text.includes('presencial') ||
      text.includes('onsite') ||
      text.includes('on-site')
    ) {
      workplaceType = 'ONSITE';
    }

    const location = metadata
      .filter(item => {
        const value = item.toLowerCase();
        return ![
          'remoto',
          'remote',
          'home office',
          'híbrido',
          'hibrido',
          'hybrid',
          'presencial',
          'onsite',
          'on-site',
        ].some(keyword => value.includes(keyword));
      })
      .join(', ');

    return {
      location,
      workplaceType,
    };
  }
}

/* -----------------------
ScrollController
----------------------- */

class ScrollController {
  constructor(private readonly page: Page) {}

  async scrollResults(
    selectors: string[],
    cardSelector: string,
    options?: {
      stepPx?: number;
      stepMs?: number;
      noNewLimit?: number;
      maxIterations?: number;
    }
  ) {
    const {
      stepPx = DEFAULTS.SCROLL_STEP_PX,
      stepMs = DEFAULTS.SCROLL_STEP_MS,
      noNewLimit = DEFAULTS.SCROLL_NO_NEW_LIMIT,
      maxIterations = DEFAULTS.MAX_SCROLL_ITERATIONS,
    } = options ?? {};

    try {
      return await this.page.evaluate(
        async ({
          selectors,
          cardSelector,
          stepPx,
          stepMs,
          noNewLimit,
          maxIterations,
        }) => {
          const container = selectors
            .map(selector => document.querySelector(selector))
            .find(Boolean) as HTMLElement | undefined;

          if (!container) {
            return {
              success: false,
              finalCount: 0,
              iterations: 0,
              reason: 'container_not_found',
            };
          }

          let previous = 0;
          let same = 0;
          let iterations = 0;

          while (
            same < noNewLimit &&
            iterations < maxIterations
          ) {
            container.scrollBy(0, stepPx);
            await new Promise(resolve => setTimeout(resolve, stepMs));

            const count = container.querySelectorAll(cardSelector).length;

            if (count === previous) {
              same++;
            } else {
              same = 0;
              previous = count;
            }

            iterations++;
          }

          container.scrollTo(0, 0);

          return {
            success: true,
            finalCount: previous,
            iterations,
          };
        },
        {
          selectors,
          cardSelector,
          stepPx,
          stepMs,
          noNewLimit,
          maxIterations,
        }
      );
    } catch {
      return {
        success: false,
        finalCount: 0,
        iterations: 0,
        reason: 'scroll_error',
      };
    }
  }
}

/* -----------------------
JobExtractor
----------------------- */
const CARD_SELECTOR = [
  '.job-card-container',
  '.base-search-card', // Suporte para versão deslogada
  'li.jobs-search-results__list-item'
].join(',');

class JobExtractor {
  static async extractFromPage(page: Page): Promise<ScrapedJob[]> {
    try {
      const raw = await page.evaluate((cardSelector) => {
        const nodes = Array.from(document.querySelectorAll(cardSelector));
        const results: any[] = [];

        for (const card of nodes) {
          try {
            // 1. Ignorar skeletons / placeholders
            if (card.classList && card.classList.contains('ghost-job-card')) continue;
            if (card.querySelector && card.querySelector('.msg-overlay-list-bubble')) continue;

            // 2. Extração de Título e Link
            const titleEl = card.querySelector(
              '.job-card-list__title, .artdeco-entity-lockup__title, .base-search-card__title, [data-test-job-title], .job-card-container__link strong'
            );
            let title = titleEl?.textContent?.trim() ?? '';

            const linkEl = card.querySelector('a.job-card-list__title, a.job-card-container__link, a[href*="/jobs/view/"]') as HTMLAnchorElement | null;
            if (!title && linkEl) title = (linkEl.textContent || '').trim();
            title = title.replace(/\s+/g, ' '); // Limpa quebras de linha

            // 3. Extração da Empresa
            const companyEl = card.querySelector('.job-card-container__company-name, .job-card-list__company-name, .artdeco-entity-lockup__subtitle, .base-search-card__subtitle');
            const company = companyEl?.textContent?.trim().replace(/\s+/g, ' ') ?? '';

            // 4. Extração de Localização
            const locationEl = card.querySelector('.job-card-container__metadata-item, .job-card-list__location, .artdeco-entity-lockup__caption span, .job-search-card__location, [data-test-job-location]');
            const explicitLocation = locationEl?.textContent?.trim().replace(/\s+/g, ' ') ?? '';

            // 5. Metadata (Remote, Hybrid, Onsite, etc)
            const metadataEls = Array.from(card.querySelectorAll('.job-card-container__metadata-item, .job-card-container__metadata-wrapper li, .artdeco-entity-lockup__caption li'));
            const metadata = metadataEls.map(e => (e.textContent || '').trim().replace(/\s+/g, ' ')).filter(Boolean);

            // 6. ID da Vaga
            let id = card.getAttribute('data-job-id') || card.getAttribute('data-occludable-job-id') || '';
            if (!id && linkEl?.href) {
              const m = linkEl.href.match(/\/jobs\/view\/(?:.*-)?(\d+)/);
              if (m) id = m[1];
            }

            // 7. Tempo de Publicação
            const postedAtEl = card.querySelector('time, .job-search-card__listdate, .posted-time-ago__text, [data-test-posted-at]');
            const postedAt = postedAtEl?.getAttribute('datetime') ?? postedAtEl?.textContent?.trim() ?? '';

            // 8. CORREÇÃO: Detecção de "Vaga Visualizada"
            const cardText = (card.textContent || '').toLowerCase();
            const isViewed = 
              /\b(viewed|visualizada|vista)\b/i.test(cardText) || 
              (card.querySelector && card.querySelector('.job-card-container__footer-item--viewed, [aria-label*="viewed" i], [aria-label*="visualizada" i]') !== null);

            // 9. CORREÇÃO DA DETECÇÃO EASY APPLY
            // Lembre-se: O cartão de busca não tem botão de aplicar, apenas um texto/badge indicativo.
            let easyApply = false;
            
            // Verificação via seletores da badge/ícone do Easy Apply (muito mais seguro)
            const easyApplyBadgeSelector = card.querySelector(
                '.job-card-container__apply-method, [data-test-easy-apply-badge], .job-card-list__insight svg'
            );
            if (easyApplyBadgeSelector) {
                easyApply = true;
            }

            // Verificação via texto do cartão (Fallback seguro)
            if (!easyApply) {
              const easyApplyKeywords = [
                'easy apply', 
                'candidatura simplificada', 
                'solicitud sencilla', 
                'candidatura rápida'
              ];
              easyApply = easyApplyKeywords.some(keyword => cardText.includes(keyword));
            }
            
            // NOTA: Como a URL já inclui f_AL=true, podemos assumir fortemente que a vaga é Easy Apply, 
            // mas mantemos o filtro para barrar anúncios patrocinados (Promoted) que furam o filtro do LinkedIn.

            results.push({
              id,
              title,
              company,
              metadata,
              url: (linkEl?.href || '').split('?')[0],
              easyApply,
              postedAt,
              isViewed,
              explicitLocation,
            });
          } catch (inner) {
            // Se um card der erro, não quebra a página inteira
            continue;
          }
        }

        return results;
      }, CARD_SELECTOR);

      // Normalização fora do evaluate
      return raw.map((item: any) => {
        const normalized = WorkplaceNormalizer.normalize(item.metadata || []);
        return {
          id: item.id,
          title: item.title,
          company: item.company,
          location: item.explicitLocation || normalized.location,
          workplaceType: normalized.workplaceType,
          url: item.url,
          easyApply: Boolean(item.easyApply),
          postedAt: item.postedAt,
          isViewed: Boolean(item.isViewed),
          metadata: item.metadata || [],
        } as ScrapedJob;
      });
    } catch (e) {
      console.error('[JobExtractor] Erro crítico ao avaliar página:', e);
      return [];
    }
  }
}

/* -----------------------
SearchService
----------------------- */
export async function searchLinkedInJobs(
  page: Page,
  options: LinkedInSearchOptions
): Promise<LinkedInJobRecord[]> {
  const maxResults = Number(options.maxResults ?? 100);

  const processed = new Set(
    Array.isArray(options.processedJobIds)
      ? options.processedJobIds
      : []
  );

  const fingerprints = new Set<string>();
  const results: LinkedInJobRecord[] = [];

  const telemetry: SearchTelemetry = {
    pagesScraped: 0,
    uniqueFound: 0,
    blocked: false,
  };

  const buildSearchUrl = (offset: number) => {
    const url = new URL('https://www.linkedin.com/jobs/search/');

    if (options.query)
      url.searchParams.set('keywords', options.query);

    if (options.location)
      url.searchParams.set('location', options.location);

    url.searchParams.set('f_AL', 'true');
    url.searchParams.set('f_TPR', 'r86400');
    url.searchParams.set('sortBy', 'DD');
    url.searchParams.set('start', String(offset));

    return url.toString();
  };

  const selectors = [
    '.jobs-search-results-list',
    '.scaffold-layout__list',
    'ul.scaffold-layout__list-container',
    '.jobs-search__left-rail',
  ];

  for (
    let pageIndex = 0;
    pageIndex < DEFAULTS.MAX_PAGES_TO_SCRAPE;
    pageIndex++
  ) {
    if (results.length >= maxResults)
      break;

    await page.goto(
      buildSearchUrl(
        pageIndex * DEFAULTS.JOBS_PER_PAGE
      ),
      {
        waitUntil: 'domcontentloaded',
        timeout: DEFAULTS.NAVIGATION_TIMEOUT_MS,
      }
    );

    await page.waitForTimeout(1000);

    await new ScrollController(page)
      .scrollResults(
        selectors,
        CARD_SELECTOR
      );

    const jobs = await JobExtractor.extractFromPage(page);
    if (jobs.length === 0) {
      console.warn('[SEARCH] Fim dos resultados alcançado., Interrompendo paginação.', {
        query: options.query,
        location: options.location,
        url: page.url()
      });
      break;
    }

    for (const job of jobs) {
      if (results.length >= maxResults)
        break;

      if (!job.id) {
        console.warn('[SEARCH] Vaga descartada sem id ou url válidos.', {
          title: job.title,
          company: job.company,
          metadata: job.metadata.slice(0, 5),
          query: options.query,
          location: options.location,
        });
        continue;
      }

      if (job.isViewed) {
        console.info('[SEARCH] Vaga descartada porque já foi visualizada.', { id: job.id, title: job.title, query: options.query });
        continue;
      }

      const missingFields = [] as string[];
      if (!job.location) missingFields.push('location');
      if (!job.title) missingFields.push('title');
      if (!job.url) missingFields.push('url');
      if (!job.company) missingFields.push('company');
      if (missingFields.length) {
        console.warn('[SEARCH] Vaga extraída com campos ausentes.', {
          id: job.id,
          title: job.title,
          missingFields,
          metadata: job.metadata.slice(0, 5),
          query: options.query,
        });
      }

      if (options.profile) {
        const titleCheck = TitleEligibilityValidator.validate(job.title, options.profile);

        if (!titleCheck.eligible) {
          console.info('[SEARCH] Vaga descartada por TitleEligibilityValidator.', {
            id: job.id,
            title: job.title,
            reason: titleCheck.reason,
            profileName: options.profileName,
            query: options.query,
          });
          continue;
        }
      }

      const url = isValidUrl(job.url)
        ? normalizeUrl(job.url)
        : `https://www.linkedin.com/jobs/view/${job.id}`;

      const fingerprint = fingerprintFor(url, job.title);

      if (processed.has(job.id) || fingerprints.has(fingerprint)) {
        console.info('[SEARCH] Vaga descartada por duplicata.', { id: job.id, title: job.title, query: options.query });
        continue;
      }

      processed.add(job.id);
      fingerprints.add(fingerprint);

      results.push({
        id: job.id,
        title: job.title,
        company: job.company ?? '',
        location: job.location ?? '',
        workplaceType: job.workplaceType,
        url,
        easyApply: job.easyApply,
        postedAt: job.postedAt ?? '',
        description: '',
        language: detectLanguage(`${job.title} ${job.company ?? ''} ${job.location ?? ''}`),
        profileName: options.profileName,
      } as LinkedInJobRecord);
    }

    telemetry.pagesScraped++;
  }

  telemetry.uniqueFound = results.length;
  if (results.length === 0) {
    console.warn('[SEARCH] Nenhum resultado válido encontrado após aplicar filtros de título e duplicatas.', {
      query: options.query,
      location: options.location,
      pageUrl: page.url()
    });
  }

  console.info('[SEARCH] Finalizado', telemetry);

  return results;
}

function detectLanguage(text: string): 'PT' | 'EN' | 'ES' {
  const normalizedText = normalize(text || '');
  if (/(please|developer|engineer|remote|onsite|hybrid|full stack|software)/i.test(normalizedText)) return 'EN';
  if (/(desenvolvedor|engenheiro|remoto|híbrido|hibrido|presencial|vaga|desenvolvimento)/i.test(normalizedText)) return 'PT';
  if (/(desarrollador|ingeniero|remoto|híbrido|hibrido|presencial|por favor)/i.test(normalizedText)) return 'ES';
  return 'PT';
}