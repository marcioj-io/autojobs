import type { BrowserContext, Page, Cookie } from 'playwright';
import type { LinkedInSessionAdapter } from './types';
import { randomDelay } from './utils';

const LINKEDIN_HOME = 'https://www.linkedin.com/feed/';
const LOGIN_PAGE = 'https://www.linkedin.com/login';

export async function restoreLinkedInSession(
  context: BrowserContext,
  page: Page,
  sessionId: string,
  adapter: LinkedInSessionAdapter
): Promise<boolean> {
  const cookies = await adapter.load(sessionId);

  if (!cookies || cookies.length === 0) {
    return false;
  }

  await context.addCookies(cookies);
  await page.goto(LINKEDIN_HOME, { waitUntil: 'domcontentloaded' });

  await randomDelay(900, 1500);

  return !(await page.url()).includes('/login');
}

export async function persistLinkedInSession(
  context: BrowserContext,
  sessionId: string,
  adapter: LinkedInSessionAdapter
): Promise<void> {
  const cookies = await context.cookies();
  await adapter.save(sessionId, cookies);
}

export async function requireManualLogin(page: Page): Promise<void> {
  await page.goto(LOGIN_PAGE, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('input[name=username], input#username', { timeout: 60000 });

  console.log('Please complete LinkedIn login in the browser window.');

  await page.waitForFunction(
    () => !window.location.href.includes('/login'),
    { timeout: 600000 }
  );

  await randomDelay(1200, 2200);
}