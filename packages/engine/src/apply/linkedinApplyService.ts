// packages/engine/src/apply/linkedInApplyService.ts
import fs from 'node:fs';
import path from 'node:path';
import type { Page, BrowserContext, Locator } from 'playwright';
import type { ApplyResult } from '@autojobs/shared';

const DEBUG = process.env.DEBUG_APPLY === 'true';

export class LinkedInApplyService {
  // ============================================================================
  // CONFIGURAÇÕES E TIMEOUTS
  // ============================================================================
  private static readonly TIMEOUTS = {
    NETWORK_IDLE: 10000,
    NAVIGATION: 15000,
    MODAL_APPEAR: 8000,
    STEP_TRANSITION: 1500, // Tempo para aguardar validações do DOM após clique
    CLICK_RETRY_DELAY: 400,
  };

  private static readonly RETRIES = {
    CLICK: 3,
    MAX_FORM_STEPS: 20, // Previne loops infinitos em formulários anômalos
  };

  // ============================================================================
  // SELETORES (Suporte nativo a EN e PT-BR)
  // ============================================================================
  private static readonly SELECTORS = {
    EASY_APPLY_BTN: [
      'button.jobs-apply-button',
      'button[aria-label*="Easy apply"]',
      'button[aria-label*="Candidatura Simplificada"]',
      'button:has-text("Easy Apply")',
      'button:has-text("Candidatura Simplificada")',
      'button:has-text("Candidatura")'
    ].join(','),

    NEXT_OR_REVIEW_BTN: [
      'button[aria-label="Continue to next step"]',
      'button[aria-label="Continuar para a próxima etapa"]',
      'button[aria-label="Review your application"]',
      'button[aria-label="Revisar sua candidatura"]',
      'button:has-text("Next")',
      'button:has-text("Avançar")',
      'button:has-text("Continuar")',
      'button:has-text("Review")',
      'button:has-text("Revisar")'
    ].join(','),

    SUBMIT_BTN: [
      'button[aria-label="Submit application"]',
      'button[aria-label="Enviar candidatura"]',
      'button:has-text("Submit")',
      'button:has-text("Enviar")',
      'button:has-text("Finalizar")'
    ].join(','),

    MODAL_CONTAINER: '.jobs-easy-apply-modal, .jobs-easy-apply-form',
    
    // Contêineres de campos que entram em estado de erro
    ERROR_CONTAINERS: [
      '.jobs-easy-apply-form-element:has(.artdeco-text-input--error)',
      '.jobs-easy-apply-form-element:has([data-invalid="true"])',
      '.jobs-easy-apply-form-element:has(.artdeco-inline-feedback--error)',
      '.jobs-easy-apply-form-element:has(.error)'
    ].join(',')
  };

