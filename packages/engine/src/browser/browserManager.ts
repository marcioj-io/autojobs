// packages/engine/src/browser/browserManager.ts
import { chromium } from 'playwright-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import type { Browser, BrowserContext, BrowserContextOptions, Page } from 'playwright';
import { buildBrowserFingerprint } from '../fingerprints/BrowserFingerprint';
import { randomDelay } from '../utils';

try {
  chromium.use(StealthPlugin());
} catch (e) {
  console.warn('[BrowserManager] stealth plugin não aplicado', e);
}

export interface BrowserManagerOptions {
  headless?: boolean;
  userAgent?: string;
}

export class BrowserManager {
  private static instance: BrowserManager | null = null;
  private browser: Browser | null = null;
  private contexts: Map<string, BrowserContext> = new Map();
  private readonly persistentFingerprint = buildBrowserFingerprint();
  private options: BrowserManagerOptions;

  // Deduplication and resilience primitives
  private launchPromise: Promise<Browser> | null = null;
  private restartAttempts = 0;
  private readonly maxRestartAttempts = Number(process.env.BROWSER_MAX_RESTARTS ?? 3);

  private constructor(options: BrowserManagerOptions = {}) {
    this.options = { ...options };
  }

  public static getInstance(options: BrowserManagerOptions = {}): BrowserManager {
    if (!BrowserManager.instance) {
      BrowserManager.instance = new BrowserManager(options);
    } else {
      BrowserManager.instance.options = { ...BrowserManager.instance.options, ...options };
    }
    return BrowserManager.instance;
  }

  private isBrowserAlive(): boolean {
    try {
      if (!this.browser) return false;
      // playwright may expose isConnected; if not, assume alive
      // @ts-ignore
      return typeof (this.browser as any).isConnected === 'function' ? (this.browser as any).isConnected() : true;
    } catch {
      return false;
    }
  }

  /**
   * Launch or connect to browser. Deduplicates concurrent launches using launchPromise.
   * If browser disconnects, listener clears state so next call will relaunch.
   */
  async launch(): Promise<Browser> {
    if (this.browser && this.isBrowserAlive()) return this.browser;
    if (this.launchPromise) return this.launchPromise;

    this.launchPromise = (async () => {
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

        // Defensive: listen for disconnect and cleanup
        try {
          // @ts-ignore - some runtimes expose 'on'
          this.browser.on?.('disconnected', () => {
            console.warn('[BrowserManager] browser disconnected; clearing state');
            this.browser = null;
            for (const ctx of this.contexts.values()) {
              ctx.close().catch(() => {});
            }
            this.contexts.clear();
          });
        } catch {
          // ignore listener errors
        }

        // reset restart attempts on successful launch
        this.restartAttempts = 0;
        await randomDelay(800, 1400);
        return this.browser!;
      } catch (err) {
        try { await this.browser?.close().catch(() => {}); } catch {}
        this.browser = null;
        throw err;
      } finally {
        this.launchPromise = null;
      }
    })();

    return this.launchPromise;
  }

  private buildContextOptions(options: BrowserContextOptions = {}, storageState?: string | object): BrowserContextOptions {
    const ctxOptions: BrowserContextOptions = {
      ...options,
      userAgent: (options as any).userAgent ?? this.options.userAgent ?? this.persistentFingerprint.userAgent,
      locale: (options as any).locale ?? this.persistentFingerprint.locale,
      timezoneId: (options as any).timezoneId ?? this.persistentFingerprint.timezoneId,
      viewport: (options as any).viewport ?? this.persistentFingerprint.viewport
    } as BrowserContextOptions;

    if (storageState) {
      (ctxOptions as any).storageState = storageState;
    }

    return ctxOptions;
  }

  /**
   * getContext is resilient: ensures browser alive, attempts relaunch on failure,
   * protects against orphaned contexts, and limits restart flapping.
   */
  public async getContext(sessionId = 'default', options: BrowserContextOptions = {}, storageState?: string | object): Promise<BrowserContext> {
    // Reuse safe context if available
    if (this.contexts.has(sessionId)) {
      const existing = this.contexts.get(sessionId)!;
      try {
        const isClosed = typeof (existing as any).isClosed === 'function' ? (existing as any).isClosed() : false;
        if (!isClosed) return existing;
        await existing.close().catch(() => {});
        this.contexts.delete(sessionId);
      } catch {
        await existing.close().catch(() => {});
        this.contexts.delete(sessionId);
      }
    }

    // Ensure browser is launched and alive with a single recovery attempt
    try {
      await this.launch();
    } catch (err) {
      console.error('[BrowserManager] launch failed, attempting one recovery', err);
      try { await this.browser?.close().catch(() => {}); } catch {}
      this.browser = null;
      await randomDelay(500 + Math.floor(Math.random() * 500), 1200 + Math.floor(Math.random() * 800));
      await this.launch();
    }

    const ctxOptions = this.buildContextOptions(options, storageState);

    try {
      const context = await this.browser!.newContext(ctxOptions);

      try {
        await context.addInitScript(() => {
          Object.defineProperty(navigator, 'webdriver', { get: () => false });
          // @ts-ignore
          window.chrome = { runtime: {} };
        });
      } catch (e) {
        console.warn('[BrowserManager] addInitScript falhou', e);
      }

      this.contexts.set(sessionId, context);
      await randomDelay(200, 600);
      return context;
    } catch (err) {
      // If newContext fails, attempt a browser restart once
      console.error('[BrowserManager] newContext failed, attempting browser restart', err);
      try { await this.browser?.close().catch(() => {}); } catch {}
      this.browser = null;

      if (this.restartAttempts >= this.maxRestartAttempts) {
        throw new Error('Browser restart attempts exceeded');
      }
      this.restartAttempts++;

      await randomDelay(500 + Math.floor(Math.random() * 500), 1200 + Math.floor(Math.random() * 800));
      await this.launch();
      const context = await this.browser!.newContext(ctxOptions);
      this.contexts.set(sessionId, context);
      return context;
    }
  }

  public async newContext(sessionId = 'default', options: BrowserContextOptions = {}, storageState?: string | object): Promise<BrowserContext> {
    return this.getContext(sessionId, options, storageState);
  }

  public async newPage(sessionId = 'default', options: BrowserContextOptions = {}, storageState?: string | object): Promise<Page> {
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

  // Health helper for observability
  public getHealth() {
    return {
      browserAlive: this.isBrowserAlive(),
      contextsCount: this.contexts.size,
      restartAttempts: this.restartAttempts
    };
  }
}
