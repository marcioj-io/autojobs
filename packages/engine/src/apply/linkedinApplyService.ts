// packages/engine/src/apply/linkedInApplyService.ts
import type { Page, BrowserContext } from 'playwright';
import type { ApplyResult } from '@autojobs/shared';

const DEFAULT_NETWORK_IDLE_TIMEOUT = 10000;
const DEFAULT_NAV_TIMEOUT = 15000;
const DEFAULT_MODAL_TIMEOUT = 8000;
const DEFAULT_STEP_WAIT = 900;

export class LinkedInApplyService {
  // Seletores robustos e multilíngue (mantidos como lista para fácil extensão)
  private readonly EASY_APPLY_SELECTORS = [
    'button.jobs-apply-button',
    'button[aria-label*="Easy apply"]',
    'button[aria-label*="Candidatura Simplificada"]',
    'button:has-text("Easy Apply")',
    'button:has-text("Candidatura Simplificada")',
    'button:has-text("Candidatura")'
  ].join(',');

  private readonly NEXT_BTN = [
    'button[aria-label="Continue to next step"]',
    'button[aria-label="Continuar para a próxima etapa"]',
    'button:has-text("Next")',
    'button:has-text("Avançar")',
    'button:has-text("Continuar")'
  ].join(',');

  private readonly SUBMIT_BTN = [
    'button[aria-label="Submit application"]',
    'button[aria-label="Enviar candidatura"]',
    'button:has-text("Submit")',
    'button:has-text("Enviar")',
    'button:has-text("Finalizar")'
  ].join(',');

  private readonly ERROR_TEXT_LOCATORS = [
    '.artdeco-inline-feedback--error',
    '.jobs-easy-apply-form-element:has(.artdeco-text-input--error) label',
    '.jobs-easy-apply-form-element:has(fieldset[data-invalid="true"]) legend',
    '.jobs-easy-apply-form-element .error'
  ].join(',');

  /**
   * Tenta aplicar para a vaga.
   * - Usa o mesmo BrowserContext para fallback (mesmos cookies/CSRF).
   * - Faz waits por networkidle antes de procurar elementos dinâmicos.
   * - Retorna ApplyResult com status detalhado para auditoria/manual review.
   */
  async applyToJob(mainPage: Page, context: BrowserContext, jobUrl: string): Promise<ApplyResult> {
    let page = mainPage;
    let openedFallback = false;

    try {
      // Espera a página principal estabilizar (quando aplicável)
      await page.waitForLoadState('networkidle', { timeout: DEFAULT_NETWORK_IDLE_TIMEOUT }).catch(() => {});

      // Procura botão Easy Apply no contexto atual (card lateral ou detalhe)
      let btn = await this.findVisibleElement(page, this.EASY_APPLY_SELECTORS);

      // Fallback: abrir a vaga em nova aba dentro do mesmo context (preserva cookies/CSRF)
      if (!btn) {
        console.info('[Apply] Easy Apply não encontrado na página principal; abrindo fallback no mesmo context.');
        page = await context.newPage();
        openedFallback = true;

        await page.goto(jobUrl, { waitUntil: 'domcontentloaded', timeout: DEFAULT_NAV_TIMEOUT }).catch(() => {});
        await page.waitForLoadState('networkidle', { timeout: DEFAULT_NETWORK_IDLE_TIMEOUT }).catch(() => {});
        btn = await this.findVisibleElement(page, this.EASY_APPLY_SELECTORS);
      }

      if (!btn) {
        // coleta trecho do DOM para diagnóstico (não logar dados sensíveis)
        const snippet = await this.safePageContentSnippet(page);
        return {
          status: 'no_easy_apply',
          details: 'Botão "Candidatura Simplificada" não encontrado na interface principal nem na aba de fallback.',
          metadata: { jobUrl, snippet }
        } as any;
      }

      // Clicar no botão com tolerância a erros transitórios
      try {
        await btn.click({ timeout: 5000 }).catch(() => {});
      } catch (e) {
        // tentativa alternativa via evaluate (quando click falha por overlay)
        try {
          await page.evaluate((el) => (el as HTMLElement).click(), await btn.elementHandle());
        } catch {
          // se falhar, captura estado para diagnóstico
          const snippet = await this.safePageContentSnippet(page);
          return { status: 'error', details: 'Falha ao clicar no botão Easy Apply.', metadata: { jobUrl, snippet } } as any;
        }
      }

      // Aguarda modal/form aparecer
      await page.waitForSelector('.jobs-easy-apply-modal, .jobs-easy-apply-form', { state: 'visible', timeout: DEFAULT_MODAL_TIMEOUT }).catch(() => null);
      await page.waitForTimeout(1000);

      // Executa a navegação/paginação do formulário
      return await this.processApplicationSteps(page);

    } catch (error: any) {
      const message = error?.message ?? String(error);
      const snippet = await this.safePageContentSnippet(page).catch(() => '<no-snippet>');
      return {
        status: 'error',
        details: `Exceção durante a inicialização da candidatura: ${message}`,
        metadata: { jobUrl, snippet }
      } as any;
    } finally {
      if (openedFallback && page && !page.isClosed()) {
        await page.close().catch(() => {});
      }
    }
  }

