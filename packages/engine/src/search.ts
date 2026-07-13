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
  const url = buildSearchUrl(options.query, options.location, options.modalities);
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
      const cardText = card.textContent?.toLowerCase() || '';

      // 🛡️ ESCUDO VISUAL: Ignora vagas que o LinkedIn já diz que você interagiu
      if (
        cardText.includes('candidatura enviada') || 
        cardText.includes('applied') || 
        cardText.includes('visualizado') || 
        cardText.includes('viewed')
      ) {
        continue; // Pula imediatamente para o próximo card
      }

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

  // Mapeia e sanitiza as vagas encontradas
  let parsedJobs = rows
    .filter((job) => job.url)
    .map((job) =>
      buildLinkedInJobRecord({
        ...job,
        language: options.language,
        profileName: options.profileName
      })
    );

  // 🛡️ ESCUDO DE BANCO DE DADOS: Remove as vagas que já existem no seu banco
  if (options.processedJobIds && options.processedJobIds.length > 0) {
    const totalBefore = parsedJobs.length;
    parsedJobs = parsedJobs.filter(job => !options.processedJobIds!.includes(job.id));
    const blockedCount = totalBefore - parsedJobs.length;
    if (blockedCount > 0) {
      console.log(`⏩ [Filtro DB] ${blockedCount} vagas ignoradas no Search (já processadas anteriormente).`);
    }
  }

  // Retorna apenas a quantidade solicitada após passar por todos os filtros
  return parsedJobs.slice(0, options.maxResults ?? 20);
}