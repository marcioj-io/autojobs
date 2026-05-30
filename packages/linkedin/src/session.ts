import type { BrowserContext, Page } from 'playwright';
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
  const cookiesJson = await adapter.load(sessionId);
  if (!cookiesJson) {
    return false;
  }

  let cookies;
  try {
    cookies = JSON.parse(cookiesJson);
  } catch {
    return false;
  }

  if (Array.isArray(cookies) && cookies.length > 0) {
    await context.addCookies(cookies as any);
    await page.goto(LINKEDIN_HOME, { waitUntil: 'domcontentloaded' });
    await randomDelay(900, 1500);
    return !(await page.url()).includes('/login');
  }

  return false;
}

export async function persistLinkedInSession(context: BrowserContext, sessionId: string, adapter: LinkedInSessionAdapter) {
  const cookies = await context.cookies();
  await adapter.save(sessionId, JSON.stringify(cookies));
}

export async function requireManualLogin(page: Page): Promise<void> {
  await page.goto(LOGIN_PAGE, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('input[name=username], input#username', { timeout: 60000 });
  console.log('Please complete LinkedIn login in the browser window.');
  await page.waitForFunction(() => !window.location.href.includes('/login'), { timeout: 600000 });
  await randomDelay(1200, 2200);
}