  /**
   * Paginação do modal: Next -> Next -> Submit.
   * Detecta formulários complexos e retorna 'complex_form' com motivo.
   */
  private async processApplicationSteps(page: Page): Promise<ApplyResult> {
    let stepCount = 0;
    const maxSteps = 14;

    while (stepCount < maxSteps) {
      stepCount++;
      await page.waitForTimeout(DEFAULT_STEP_WAIT);

      // 1) Procurar botão Submit (última etapa)
      const submitBtn = await this.findVisibleElement(page, this.SUBMIT_BTN);
      if (submitBtn) {
        const isEnabled = await this.safeIsEnabled(submitBtn);
        if (isEnabled) {
          await submitBtn.click().catch(() => {});
          // aguarda confirmação (toast, mudança de modal, etc.)
          await page.waitForTimeout(2500);
          return { status: 'submitted', details: 'Candidatura enviada com sucesso.' };
        } else {
          const errorMsg = await this.extractFormErrors(page);
          return { status: 'complex_form', details: `Submit desabilitado. Etapa ${stepCount}. Motivo: ${errorMsg}` };
        }
      }

      // 2) Procurar botão Next/Continue
      const nextBtn = await this.findVisibleElement(page, this.NEXT_BTN);
      if (nextBtn) {
        const isEnabled = await this.safeIsEnabled(nextBtn);
        if (isEnabled) {
          await nextBtn.click().catch(() => {});
          await page.waitForTimeout(900);
          continue;
        } else {
          const errorMsg = await this.extractFormErrors(page);
          return { status: 'complex_form', details: `Travado no botão Avançar. Etapa ${stepCount}. Perguntas pendentes: ${errorMsg}` };
        }
      }

      // 3) Se não encontrou botões, verificar se modal ainda existe
      const modalExists = await page.$('.jobs-easy-apply-modal, .jobs-easy-apply-form').catch(() => null);
      if (!modalExists) {
        return { status: 'error', details: `Modal de candidatura desapareceu inesperadamente na etapa ${stepCount}.` };
      }

      // 4) Se modal existe mas sem botões claros, tentar extrair erros e abortar
      const errorMsg = await this.extractFormErrors(page);
      if (errorMsg && errorMsg.length > 0) {
        return { status: 'complex_form', details: `Erro detectado no formulário: ${errorMsg}` };
      }

      // 5) Caso não tenhamos pistas, coletar snippet para análise humana
      const snippet = await this.safePageContentSnippet(page);
      return { status: 'error', details: `Sem botões de ação claros (Next/Submit) na etapa ${stepCount}.`, metadata: { snippet } } as any;
    }

    return { status: 'error', details: 'Limite máximo de passos excedido. Processo abortado por segurança.' };
  }

  /**
   * Extrai mensagens de erro/validação do modal para compor o motivo do manual review.
   */
  private async extractFormErrors(page: Page): Promise<string> {
    try {
      const locator = page.locator(this.ERROR_TEXT_LOCATORS);
      const texts = await locator.allInnerTexts().catch(() => []);
      const clean = texts.map(t => t.replace(/\n/g, ' ').trim()).filter(Boolean);
      if (clean.length > 0) {
        const unique = [...new Set(clean)];
        return unique.join(' | ');
      }
      return 'Campos obrigatórios sem label clara ou erro de UI do LinkedIn.';
    } catch {
      return 'Não foi possível ler as labels de erro do DOM.';
    }
  }

  /**
   * Helper: encontra o primeiro elemento visível a partir de um seletor composto.
   * Usa locator(...).first() e valida visibilidade.
   */
  private async findVisibleElement(page: Page, selector: string) {
    try {
      const locator = page.locator(selector).first();
      const count = await locator.count().catch(() => 0);
      if (count === 0) return null;
      const visible = await locator.isVisible().catch(() => false);
      if (!visible) {
        // tenta encontrar qualquer outro visível no conjunto
        const all = page.locator(selector);
        const n = await all.count().catch(() => 0);
        for (let i = 0; i < n; i++) {
          const l = all.nth(i);
          if (await l.isVisible().catch(() => false)) return l;
        }
        return null;
      }
      return locator;
    } catch {
      return null;
    }
  }

  /**
   * Helper: verifica se um locator está habilitado de forma segura.
   */
  private async safeIsEnabled(locator: any): Promise<boolean> {
    try {
      return await locator.isEnabled();
    } catch {
      return false;
    }
  }

  /**
   * Captura um pequeno trecho do conteúdo da página para diagnóstico sem expor dados sensíveis.
   * Retorna texto reduzido (primeiros 8k chars) ou '<no-content>'.
   */
  private async safePageContentSnippet(page: Page): Promise<string> {
    try {
      const html = await page.content();
      if (!html) return '<no-content>';
      const cleaned = html.replace(/\s+/g, ' ').trim();
      return cleaned.length > 8000 ? cleaned.slice(0, 8000) + '...[truncated]' : cleaned;
    } catch {
      return '<no-content>';
    }
  }
}
