// packages\engine\src\browser\manager.ts
import { chromium, type Browser, type BrowserContextOptions, type Cookie, type LaunchOptions } from 'playwright';
import { randomDelay } from '../utils';
import { buildBrowserFingerprint } from '../fingerprints/BrowserFingerprint';

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
  
  async newContext(options: BrowserManagerContextOptions = {}) {
      console.info('[📍 BROWSER_MANAGER - New Context]');

      const browser = await this.launch();
      console.info('[3 - BROWSER ] Browser obtido');

      const storageState =
        typeof options.storageState === 'string'
          ? JSON.parse(options.storageState)
          : options.storageState;

      // 🔒 Usa a identidade persistente em vez de gerar uma nova
      const contextOptions: BrowserContextOptions = {
        userAgent:
          options.userAgent ??
          this.options.userAgent ??
          this.persistentFingerprint.userAgent,
        
        storageState,
        
        locale: this.persistentFingerprint.locale,
        timezoneId: this.persistentFingerprint.timezoneId,
        viewport: this.persistentFingerprint.viewport
      };

    console.info("🚀 ~ BROWSER ~ newContext ~ options:", options)
    console.info("🚀 ~ BROWSER ~ newContext ~ new contextOptions:", contextOptions)
    
    console.info('[4 - BROWSER ] Antes browser.newContext');
    
    const context = await browser.newContext(contextOptions);
    
    console.info('[5 - BROWSER] Depois browser.newContext');

    if (options.cookies?.length) {
      console.info('[6 - BROWSER] Adicionando cookies');

      await context.addCookies(options.cookies);

      console.info('[7 - BROWSER] Cookies adicionados');
    }

    await randomDelay(500, 1200);

    console.info('[8 - BROWSER] - Context pronto');

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
}