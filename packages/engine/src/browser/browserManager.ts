// packages\engine\src\browser\manager.ts
import { chromium, type Browser, type BrowserContextOptions, type Cookie, type LaunchOptions } from 'playwright';
import { randomDelay } from '../utils';
import { buildBrowserFingerprint } from '../fingerprints/BrowserFingerprint';

export interface BrowserManagerOptions {
  headless?: boolean;
  userAgent?: string;
}

export class BrowserManager {
  private browser: Browser | null = null;
  private persistentFingerprint: any; // 🕵️‍♂️ Guarda a identidade do bot
  
  constructor(
    private options: BrowserManagerOptions = {}
  ) {
    this.persistentFingerprint = buildBrowserFingerprint();
  }

  async launch() {
      if (this.browser) {
        return this.browser;
      }

      const wsEndpoint = process.env.BROWSER_WS_ENDPOINT
      
      if(wsEndpoint == null || wsEndpoint == undefined){
        console.info("🚀 ~ BROWSER_MANAGER ~ launch ~ browserless key not found")
      }

      try {
        if (wsEndpoint) {
          console.info('[1 - BROWSER] Iniciando conexão Browserless...');
          
          //BROWSER_WS_ENDPOINT=wss://production-sfo.browserless.io/chromium/playwright?token=
          this.browser = await chromium.connect({
            wsEndpoint,
            timeout: 30000
          });

          //BROWSER_WS_ENDPOINT=wss://production-sfo.browserless.io?token=
          // this.browser = await chromium.connectOverCDP(wsEndpoint);

          console.info('[2 - BROWSER ] Browserless conectado');
        } else {
          
          console.info('[1 - BROWSER ] Iniciando Chromium local');
          this.browser = await chromium.launch({
            headless: this.options.headless ?? true,
            args: [
              '--no-sandbox',
              '--disable-setuid-sandbox',
              '--disable-dev-shm-usage', // ESSENCIAL: Impede que o Chromium estoure a RAM do WSL
              '--disable-gpu',           // Evita gargalos tentando usar aceleração de vídeo inexistente no WSL
              '--disable-software-rasterizer',
              '--disable-extensions',
              '--mute-audio',
              '--js-flags="--max-old-space-size=512"' // Limita o uso de memória do V8
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
  
  async newContext(options: BrowserContextOptions = {}) {
    console.info("[📍 BROWSER_MANAGER - New Context]");

    const browser = await this.launch();

    const context = await browser.newContext({
      ...options,

      userAgent:
        options.userAgent ??
        this.options.userAgent ??
        this.persistentFingerprint.userAgent,

      locale:
        options.locale ??
        this.persistentFingerprint.locale,

      timezoneId:
        options.timezoneId ??
        this.persistentFingerprint.timezoneId,

      viewport:
        options.viewport ??
        this.persistentFingerprint.viewport
    });

    return context;
  }

  async newPage(options: BrowserContextOptions = {}) {
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
}