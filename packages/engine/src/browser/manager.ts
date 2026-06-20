// packages\engine\src\browser\manager.ts
import { chromium, type Browser, type BrowserContext, type BrowserContextOptions, type Cookie, type LaunchOptions } from 'playwright';
import { randomDelay } from '../utils';
import { buildBrowserFingerprint } from '../fingerprints/BrowserFingerprint';

const DEFAULT_USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 13_6) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36'
];

export interface BrowserManagerOptions {
  headless?: boolean;
  userAgent?: string;
}

export interface BrowserManagerContextOptions {
  storageState?: string | BrowserContextOptions['storageState'];
  cookies?: Cookie[];
  userAgent?: string;
}

export class BrowserManager {
  private browser: Browser | null = null;

  constructor(private options: BrowserManagerOptions = {}) {}

  async launch() {
      if (this.browser) {
        return this.browser;
      }

      const wsEndpoint = process.env.BROWSER_WS_ENDPOINT;
      console.log("🚀 ~ BrowserManager ~ launch ~ wsEndpoint:", wsEndpoint)
      
      try {
        if (wsEndpoint?.startsWith('wss://')) {
          console.info('[1 - BROWSER] Iniciando conexão Browserless...');
          
          // Use APENAS o timeout nativo do Playwright.
          // 30000ms (30s) é o tempo ideal para dar espaço ao Cold Start do Browserless 
          // sem travar sua API de forma permanente.
          this.browser = await chromium.connect({
            wsEndpoint,
            timeout: 30000 
          });

          console.info('[2 - BROWSER ] Browserless conectado');
        } else {
          
          console.info('[1 - BROWSER ] Iniciando Chromium local');
          this.browser = await chromium.launch({
            headless: this.options.headless ?? true,
            args: [
              '--no-sandbox',
              '--disable-setuid-sandbox'
            ]
          });
          console.info('[2 - BROWSER ] Chromium local iniciado');
        }
      } catch (error) {
        console.error('[FATAL - BROWSER ] Erro ao iniciar browser:', error);
        
        // Fallback de segurança: se a conexão deu erro parcial, garante que a instância zumbi seja morta
        if (this.browser) {
          await this.browser.close().catch(() => {});
          this.browser = null;
        }
        
        // Repassa o erro para o controller/rota retornar o status 500 corretamente
        throw error; 
      }

      await randomDelay(800, 1400);
      return this.browser;
  }
  
  async newContext(options: BrowserManagerContextOptions = {}) {
    console.info('Entrando em newContext');

    const browser = await this.launch();

    console.info('[3 - BROWSER ] Browser obtido');

    const storageState =
      typeof options.storageState === 'string'
        ? JSON.parse(options.storageState)
        : options.storageState;

    const fingerprint = buildBrowserFingerprint();

    const contextOptions: BrowserContextOptions = {
      userAgent:
        options.userAgent ??
        this.options.userAgent ??
        fingerprint.userAgent,

      storageState,

      locale: fingerprint.locale,
      timezoneId: fingerprint.timezoneId,
      viewport: fingerprint.viewport
    };

    console.info('[4 - BROWSER ] Antes browser.newContext');

    const context = await browser.newContext(contextOptions);

    console.info('[5 - BROWSER] Depois browser.newContext');

    if (options.cookies?.length) {
      console.info('[6 - BROWSER] Adicionando cookies');

      await context.addCookies(options.cookies);

      console.info('[7 - BROWSER] Cookies adicionados');
    }

    await randomDelay(500, 1200);

    console.info('[8]- BROWSER - Context pronto');

    return context;
  }

  async newPage(options: BrowserManagerContextOptions = {}) {
    const context = await this.newContext(options);
    const page = await context.newPage();
    await randomDelay(400, 900);
    return page;
  }

  async close() {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }

  private pickRandomUserAgent() {
    return DEFAULT_USER_AGENTS[Math.floor(Math.random() * DEFAULT_USER_AGENTS.length)];
  }
}