// utils/index.ts
import { normalize } from '@autojobs/shared';
import type { Page } from 'playwright';

export function randomInteger(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

export function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function randomDelay(min = 500, max = 1500) {
  const ms = randomInteger(min, max);
  await delay(ms);
}

export async function retry<T>(fn: () => Promise<T>, attempts = 3, delayMs = 1000): Promise<T> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (attempt === attempts) break;
      await delay(delayMs * attempt);
    }
  }
  throw lastError;
}

export async function scrollPage(page: Page, duration = 1000, distance = 500) {
  await page.evaluate(
    async ({ duration, distance }) => {
      const step = distance / 20;
      const interval = duration / 20;
      for (let offset = 0; offset < distance; offset += step) {
        window.scrollBy(0, step);
        await new Promise((resolve) => setTimeout(resolve, interval));
      }
    },
    { duration, distance }
  );
  await randomDelay(300, 800);
}

export function safeSerialize(value: any, maxLen = 2000): string {
  if (value === null || value === undefined) return 'null';
  if (typeof value === 'string') {
    return value.length > maxLen ? value.slice(0, maxLen) + '...[truncated]' : value;
  }
  try {
    const seen = new WeakSet();
    const str = JSON.stringify(value, function (k, v) {
      if (v && typeof v === 'object') {
        if (seen.has(v)) return '[Circular]';
        seen.add(v);
      }
      if (typeof v === 'string' && v.length > maxLen) return v.slice(0, maxLen) + '...[truncated]';
      if (typeof v === 'function') return `[Function: ${v.name || 'anonymous'}]`;
      return v;
    }, 2);
    return str.length > maxLen ? str.slice(0, maxLen) + '...[truncated]' : str;
  } catch {
    try {
      return String(value).slice(0, maxLen) + '...[truncated]';
    } catch {
      return '[unserializable]';
    }
  }
}

export function normalizeForCompare(input?: string): string {
  if (!input) return '';
  // 1. Unicode normalize (separa diacríticos)
  let s = input.normalize('NFD');
  // 2. Remove diacríticos (acentos)
  s = s.replace(/[\u0300-\u036f]/g, '');
  // 3. Remove conteúdo entre parênteses e sufixos após vírgula
  s = s.replace(/\(.*?\)/g, '');
  s = s.replace(/,.*$/g, '');
  // 4. Remove caracteres não alfanuméricos, normaliza espaços e lower case
  s = s.replace(/[^a-zA-Z0-9\s-]/g, ' ');
  s = s.replace(/\s+/g, ' ').trim().toLowerCase();
  // 5. Normalizações simples de abreviações
  if (s === 'sp') return 'sao paulo';
  return s;
}

export type Modality = 'Remoto' | 'Presencial' | 'Híbrido';

export class ModalityDetector {
  detect(text: string): Modality {
    const norm = normalize(text || '');
    if (/(remot[oa]|remote|teletrabaj[oa]|home\s*office|work\s*from\s*home|wfh)/i.test(norm)) return 'Remoto';
    if (/(presencial|onsite|on-site|in-person|alocacao)/i.test(norm)) return 'Presencial';
    if (/(hibrid[oa]|hybrid)/i.test(norm)) return 'Híbrido';
    return 'Híbrido';
  }
}