  // ============================================================================
  // FLUXO PRINCIPAL
  // ============================================================================
  async applyToJob(mainPage: Page, context: BrowserContext, jobUrl: string): Promise<ApplyResult> {
    let page = mainPage;
    let openedFallback = false;

    console.info('[APPLY] Iniciando processo', { jobUrl });

    try {
      await page.waitForLoadState('networkidle', { timeout: LinkedInApplyService.TIMEOUTS.NETWORK_IDLE }).catch(() => {});

      let applyBtn = await this.findVisibleElement(page, LinkedInApplyService.SELECTORS.EASY_APPLY_BTN);

      // Estratégia de Fallback: Se não achar o botão, recarrega a vaga em nova aba isolada
      if (!applyBtn) {
        console.info('[APPLY] Easy Apply não encontrado na view principal; tentando fallback...', { jobUrl });
        page = await context.newPage();
        openedFallback = true;
        
        await page.goto(jobUrl, { waitUntil: 'domcontentloaded', timeout: LinkedInApplyService.TIMEOUTS.NAVIGATION }).catch(() => {});
        await page.waitForLoadState('networkidle', { timeout: LinkedInApplyService.TIMEOUTS.NETWORK_IDLE }).catch(() => {});
        
        applyBtn = await this.findVisibleElement(page, LinkedInApplyService.SELECTORS.EASY_APPLY_BTN);
      }

      if (!applyBtn) {
        const snippet = await this.safePageContentSnippet(page);
        console.warn('[APPLY] Vaga não possui Easy Apply ou botão indisponível', { jobUrl });
        return { status: 'no_easy_apply', details: 'Botão Easy Apply não encontrado.', metadata: { jobUrl, snippet } } as any;
      }

      // Tenta abrir o modal com resiliência
      const clicked = await this.safeClick(page, applyBtn, LinkedInApplyService.RETRIES.CLICK);
      if (!clicked) {
        return this.buildErrorResult(page, jobUrl, 'Falha ao clicar no botão Easy Apply (DOM não respondeu).');
      }

      // Aguarda renderização do formulário
      const modalAppeared = await page.waitForSelector(LinkedInApplyService.SELECTORS.MODAL_CONTAINER, { 
        state: 'visible', 
        timeout: LinkedInApplyService.TIMEOUTS.MODAL_APPEAR 
      }).catch(() => null);

      if (!modalAppeared) {
        return this.buildErrorResult(page, jobUrl, 'Modal de candidatura não abriu após o clique.');
      }

      return await this.processApplicationSteps(page, jobUrl);

    } catch (error: any) {
      const message = error?.message ?? String(error);
      console.error('[APPLY] Exceção crítica na inicialização', { jobUrl, message });
      return this.buildErrorResult(page, jobUrl, `Exceção crítica: ${message}`);
    } finally {
      if (openedFallback && page && !page.isClosed()) {
        await page.close().catch(() => {});
      }
    }
  }

  // ============================================================================
  // PROCESSADOR DE ETAPAS (STATE MACHINE)
  // ============================================================================
  private async processApplicationSteps(page: Page, jobUrl: string): Promise<ApplyResult> {
    let stepCount = 0;
    
    // Log consolidado de início
    console.info(`[APPLY] Formulário aberto. Iniciando processamento de etapas.`, { jobUrl });

    while (stepCount < LinkedInApplyService.RETRIES.MAX_FORM_STEPS) {
      stepCount++;
      await page.waitForTimeout(1000); // Aguarda animações do React/LinkedIn

      // 1. Verifica se o modal ainda existe
      const modalExists = await page.$(LinkedInApplyService.SELECTORS.MODAL_CONTAINER).catch(() => null);
      if (!modalExists) {
        // Correção Sênior: Se o modal sumiu, verifica se na verdade a vaga foi APLICADA.
        const isSuccess = await this.verifySuccessState(page);
        if (isSuccess) {
          console.info(`[APPLY] ✅ Candidatura concluída! (Modal fechado após envio na etapa ${stepCount - 1})`, { jobUrl });
          return { status: 'submitted', details: 'Candidatura enviada e confirmada via UI.' } as any;
        }
        
        return this.buildErrorResult(page, jobUrl, `Falha de estado: Modal desapareceu inesperadamente na etapa ${stepCount}.`);
      }

      // 2. Tenta identificar bloqueios passivos (Erros de formulário)
      const existingErrors = await this.extractValidationErrors(page);
      if (existingErrors) {
        console.warn(`[APPLY] ⚠️ Formulário bloqueado na etapa ${stepCount} por campos obrigatórios.`, { jobUrl });
        return this.buildComplexFormResult(page, jobUrl, stepCount, `Campos pendentes: ${existingErrors}`);
      }

      // 3. Procura botão de SUBMIT
      const submitBtn = await this.findVisibleElement(page, LinkedInApplyService.SELECTORS.SUBMIT_BTN);
      if (submitBtn) {
        const result = await this.handleActionClick(page, submitBtn, jobUrl, stepCount, 'SUBMIT');
        if (result) return result; 
        continue; 
      }
      
      // 4. Procura botão de NEXT ou REVIEW
      const nextBtn = await this.findVisibleElement(page, LinkedInApplyService.SELECTORS.NEXT_OR_REVIEW_BTN);
      if (nextBtn) {
        const result = await this.handleActionClick(page, nextBtn, jobUrl, stepCount, 'NEXT');
        if (result) return result;
        continue;
      }

      // 5. Dead-end: Modal está aberto, mas não há como avançar
      return this.buildComplexFormResult(page, jobUrl, stepCount, 'Dead-end: Nenhum botão de ação (Next/Submit) habilitado/visível.');
    }

    return this.buildErrorResult(page, jobUrl, 'Loop infinito abortado: Limite máximo de passos excedido.');
  }

