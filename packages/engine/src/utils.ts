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
