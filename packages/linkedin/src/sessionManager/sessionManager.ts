import type { BrowserContext, BrowserContextOptions, Page } from 'playwright';
import type { BrowserManager } from '../browser/manager';
import type { LinkedInSessionAdapter } from '../types';
import { randomDelay, retry, scrollPage } from '../utils';

const LINKEDIN_HOME = 'https://www.linkedin.com/feed/';
const LINKEDIN_LOGIN = 'https://www.linkedin.com/login';
const LINKEDIN_CHECKPOINT = '/checkpoint/';
const LINKEDIN_AUTH_PATH = '/uas/login';

export interface LinkedInSessionManagerOptions {
  loginTimeoutMs?: number;
  validationTimeoutMs?: number;
  minimumDelayMs?: number;
}

export interface LinkedInSessionResult {
  context: BrowserContext;
  page: Page;
  restored: boolean;
}

export class LinkedInSessionManager {
  constructor(
    private adapter: LinkedInSessionAdapter,
    private sessionId: string,
    private options: LinkedInSessionManagerOptions = {}
  ) {}

  async loadStorageState(): Promise<string | null> {
    return this.adapter.load(this.sessionId);
  }

  async saveStorageState(context: BrowserContext): Promise<void> {
    const state = await context.storageState();
    await this.adapter.save(this.sessionId, JSON.stringify(state));
  }

  async restoreAuthenticatedSession(browserManager: BrowserManager): Promise<LinkedInSessionResult | null> {
    const storageState = await this.loadStorageState();
    if (!storageState) {
      return null;
    }

    const { context, page } = await this.openPage(browserManager, storageState);
    const active = await this.validateSession(context, page);
    if (!active) {
      await context.close();
      return null;
    }

    return { context, page, restored: true };
  }

  async bootstrapLogin(browserManager: BrowserManager): Promise<LinkedInSessionResult> {
    const { context, page } = await this.openPage(browserManager);
    await this.promptManualLogin(page);
    await this.saveStorageState(context);
    return { context, page, restored: false };
  }

  private async openPage(browserManager: BrowserManager, storageState?: string): Promise<{ context: BrowserContext; page: Page }> {
    const storage = storageState ? JSON.parse(storageState) as BrowserContextOptions['storageState'] : undefined;
    const context = await browserManager.newContext({ storageState: storage });
    const page = await context.newPage();
    await randomDelay(800, 1500);
    return { context, page };
  }

  private async validateSession(context: BrowserContext, page: Page): Promise<boolean> {
    await retry(async () => {
      await page.goto(LINKEDIN_HOME, { waitUntil: 'domcontentloaded' });
    }, 3, 1200);

    await randomDelay(900, 1700);
    await scrollPage(page, 1000, 600);

    const pageUrl = page.url();
    if (this.isLoginRedirect(pageUrl)) {
      return false;
    }

    const loginForm = await page.$('form.login__form, input[name=username], input#username');
    if (loginForm) {
      return false;
    }

    const cookies = await context.cookies();
    return cookies.some((cookie) => ['li_at', 'JSESSIONID', 'bcookie', 'bscookie'].includes(cookie.name));
  }

  private async promptManualLogin(page: Page): Promise<void> {
    await retry(async () => {
      await page.goto(LINKEDIN_LOGIN, { waitUntil: 'domcontentloaded' });
    }, 3, 1200);

    await page.waitForSelector('input[name=username], input#username', {
      timeout: this.options.loginTimeoutMs ?? 60000
    });

    console.log('LinkedIn login iniciado. Complete o login na janela do navegador.');
    await page.waitForFunction(
      () => !window.location.href.includes('/login') && !window.location.href.includes('/checkpoint/') && !window.location.href.includes('/uas/login'),
      { timeout: this.options.loginTimeoutMs ?? 600000 }
    );

    await randomDelay(1200, 2400);
    await scrollPage(page, 1200, 900);
  }

  private isLoginRedirect(url: string) {
    return (
      url.includes(LINKEDIN_LOGIN) ||
      url.includes(LINKEDIN_CHECKPOINT) ||
      url.includes(LINKEDIN_AUTH_PATH)
    );
  }
}