  // ============================================================================
  // GERENCIADOR DE AÇÕES (Lida com o clique e a transição)
  // ============================================================================
  private async handleActionClick(
    page: Page, 
    button: Locator, 
    jobUrl: string, 
    stepCount: number, 
    actionType: 'NEXT' | 'SUBMIT'
  ): Promise<ApplyResult | null> {
    const isEnabled = await this.safeIsEnabled(button);
    
    if (!isEnabled) {
      const errors = await this.extractValidationErrors(page) || 'Botão presente, mas desabilitado (possível campo obrigatório não preenchido).';
      return this.buildComplexFormResult(page, jobUrl, stepCount, errors);
    }

    const clicked = await this.safeClick(page, button, LinkedInApplyService.RETRIES.CLICK);
    if (!clicked) {
      return this.buildErrorResult(page, jobUrl, `Falha física/DOM ao tentar clicar no botão [${actionType}] na etapa ${stepCount}.`);
    }

    // Telemetria limpa e objetiva: 1 log por transição bem sucedida
    console.info(`[APPLY] 🔄 Etapa ${stepCount}: Ação [${actionType}] executada.`, { jobUrl });

    await page.waitForTimeout(LinkedInApplyService.TIMEOUTS.STEP_TRANSITION);

    const errorsAfterClick = await this.extractValidationErrors(page);
    if (errorsAfterClick) {
      return this.buildComplexFormResult(page, jobUrl, stepCount, `Bloqueado por validação após clique: ${errorsAfterClick}`);
    }

    if (actionType === 'SUBMIT') {
      await page.waitForTimeout(2000);
      
      // Checagem extra de segurança no Submit
      const isSuccess = await this.verifySuccessState(page);
      if (isSuccess || !(await page.$(LinkedInApplyService.SELECTORS.MODAL_CONTAINER).catch(()=>null))) {
        console.info(`[APPLY] ✅ Candidatura concluída com sucesso!`, { jobUrl });
        return { status: 'submitted', details: 'Candidatura enviada com sucesso.' } as any;
      }
    }

    return null;
  }

  // ============================================================================
  // VERIFICADOR DE SUCESSO (Evita Falsos Negativos)
  // ============================================================================
  private async verifySuccessState(page: Page): Promise<boolean> {
    try {
      // Procura por indicadores clássicos do LinkedIn de que a vaga foi aplicada
      const successIndicators = [
        '.artdeco-toast-item--success', // Toast verde de sucesso
        '[data-test-modal-id="postApplyModal"]', // Modal de "Candidatura enviada"
        '.jobs-s-apply__application-successful', // Badge no card da vaga
        'button:has-text("Applied")', // Botão original mudou de estado (EN)
        'button:has-text("Candidatura enviada")', // Botão original mudou de estado (PT-BR)
      ].join(',');

      const successElement = page.locator(successIndicators).first();
      return await successElement.isVisible({ timeout: 2500 });
    } catch {
      return false;
    }
  }

  // ============================================================================
  // EXTRATOR INTELIGENTE DE ERROS
  // ============================================================================
  private async extractValidationErrors(page: Page): Promise<string | null> {
    try {
      const errorContainers = page.locator(LinkedInApplyService.SELECTORS.ERROR_CONTAINERS);
      const count = await errorContainers.count().catch(() => 0);
      
      if (count === 0) return null;

      const errorMessages: string[] = [];
      
      for (let i = 0; i < count; i++) {
        const container = errorContainers.nth(i);
        
        // Em Inputs/Selects usa label. Em Radios/Checkboxes usa legend.
        const titleLocator = container.locator('label, legend').first();
        const fieldNameRaw = await titleLocator.innerText().catch(() => '');
        
        const errorTextLocator = container.locator('.artdeco-inline-feedback--error, .error').first();
        const errorDetailRaw = await errorTextLocator.innerText().catch(() => 'Campo obrigatório');
        
        // Limpeza dos textos (remoção de asteriscos, quebras de linha e excessos)
        const fieldName = fieldNameRaw.replace(/\n/g, ' ').replace(/\*/g, '').trim() || 'Campo Desconhecido';
        const errorDetail = errorDetailRaw.replace(/\n/g, ' ').trim();
        
        errorMessages.push(`[${fieldName}]: ${errorDetail}`);
      }

      // Retorna erros únicos unidos (pode haver duplicação de re-renderização no DOM)
      const uniqueErrors = [...new Set(errorMessages)];
      return uniqueErrors.join(' | ');
    } catch {
      return 'Erro detectado, mas falha ao ler a label do DOM.';
    }
  }

