// packages/engine/src/apply/linkedInApplyService.ts
import fs from 'node:fs';
import path from 'node:path';
import type { Page, BrowserContext, Locator, ElementHandle } from 'playwright';
import type { ApplyResult } from '@autojobs/shared';

const DEBUG = process.env.DEBUG_APPLY === 'true';

export class LinkedInApplyService {
  private static readonly TIMEOUTS = {
    NETWORK_IDLE: 10000,
    NAVIGATION: 15000,
    MODAL_APPEAR: 12000,
    STEP_TRANSITION: 2200,
    CLICK_RETRY_DELAY: 600,
    OVERLAY_WAIT: 1400,
    STABILITY_POLL: 1200,
    SUCCESS_CHECK: 3000
  };

  private static readonly RETRIES = {
    CLICK: 4,
    MAX_FORM_STEPS: 25
  };

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

    MODAL_CONTAINER: '.jobs-easy-apply-modal, .jobs-easy-apply-form, .jobs-easy-apply__content',
    OVERLAY_GENERIC: '.artdeco-modal-overlay, .artdeco-modal__dismiss, .artdeco-modal-overlay--is-top-layer',
    DISCARD_CONFIRM: '[data-test-easy-apply-discard-confirmation]',
    ERROR_TEXT_LOCATORS: '.artdeco-inline-feedback--error, .jobs-easy-apply-form-element:has(.artdeco-text-input--error), .jobs-easy-apply-form-element:has(fieldset[data-invalid="true"])'
  };

  async applyToJob(mainPage: Page, context: BrowserContext, jobUrl: string): Promise<ApplyResult> {
    let page = mainPage;
    let openedFallback = false;
    const startTs = Date.now();

    console.info('[APPLY] Iniciando processo', { jobUrl });

    try {
      await page.waitForLoadState('networkidle', { timeout: LinkedInApplyService.TIMEOUTS.NETWORK_IDLE }).catch(() => {});

      // 1) localizar botão Easy Apply
      let applyBtn = await this.findVisibleElement(page, LinkedInApplyService.SELECTORS.EASY_APPLY_BTN);

      // fallback: abrir em nova aba (mesmo context)
      if (!applyBtn) {
        console.info('[APPLY] Easy Apply não encontrado na view principal; tentando fallback em nova aba...', { jobUrl });
        page = await context.newPage();
        openedFallback = true;

        await page.goto(jobUrl, { waitUntil: 'domcontentloaded', timeout: LinkedInApplyService.TIMEOUTS.NAVIGATION }).catch(() => {});
        await page.waitForLoadState('networkidle', { timeout: LinkedInApplyService.TIMEOUTS.NETWORK_IDLE }).catch(() => {});
        await this.dismissBlockingOverlays(page);
        applyBtn = await this.findVisibleElement(page, LinkedInApplyService.SELECTORS.EASY_APPLY_BTN);
      }

      if (!applyBtn) {
        const snippet = await this.safePageContentSnippet(page);
        console.warn('[APPLY] Vaga não possui Easy Apply ou botão indisponível', { jobUrl });
        return {
          status: 'no_easy_apply',
          details: 'Botão Easy Apply não encontrado.',
          skippedBy: 'system',
          reasonCode: 'no_easy_apply',
          metadata: { jobUrl, snippet, elapsedMs: Date.now() - startTs }
        } as any;
      }

      // 2) abrir modal com resiliência
      await this.dismissBlockingOverlays(page);
      const clicked = await this.safeClick(page, applyBtn, LinkedInApplyService.RETRIES.CLICK);
      if (!clicked) {
        return this.buildErrorResult(page, jobUrl, 'Falha ao clicar no botão Easy Apply (DOM não respondeu).', { 
          rejectedBy: 'apply', 
          reasonCode: 'infra_error' 
        });
      }

      // 3) aguardar modal (várias heurísticas)
      const modalAppeared = await this.waitForModalOrUrlChange(page, jobUrl, LinkedInApplyService.TIMEOUTS.MODAL_APPEAR);

      if (!modalAppeared) {
        // tenta detectar se apareceu um modal de Save/Discard que bloqueou a abertura
        await this.dismissDiscardModal(page);
        return this.buildErrorResult(page, jobUrl, 'Modal de candidatura não abriu após o clique (Timeout).', { 
          rejectedBy: 'apply', 
          reasonCode: 'modal_timeout' 
        });
      }

      // 4) processar etapas
      return await this.processApplicationSteps(page, jobUrl);

    } catch (error: any) {
      const message = error?.message ?? String(error);
      console.error('[APPLY] Exceção crítica na inicialização', { jobUrl, message });
      return this.buildErrorResult(page, jobUrl, `Exceção crítica: ${message}`, { 
        rejectedBy: 'system', 
        reasonCode: 'pipeline_crash' 
      });
    } finally {
      if (openedFallback && page && !page.isClosed()) {
        await page.close().catch(() => {});
      }
    }
  }

  private async waitForModalOrUrlChange(page: Page, jobUrl: string, timeoutMs: number): Promise<boolean> {
    const start = Date.now();
    try {
      // 1) aguarda seletor do modal
      const modal = await page.waitForSelector(LinkedInApplyService.SELECTORS.MODAL_CONTAINER, { state: 'visible', timeout: Math.min(3000, timeoutMs) }).catch(() => null);
      if (modal) return true;

      // 2) aguarda mudança de URL que contenha /apply ou jobId
      const jobIdFragment = this.extractJobIdFromUrl(jobUrl);
      const urlChanged = await page.waitForFunction(
        (frag) => window.location.href.includes(frag),
        jobIdFragment || '/apply',
        { timeout: timeoutMs }
      ).catch(() => null);
      if (urlChanged) return true;

      // 3) poll por modal até timeout
      while (Date.now() - start < timeoutMs) {
        const m = await page.$(LinkedInApplyService.SELECTORS.MODAL_CONTAINER).catch(() => null);
        if (m) {
          const visible = await (m as ElementHandle).isVisible().catch(() => false);
          if (visible) return true;
        }
        // checa se overlay de discard apareceu
        const discard = await page.$(LinkedInApplyService.SELECTORS.DISCARD_CONFIRM).catch(() => null);
        if (discard) return false;
        await page.waitForTimeout(300);
      }
      return false;
    } catch {
      return false;
    }
  }

  private extractJobIdFromUrl(url: string): string | null {
    try {
      const m = url.match(/jobs\/view\/([^/?#]+)/);
      return m ? m[1] : null;
    } catch {
      return null;
    }
  }

  private async processApplicationSteps(page: Page, jobUrl: string): Promise<ApplyResult> {
    let stepCount = 0;
    console.info(`[APPLY] Formulário aberto. Iniciando processamento de etapas.`, { jobUrl });

    while (stepCount < LinkedInApplyService.RETRIES.MAX_FORM_STEPS) {
      stepCount++;
      await page.waitForTimeout(1000);

      const modalExists = await page.$(LinkedInApplyService.SELECTORS.MODAL_CONTAINER).catch(() => null);
      if (!modalExists) {
        const isSuccess = await this.verifySuccessState(page);
        if (isSuccess) {
          console.info(`[APPLY] ✅ Candidatura concluída! (Modal fechado após envio na etapa ${stepCount - 1})`, { jobUrl });
          return { status: 'submitted', details: 'Candidatura enviada e confirmada via UI.' } as any;
        }
        return this.buildErrorResult(page, jobUrl, `Falha de estado: Modal desapareceu inesperadamente na etapa ${stepCount}.`, { 
          rejectedBy: 'apply', 
          reasonCode: 'infra_error' 
        });
      }

      const existingErrors = await this.extractFormErrorsDetailed(page);
      if (existingErrors && existingErrors.length > 0) {
        console.warn(`[APPLY] ⚠️ Formulário bloqueado na etapa ${stepCount} por campos obrigatórios.`, { jobUrl, errorsCount: existingErrors.length });
        await this.dismissDiscardModal(page);
        const snippet = await this.safePageContentSnippet(page);
        return {
          status: 'complex_form',
          details: `Campos pendentes detectados na etapa ${stepCount}.`,
          skippedBy: 'apply',
          reasonCode: 'complex_form',
          metadata: { jobUrl, stepCount, errors: existingErrors, snippet }
        } as any;
      }

      const submitBtn = await this.findVisibleElement(page, LinkedInApplyService.SELECTORS.SUBMIT_BTN);
      if (submitBtn) {
        const result = await this.handleActionClick(page, submitBtn, jobUrl, stepCount, 'SUBMIT');
        if (result) return result;
        continue;
      }

      const nextBtn = await this.findVisibleElement(page, LinkedInApplyService.SELECTORS.NEXT_OR_REVIEW_BTN);
      if (nextBtn) {
        const result = await this.handleActionClick(page, nextBtn, jobUrl, stepCount, 'NEXT');
        if (result) return result;
        continue;
      }

      const snippet = await this.safePageContentSnippet(page);
      return {
        status: 'complex_form',
        details: 'Dead-end: Nenhum botão de ação (Next/Submit) habilitado/visível.',
        skippedBy: 'apply',
        reasonCode: 'complex_form',
        metadata: { jobUrl, stepCount, snippet }
      } as any;
    }

    return this.buildErrorResult(page, jobUrl, 'Loop infinito abortado: Limite máximo de passos excedido.', { 
      rejectedBy: 'apply', 
      reasonCode: 'apply_error' 
    });
  }

  private async handleActionClick(
    page: Page,
    button: Locator,
    jobUrl: string,
    stepCount: number,
    actionType: 'NEXT' | 'SUBMIT'
  ): Promise<ApplyResult | null> {
    const isEnabled = await this.safeIsEnabled(button);

    if (!isEnabled) {
      const errors = await this.extractFormErrorsDetailed(page) || [{ field: 'unknown', error: 'Botão presente, mas desabilitado' }];
      await this.dismissDiscardModal(page);
      return {
        status: 'complex_form',
        details: `Botão presente mas desabilitado na etapa ${stepCount}.`,
        skippedBy: 'apply',
        reasonCode: 'complex_form',
        metadata: { jobUrl, stepCount, errors }
      } as any;
    }

    await this.dismissBlockingOverlays(page);
    const clicked = await this.safeClick(page, button, LinkedInApplyService.RETRIES.CLICK);
    if (!clicked) {
      return this.buildErrorResult(page, jobUrl, `Falha física/DOM ao tentar clicar no botão [${actionType}] na etapa ${stepCount}.`, { 
        rejectedBy: 'apply', 
        reasonCode: 'infra_error' 
      });
    }

    console.info(`[APPLY] 🔄 Etapa ${stepCount}: Ação [${actionType}] executada.`, { jobUrl });
    await page.waitForTimeout(LinkedInApplyService.TIMEOUTS.STEP_TRANSITION);

    const errorsAfterClick = await this.extractFormErrorsDetailed(page);
    if (errorsAfterClick && errorsAfterClick.length > 0) {
      await this.dismissDiscardModal(page);
      return {
        status: 'complex_form',
        details: `Bloqueado por validação após clique na etapa ${stepCount}.`,
        skippedBy: 'apply',
        reasonCode: 'complex_form',
        metadata: { jobUrl, stepCount, errors: errorsAfterClick }
      } as any;
    }

    if (actionType === 'SUBMIT') {
      await page.waitForTimeout(2000);
      const isSuccess = await this.verifySuccessState(page);
      if (isSuccess || !(await page.$(LinkedInApplyService.SELECTORS.MODAL_CONTAINER).catch(()=>null))) {
        console.info(`[APPLY] ✅ Candidatura concluída com sucesso!`, { jobUrl });
        return { status: 'submitted', details: 'Candidatura enviada com sucesso.' } as any;
      }
    }

    return null;
  }

  private async verifySuccessState(page: Page): Promise<boolean> {
    try {
      const successIndicators = [
        '.artdeco-toast-item--success',
        '[data-test-modal-id="postApplyModal"]',
        '.jobs-s-apply__application-successful',
        'button:has-text("Applied")',
        'button:has-text("Candidatura enviada")'
      ].join(',');

      const successElement = page.locator(successIndicators).first();
      return await successElement.isVisible({ timeout: LinkedInApplyService.TIMEOUTS.SUCCESS_CHECK }).catch(() => false);
    } catch {
      return false;
    }
  }

  private async extractFormErrorsDetailed(page: Page): Promise<Array<any>> {
    try {
      const containers = await page.$$(LinkedInApplyService.SELECTORS.ERROR_TEXT_LOCATORS).catch(() => []);
      const results: any[] = [];

      for (const c of containers) {
        try {
          const labelEl = await c.$('label, legend') || await c.evaluateHandle((el) => {
            let p: any = el.parentElement;
            while (p && p !== document.body) {
              const l = p.querySelector('label, legend');
              if (l) return l;
              p = p.parentElement;
            }
            return null;
          }).catch(() => null);

          const label = labelEl ? (await (labelEl as ElementHandle).innerText().catch(() => '')).replace(/\n/g, ' ').trim() : '';

          const input = await c.$('input, select, textarea') || await c.evaluateHandle((el) => {
            let p: any = el.parentElement;
            while (p && p !== document.body) {
              const i = p.querySelector('input, select, textarea, fieldset');
              if (i) return i;
              p = p.parentElement;
            }
            return null;
          }).catch(() => null);

          let type = 'unknown';
          let options: string[] = [];
          if (input) {
            const tag = await (input as ElementHandle).evaluate((n: any) => n.tagName.toLowerCase()).catch(() => '');
            if (tag === 'select') {
              type = 'select';
              options = await (input as ElementHandle).evaluate((s: HTMLSelectElement) => Array.from(s.options || []).map(o => o.textContent?.trim() || '')).catch(() => []);
            } else if (tag === 'fieldset') {
              const radios = await (input as ElementHandle).$$('input[type="radio"], input[type="checkbox"]').catch(() => []);
              type = radios.length > 0 ? 'choice' : 'fieldset';
              options = await (input as ElementHandle).evaluate((fs: HTMLElement) => {
                const labels = Array.from(fs.querySelectorAll('label')).map(l => l.textContent?.trim() || '');
                return labels;
              }).catch(() => []);
            } else {
              type = await (input as ElementHandle).evaluate((n: any) => n.getAttribute('type') || n.tagName.toLowerCase()).catch(() => 'input');
            }
          }

          const errorText = await c.innerText().catch(() => '');
          const cleanError = errorText.replace(/\n/g, ' ').trim();

          results.push({
            field: label || 'Campo Desconhecido',
            label: label || '',
            type,
            options: options.length ? options : undefined,
            error: cleanError || 'Campo obrigatório'
          });
        } catch {
          /* ignore per-container errors */
        }
      }

      const unique = results.filter((v, i, a) => a.findIndex(x => x.field === v.field && x.error === v.error) === i);
      return unique;
    } catch {
      return [];
    }
  }

  private async findVisibleElement(page: Page, selector: string): Promise<Locator | null> {
    try {
      const locator = page.locator(selector).first();
      if (await locator.isVisible().catch(() => false)) return locator;
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
        await this.dismissBlockingOverlays(page);
        await page.waitForTimeout(150);
        const stable = await this.waitForElementStable(locator, LinkedInApplyService.TIMEOUTS.STABILITY_POLL);
        if (!stable) throw new Error('Elemento instável antes do clique');

        const intercepted = await this.isPointerIntercepted(page, locator);
        if (intercepted) {
          console.warn('[APPLY] Overlay interceptando ponteiro detectado antes do clique');
          await this.dismissBlockingOverlays(page);
          await page.waitForTimeout(LinkedInApplyService.TIMEOUTS.OVERLAY_WAIT);
        }

        await locator.click({ timeout: 5000 });
        return true;
      } catch (e) {
        console.warn(`[APPLY] Falha no clique (Tentativa ${attempt}/${retries})`, String(e));

        // fallback JS click
        try {
          const handle = await locator.elementHandle({ timeout: 1000 });
          if (handle) {
            await page.evaluate((el) => (el as HTMLElement).click(), handle);
            return true;
          }
        } catch {}

        // fallback focus + Enter
        try {
          await locator.focus({ timeout: 1000 });
          await page.keyboard.press('Enter');
          return true;
        } catch {}

        // último recurso: force click
        try {
          await locator.click({ timeout: 2000, force: true });
          return true;
        } catch {}

        if (DEBUG) {
          await this.takeDebugScreenshot(page, `click-fail-attempt-${attempt}`);
          const overlayPresent = await page.isVisible(LinkedInApplyService.SELECTORS.OVERLAY_GENERIC).catch(() => false);
          console.info('[APPLY][DIAG] overlayPresent', { overlayPresent });
        }

        await page.waitForTimeout(LinkedInApplyService.TIMEOUTS.CLICK_RETRY_DELAY);
      }
    }
    return false;
  }

  private async waitForElementStable(locator: Locator, timeoutMs: number): Promise<boolean> {
    const start = Date.now();
    try {
      let lastBox: { x: number; y: number; width: number; height: number } | null = null;
      while (Date.now() - start < timeoutMs) {
        const box = await locator.boundingBox().catch(() => null);
        if (!box) return false;
        if (lastBox && box.x === lastBox.x && box.y === lastBox.y && box.width === lastBox.width && box.height === lastBox.height) {
          return true;
        }
        lastBox = box;
        await new Promise(r => setTimeout(r, 120));
      }
      return false;
    } catch {
      return false;
    }
  }

  private async isPointerIntercepted(page: Page, locator: Locator): Promise<boolean> {
    try {
      const box = await locator.boundingBox().catch(() => null);
      if (!box) return false;
      const centerX = Math.round(box.x + box.width / 2);
      const centerY = Math.round(box.y + box.height / 2);
      const topTag = await page.evaluate(({ x, y }) => {
        const el = document.elementFromPoint(x, y);
        return el ? (el as HTMLElement).outerHTML.slice(0, 200) : null;
      }, { x: centerX, y: centerY }).catch(() => null);
      if (!topTag) return false;
      const isIntercepting = !(topTag.toLowerCase().includes('button') || topTag.toLowerCase().includes('input') || topTag.toLowerCase().includes('a'));
      return isIntercepting;
    } catch {
      return false;
    }
  }

  private async dismissBlockingOverlays(page: Page): Promise<void> {
    try {
      const overlayButtons = [
        '.msg-overlay-bubble-header__control--close-btn',
        'button[aria-label*="Dismiss"]',
        'button[aria-label*="Fechar"]',
        'button.artdeco-modal__dismiss'
      ];
      for (const sel of overlayButtons) {
        try {
          const btn = await page.$(sel);
          if (btn && await btn.isVisible().catch(() => false)) {
            await btn.click({ timeout: 1200 }).catch(() => {});
            await page.waitForTimeout(300);
          }
        } catch { /* ignore */ }
      }

      await page.waitForSelector(LinkedInApplyService.SELECTORS.OVERLAY_GENERIC, { state: 'hidden', timeout: LinkedInApplyService.TIMEOUTS.OVERLAY_WAIT }).catch(() => {});
    } catch { /* ignore */ }
  }

  private async dismissDiscardModal(page: Page): Promise<void> {
    try {
      const discardSelectors = [
        'button:has-text("Discard")',
        'button:has-text("Descartar")',
        'button:has-text("Não salvar")',
        'button:has-text("Don\'t save")',
        `${LinkedInApplyService.SELECTORS.DISCARD_CONFIRM} button`
      ];
      for (const sel of discardSelectors) {
        try {
          const btn = await page.$(sel);
          if (btn && await btn.isVisible().catch(() => false)) {
            await btn.click({ timeout: 1200 }).catch(() => {});
            await page.waitForTimeout(400);
          }
        } catch { /* ignore */ }
      }

      await page.waitForSelector(LinkedInApplyService.SELECTORS.OVERLAY_GENERIC, { state: 'hidden', timeout: 1200 }).catch(() => {});
    } catch {
      /* ignore */
    }
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

  private async buildErrorResult(page: Page, jobUrl: string, details: string, extra: { rejectedBy?: string, reasonCode?: string, [key: string]: any } = {}): Promise<ApplyResult> {
    const snippet = await this.safePageContentSnippet(page);
    await this.takeDebugScreenshot(page, `error_state`);
    
    // Extrai propriedades específicas, garantindo padrão para o ApplyResult
    const { rejectedBy = 'apply', reasonCode = 'apply_error', ...restExtra } = extra;

    return {
      status: 'error',
      details,
      skippedBy: undefined,
      rejectedBy,
      reasonCode,
      metadata: { jobUrl, snippet, ...restExtra }
    } as any;
  }

  private async takeDebugScreenshot(page: Page, prefix: string): Promise<void> {
    if (!DEBUG) return;
    try {
      const fileName = `apply-debug-${prefix}-${Date.now()}.png`;
      const out = path.resolve(process.cwd(), fileName);
      await page.screenshot({ path: out, fullPage: true }).catch(() => {});
      console.info(`[APPLY][DIAG] Screenshot salvo: ${out}`);
    } catch (e) {
      console.warn('[APPLY][DIAG] Falha ao salvar screenshot', e);
    }
  }
}