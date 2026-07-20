// packages/engine/src/browser/browserManager.ts
import { chromium } from 'playwright-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import type { Browser, BrowserContext, BrowserContextOptions, Page } from 'playwright';
import { randomDelay } from '../utils/utils';
import { buildBrowserFingerprint } from '../fingerprints/BrowserFingerprint';

chromium.use(StealthPlugin());

export interface BrowserManagerOptions {
  headless?: boolean;
  userAgent?: string;
}

export class BrowserManager {
  private static instance: BrowserManager;
  private browser: Browser | null = null;
  private contexts: Map<string, BrowserContext> = new Map();
  private readonly persistentFingerprint = buildBrowserFingerprint();

  private constructor(private readonly options: BrowserManagerOptions = {}) {}

  public static getInstance(options: BrowserManagerOptions = {}): BrowserManager {
    if (!BrowserManager.instance) {
      BrowserManager.instance = new BrowserManager(options);
    }
    return BrowserManager.instance;
  }

  async launch(): Promise<Browser> {
    if (this.browser) return this.browser;
    const wsEndpoint = process.env.BROWSER_WS_ENDPOINT;
    try {
      if (wsEndpoint) {
        this.browser = await chromium.connect({ wsEndpoint, timeout: 30000 });
      } else {
        this.browser = await chromium.launch({
          headless: this.options.headless ?? true,
          args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-gpu',
            '--disable-software-rasterizer',
            '--disable-extensions',
            '--mute-audio',
            '--disable-blink-features=AutomationControlled'
          ]
        });
      }
    } catch (err) {
      if (this.browser) {
        await this.browser.close().catch(() => {});
        this.browser = null;
      }
      throw err;
    }
    await randomDelay(800, 1400);
    return this.browser;
  }

  private buildContextOptions(options: BrowserContextOptions = {}, storageState?: string | object): BrowserContextOptions {
    const ctxOptions: BrowserContextOptions = {
      ...options,
      userAgent: options.userAgent ?? this.options.userAgent ?? this.persistentFingerprint.userAgent,
      locale: options.locale ?? this.persistentFingerprint.locale,
      timezoneId: options.timezoneId ?? this.persistentFingerprint.timezoneId,
      viewport: options.viewport ?? this.persistentFingerprint.viewport
    } as BrowserContextOptions;

    if (storageState) {
      // Playwright accepts storageState as object or path; pass through
      (ctxOptions as any).storageState = storageState;
    }

    return ctxOptions;
  }

  async getContext(sessionId = 'default', options: BrowserContextOptions = {}, storageState?: string | object): Promise<BrowserContext> {
    // Reuse existing context if healthy
    if (this.contexts.has(sessionId)) {
      const existing = this.contexts.get(sessionId)!;
      try {
        // quick health check
        existing.pages();
        return existing;
      } catch {
        await existing.close().catch(() => {});
        this.contexts.delete(sessionId);
      }
    }

    const browser = await this.launch();
    const ctxOptions = this.buildContextOptions(options, storageState);
    const context = await browser.newContext(ctxOptions);

    // Basic evasions/init scripts for Playwright
    await context.addInitScript(() => {
      Object.defineProperty(navigator, 'webdriver', { get: () => false });
      // @ts-ignore
      window.chrome = { runtime: {} };
    });

    this.contexts.set(sessionId, context);
    await randomDelay(200, 600);
    return context;
  }

  async newPage(sessionId = 'default', options: BrowserContextOptions = {}, storageState?: string | object): Promise<Page> {
    const context = await this.getContext(sessionId, options, storageState);
    const page = await context.newPage();
    await randomDelay(400, 900);
    return page;
  }

  async closeContext(sessionId: string) {
    const ctx = this.contexts.get(sessionId);
    if (!ctx) return;
    await ctx.close().catch(() => {});
    this.contexts.delete(sessionId);
  }

  async close() {
    for (const ctx of this.contexts.values()) {
      await ctx.close().catch(() => {});
    }
    this.contexts.clear();
    if (!this.browser) return;
    await this.browser.close().catch(() => {});
    this.browser = null;
  }
}