  // ============================================================================
  // MÉTODOS UTILITÁRIOS E DE INTERAÇÃO SEGURA (Resiliência)
  // ============================================================================
  private async findVisibleElement(page: Page, selector: string): Promise<Locator | null> {
    try {
      const locator = page.locator(selector).first();
      if (await locator.isVisible().catch(() => false)) return locator;
      
      // Avalia todos os nós correspondentes, pois o primeiro pode estar oculto (ex: mobile vs desktop view)
      const all = page.locator(selector);
      const n = await all.count().catch(() => 0);
      for (let i = 0; i < n; i++) {
        const l = all.nth(i);
        if (await l.isVisible().catch(() => false)) return l;
      }
      return null;
    } catch {
      return null;
    }
  }

  private async safeIsEnabled(locator: Locator): Promise<boolean> {
    try {
      return await locator.isEnabled({ timeout: 1000 });
    } catch {
      return false;
    }
  }

  private async safeClick(page: Page, locator: Locator, retries: number): Promise<boolean> {
    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        await locator.click({ timeout: 3000 });
        return true;
      } catch (e) {
        console.warn(`[APPLY] Falha no clique (Tentativa ${attempt}/${retries})`, String(e));
        
        // Fallback 1: Click via JS puro
        try {
          const handle = await locator.elementHandle({ timeout: 1000 });
          if (handle) {
            await page.evaluate((el) => (el as HTMLElement).click(), handle);
            return true;
          }
        } catch (ee) {}

        // Fallback 2: Foco e Enter no teclado
        try {
          await locator.focus({ timeout: 1000 });
          await page.keyboard.press('Enter');
          return true;
        } catch (eee) {}

        await page.waitForTimeout(LinkedInApplyService.TIMEOUTS.CLICK_RETRY_DELAY);
      }
    }
    return false;
  }

  private async safePageContentSnippet(page: Page): Promise<string> {
    try {
      const html = await page.content();
      if (!html) return '<no-content>';
      const cleaned = html.replace(/\s+/g, ' ').trim();
      return cleaned.length > 5000 ? cleaned.slice(0, 5000) + '...[truncated]' : cleaned;
    } catch {
      return '<no-content-failed-extract>';
    }
  }

  // ============================================================================
  // CONSTRUTORES DE RESPOSTA
  // ============================================================================
  private async buildComplexFormResult(page: Page, jobUrl: string, stepCount: number, reason: string): Promise<ApplyResult> {
    const snippet = await this.safePageContentSnippet(page);
    const meta: any = { jobUrl, stepCount, reason, snippet };
    this.takeDebugScreenshot(page, `complex_form_step_${stepCount}`);
    return { status: 'complex_form', details: reason, metadata: meta } as any;
  }

  private async buildErrorResult(page: Page, jobUrl: string, details: string): Promise<ApplyResult> {
    const snippet = await this.safePageContentSnippet(page);
    this.takeDebugScreenshot(page, `error_state`);
    return { status: 'error', details, metadata: { jobUrl, snippet } } as any;
  }

  private takeDebugScreenshot(page: Page, prefix: string): void {
    if (!DEBUG) return;
    try {
      const fileName = `apply-debug-${prefix}-${Date.now()}.png`;
      const out = path.resolve(process.cwd(), fileName);
      page.screenshot({ path: out, fullPage: true }).catch(() => {});
      console.info(`[APPLY][DIAG] Screenshot salvo: ${out}`);
    } catch (e) {
      console.warn('[APPLY][DIAG] Falha ao salvar screenshot', e);
    }
  }
}