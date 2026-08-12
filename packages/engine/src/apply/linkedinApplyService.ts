// packages/engine/src/apply/linkedinApplyService.ts
import fs from 'node:fs';
import path from 'node:path';
import type { BrowserContext, Locator, Page } from 'playwright';
import type { ApplyResult } from '@autojobs/shared';

const DEBUG = process.env.DEBUG_APPLY === 'true';
const CAPTURE_ON_ERROR = process.env.APPLY_CAPTURE_ON_ERROR !== 'false';
const DEBUG_DIR = process.env.APPLY_DEBUG_DIR ?? './apply-debug';

type ActionType = 'NEXT' | 'SUBMIT';

interface ClickResult {
  ok: boolean;
  attempts: number;
  lastError?: string;
}

interface FormError {
  field: string;
  label: string;
  type: string;
  options?: string[];
  error: string;
}

interface ErrorContext {
  reasonCode: string;
  rejectedBy?: string;
  attempts?: number;
  lastError?: string;
  startTs: number;
  [key: string]: unknown;
}

const CONFIG = {
  timeout: {
    networkIdle: 10_000,
    navigation: 15_000,
    modal: 12_000,
    transition: 2_200,
    click: 5_000,
    clickRetryDelay: 600,
    stability: 1_200,
    overlay: 1_400,
    success: 3_000,
  },
  retry: {
    click: 5,
    maxSteps: 25,
  },
} as const;

const SELECTORS = {
  easyApply: [
    'button[aria-label*="Easy Apply" i]',
    'button[title*="Easy Apply" i]',
    'button[data-control-name*="easy_apply" i]',
    'button[data-test-id*="easy-apply" i]',
    '[role="button"][aria-label*="Easy Apply" i]',
    '[role="button"][title*="Easy Apply" i]',
    'button:has-text("Easy Apply")',
  ],

  nextOrReview: [
    'footer button:has-text("Next")',
    'footer button:has-text("Continue")',
    'footer button:has-text("Review")',
    'button[aria-label="Continue to next step"]',
    'button[aria-label="Review your application"]',
    'button:has-text("Next")',
    'button:has-text("Continue")',
    'button:has-text("Review")',
    '[data-test-modal-id="apply-form-next-button"]',
    '[aria-label="Continue"]',
  ],

  submit: [
    'footer button:has-text("Submit")',
    'button[aria-label="Submit application"]',
    'button:has-text("Submit application")',
    'button:has-text("Submit")',
    '[data-test-modal-id="apply-form-submit-button"]',
    '[aria-label="Submit"]',
  ],

  modal: [
    '[role="dialog"]',
    '.jobs-easy-apply-modal',
    '.jobs-easy-apply-form',
    '.jobs-easy-apply__content',
  ],

  closeModal: [
    'button[aria-label="Dismiss"]',
    'button[aria-label="Close"]',
    'button.artdeco-modal__dismiss',
    'button[data-test-modal-close-btn]',
  ],

  overlayDismiss: [
    '.msg-overlay-bubble-header__control--close-btn',
    'button[aria-label*="Dismiss" i]',
    'button[aria-label*="Close" i]',
    'button.artdeco-modal__dismiss',
  ],

  overlay: [
    '.artdeco-modal__overlay',
    '.artdeco-modal-overlay',
    '.msg-overlay-bubble-header__control',
  ],

  discard: [
    'button:has-text("Discard")',
    'button:has-text("Don\'t save")',
    'button:has-text("Descartar")', // Injetado PT-BR
    'button:has-text("Não salvar")', // Injetado PT-BR
    '[data-test-easy-apply-discard-confirmation] button',
    '[data-control-name="discard_application_confirm_btn"]' // Seletor nativo do LinkedIn
  ],

  errors: [
    '.artdeco-inline-feedback--error',
    '.jobs-easy-apply-form-element:has(.artdeco-text-input--error)',
    '.jobs-easy-apply-form-element:has(fieldset[data-invalid="true"])',
  ],

  success: [
    '.artdeco-toast-item--success',
    '[data-test-modal-id="postApplyModal"]',
    '.jobs-s-apply__application-successful',
    'button:has-text("Applied")',
  ],
} as const;

/* -----------------------
 Playwright UI helpers
----------------------- */

class PlaywrightUi {
  private async waitForLocator(
    page: Page,
    selectors: readonly string[],
    timeout: number,
  ): Promise<Locator | null> {
    const deadline = Date.now() + timeout;
    while (Date.now() < deadline) {
      const locator = await this.findVisible(page, selectors);
      if (locator) return locator;
      await page.waitForTimeout(200);
    }
    return null;
  }

  async findEasyApply(page: Page): Promise<Locator | null> {
    const directMatch = await this.findVisible(page, SELECTORS.easyApply);
    if (directMatch && await this.isEasyApplyButton(directMatch)) return directMatch;

    const candidates = page.locator('button, [role="button"], a');
    const count = await candidates.count().catch(() => 0);
    for (let index = 0; index < count; index++) {
      const candidate = candidates.nth(index);
      if (!(await candidate.isVisible().catch(() => false))) continue;
      if (!(await candidate.isEnabled().catch(() => false))) continue;
      if (await this.isEasyApplyButton(candidate)) return candidate;
    }
    return null;
  }

  private async isEasyApplyButton(locator: Locator): Promise<boolean> {
    try {
      const [ariaLabel, title, text] = await Promise.all([
        locator.getAttribute('aria-label'),
        locator.getAttribute('title'),
        locator.innerText().catch(() => ''),
      ]);
      const semanticLabel = [ariaLabel, title, text].filter(Boolean).join(' ').replace(/\s+/g, ' ').trim();
      return /\beasy\s+apply\b/i.test(semanticLabel);
    } catch {
      return false;
    }
  }

  async findVisible(page: Page, selectors: readonly string[]): Promise<Locator | null> {
    for (const selector of selectors) {
      const locator = page.locator(selector);
      const count = await locator.count().catch(() => 0);
      for (let index = 0; index < count; index++) {
        const candidate = locator.nth(index);
        if (await candidate.isVisible().catch(() => false)) return candidate;
      }
    }
    return null;
  }

  async isVisible(page: Page, selectors: readonly string[]): Promise<boolean> {
    return (await this.findVisible(page, selectors)) !== null;
  }

  async isEnabled(locator: Locator): Promise<boolean> {
    return locator.isEnabled({ timeout: 1_000 }).catch(() => false);
  }

  async click(page: Page, locator: Locator, retries: number): Promise<ClickResult> {
    let lastError = 'Unknown click error';
    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        await this.dismissOverlays(page);
        if (!(await this.isEnabled(locator))) throw new Error('locator is disabled');
        await locator.scrollIntoViewIfNeeded().catch(() => undefined);
        await locator.click({ timeout: CONFIG.timeout.click });
        return { ok: true, attempts: attempt };
      } catch (error) {
        lastError = error instanceof Error ? error.message : String(error);
        if (DEBUG) console.warn('[APPLY] Click failed', { attempt, retries, error: lastError });
        await page.waitForTimeout(Math.min(CONFIG.timeout.clickRetryDelay * 2 ** (attempt - 1), 5_000));
      }
    }
    return { ok: false, attempts: retries, lastError };
  }

  async dismissOverlays(page: Page): Promise<void> {
    for (const selector of SELECTORS.overlayDismiss) {
      const button = await this.findVisible(page, [selector]);
      if (!button) continue;
      await button.click({ timeout: 1_200 }).catch(() => undefined);
      await page.waitForTimeout(250);
    }

    for (const sel of SELECTORS.modal) {
      const modal = await this.findVisible(page, [sel]);
      if (!modal) continue;
      const closeCandidates = [
        'button[aria-label*="Dismiss" i]',
        'button[aria-label*="Close" i]',
        'button:has-text("Fechar")',
        'button:has-text("Close")',
        'button:has-text("Dismiss")',
        'button:has-text("Não agora")',
        'button:has-text("Not now")',
        '.artdeco-modal__dismiss'
      ];
      for (const c of closeCandidates) {
        const btn = await this.findVisible(page, [c]);
        if (!btn) continue;
        await btn.click({ timeout: 1_200 }).catch(() => undefined);
        await page.waitForTimeout(250);
      }
      await page.click(sel, { timeout: 1_000 }).catch(() => undefined);
      await page.waitForTimeout(250);
    }

    await page.waitForSelector(SELECTORS.overlay.join(','), { state: 'hidden', timeout: CONFIG.timeout.overlay }).catch(() => undefined);
  }

  async handleSaveApplicationModal(page: Page): Promise<boolean> {
    const dialogSelectors = ['[role="dialog"]', '.jobs-easy-apply-modal', '.artdeco-modal'];
    const dialog = await this.findVisible(page, dialogSelectors);
    if (!dialog) return false;
    const text = await dialog.evaluate((el) => (el.textContent || '').toLowerCase()).catch(() => '');
    if (!/save this application|save your application|salvar esta candidatura|salvar sua candidatura|save application/i.test(text)) return false;

    const discardSelectors = [
      'button:has-text("Discard")',
      'button:has-text("Discard application")',
      'button:has-text("Descartar")',
      'button:has-text("Don\'t save")',
      'button:has-text("Não salvar")',
      'button:has-text("Don’t save")'
    ];

    const saveSelectors = [
      'button:has-text("Save")',
      'button:has-text("Save application")',
      'button:has-text("Salvar")'
    ];

    for (const sel of discardSelectors) {
      const btn = await this.findVisible(page, [sel]);
      if (!btn) continue;
      const click = await this.click(page, btn, 3);
      if (click.ok) {
        await page.waitForTimeout(300);
        await this.waitForVisible(page, SELECTORS.modal, 800).catch(() => undefined);
        return true;
      }
    }

    try {
      const clicked = await page.evaluate(() => {
        const texts = ['discard', "don't save", 'descartar', 'não salvar', 'don’t save'];
        const buttons = Array.from(document.querySelectorAll('button, [role="button"], a'));
        for (const b of buttons) {
          const t = (b.textContent || '').toLowerCase();
          for (const needle of texts) {
            if (t.includes(needle)) {
              try { (b as HTMLElement).click(); return true; } catch { /* ignore */ }
            }
          }
        }
        return false;
      }).catch(() => false);

      if (clicked) {
        await page.waitForTimeout(300);
        return true;
      }
    } catch { /* ignore */ }

    for (const sel of saveSelectors) {
      const btn = await this.findVisible(page, [sel]);
      if (!btn) continue;
      const click = await this.click(page, btn, 3);
      if (click.ok) {
        await page.waitForTimeout(300);
        return true;
      }
    }

    await this.dismissOverlays(page);
    return true;
  }

  async dismissDiscard(page: Page): Promise<void> {
      // 1. Clica no 'X' para abortar a candidatura
      const closeButton = await this.findVisible(page, SELECTORS.closeModal);
      if (!closeButton) return;
      
      await closeButton.click({ timeout: 1_500 }).catch(() => undefined);
      
      // Aguarda um instante para a animação do modal de confirmação "Save application?" aparecer
      await page.waitForTimeout(600); 

      // 2. Aciona o seu tratador de modal que já tem os seletores, traduções e injeção de script!
      await this.handleSaveApplicationModal(page);
      
      // Garante que o modal sumiu de vez antes de liberar o fluxo
      await page.waitForTimeout(500);
  }

  async waitForVisible(page: Page, selectors: readonly string[], timeout: number): Promise<boolean> {
    const deadline = Date.now() + timeout;
    while (Date.now() < deadline) {
      if (await this.isVisible(page, selectors)) return true;
      await page.waitForTimeout(250);
    }
    return false;
  }

  async waitForTransition(page: Page): Promise<void> {
    await Promise.race([
      page.waitForSelector(SELECTORS.modal.join(','), { state: 'hidden', timeout: 4_000 }).catch(() => undefined),
      this.waitForVisible(page, SELECTORS.nextOrReview, 4_000),
      this.waitForVisible(page, SELECTORS.submit, 4_000),
      page.waitForTimeout(CONFIG.timeout.transition),
    ]);
  }
}

/* -----------------------
 FormInspector
----------------------- */

class FormInspector {
  async errors(page: Page): Promise<FormError[]> {
    const containers = await this.visibleErrorContainers(page);
    const result: FormError[] = [];
    for (const container of containers) {
      const error = await this.inspect(container);
      if (error) result.push(error);
    }
    return this.unique(result);
  }

  private async visibleErrorContainers(page: Page): Promise<Locator[]> {
    const result: Locator[] = [];
    for (const selector of SELECTORS.errors) {
      const locator = page.locator(selector);
      const count = await locator.count().catch(() => 0);
      for (let index = 0; index < count; index++) {
        const candidate = locator.nth(index);
        if (await candidate.isVisible().catch(() => false)) result.push(candidate);
      }
    }
    return result;
  }

  private async inspect(container: Locator): Promise<FormError | null> {
    try {
      const label = await this.findLabel(container);
      const control = container.locator('input, select, textarea, fieldset').first();
      const hasControl = (await control.count().catch(() => 0)) > 0;
      const type = hasControl ? await this.typeOf(control) : 'unknown';
      const options = hasControl ? await this.optionsOf(control, type) : [];
      const error = this.clean(await container.innerText().catch(() => ''));
      return {
        field: label || 'Unknown field',
        label,
        type,
        options: options.length ? options : undefined,
        error: error || 'Required field',
      };
    } catch {
      return null;
    }
  }

  private async findLabel(container: Locator): Promise<string> {
    const direct = container.locator('label, legend').first();
    if ((await direct.count().catch(() => 0)) > 0) {
      const text = this.clean(await direct.innerText().catch(() => ''));
      if (text) return text;
    }
    return container.evaluate((element) => {
      let parent = element.parentElement;
      while (parent && parent !== document.body) {
        const label = parent.querySelector('label, legend');
        if (label?.textContent?.trim()) return label.textContent.trim();
        parent = parent.parentElement;
      }
      return '';
    }).catch(() => '');
  }

  private async typeOf(control: Locator): Promise<string> {
    return control.evaluate((element) => {
      const tag = element.tagName.toLowerCase();
      if (tag === 'select') return 'select';
      if (tag === 'fieldset') {
        return element.querySelector('input[type="radio"], input[type="checkbox"]') ? 'choice' : 'fieldset';
      }
      return element.getAttribute('type') || tag;
    }).catch(() => 'unknown');
  }

  private async optionsOf(control: Locator, type: string): Promise<string[]> {
    if (!['select', 'choice', 'fieldset'].includes(type)) return [];
    return control.evaluate((element) => {
      if (element.tagName.toLowerCase() === 'select') {
        return Array.from((element as HTMLSelectElement).options).map((option) => option.textContent?.trim() ?? '').filter(Boolean);
      }
      return Array.from(element.querySelectorAll('label')).map((label) => label.textContent?.trim() ?? '').filter(Boolean);
    }).catch(() => []);
  }

  private clean(value: string): string {
    return value.replace(/\s+/g, ' ').trim();
  }

  private unique(errors: FormError[]): FormError[] {
    const seen = new Set<string>();
    return errors.filter((error) => {
      const key = `${error.field}|${error.error}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }
}

/* -----------------------
 Diagnostics
----------------------- */

class ApplyDiagnostics {
  constructor() {
    if (!CAPTURE_ON_ERROR) return;
    try { fs.mkdirSync(DEBUG_DIR, { recursive: true }); } catch {}
  }

  async snippet(page: Page): Promise<string> {
    return page.evaluate(() => {
      const html = document.body?.innerHTML ?? '';
      return (html.length > 4_000 ? `${html.slice(0, 4_000)}...` : html).replace(/\s+/g, ' ');
    }).catch(() => '');
  }

  async screenshot(page: Page, prefix: string): Promise<string> {
    if (!CAPTURE_ON_ERROR) return '';
    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const file = path.join(DEBUG_DIR, `${prefix}_${timestamp}.png`);
      await page.screenshot({ path: file, fullPage: true, timeout: 2_500 }).catch(() => undefined);
      return file;
    } catch { return ''; }
  }

  async error(page: Page, jobUrl: string, details: string, context: ErrorContext): Promise<ApplyResult> {
    const snippet = await this.snippet(page);
    const screenshotPath = await this.screenshot(page, 'error');
    console.error('[APPLY_FLOW][ERRO]', { jobUrl, details, reasonCode: context.reasonCode, rejectedBy: context.rejectedBy, attempts: context.attempts, lastError: context.lastError });
    return {
      status: 'error',
      details,
      skippedBy: context.rejectedBy ?? 'system',
      reasonCode: context.reasonCode,
      metadata: { ...context, jobUrl, snippet, screenshotPath, elapsedMs: Date.now() - context.startTs },
    } as ApplyResult;
  }
}

/* -----------------------
 ApplicationWorkflow
----------------------- */

class ApplicationWorkflow {
  constructor(private readonly ui: PlaywrightUi, private readonly inspector: FormInspector, private readonly diagnostics: ApplyDiagnostics) {}

  private async getLocatorLabel(locator: Locator, fallback: string): Promise<string> {
    try {
      const text = await locator.evaluate((el) => el.textContent?.trim());
      return text ? text : fallback;
    } catch { return fallback; }
  }

  async run(page: Page, jobUrl: string, startTs: number): Promise<ApplyResult> {
    console.info(`[APPLY_FLOW] Iniciando fluxo de loop (max ${CONFIG.retry.maxSteps} passos)...`);
    for (let step = 1; step <= CONFIG.retry.maxSteps; step++) {
      console.info(`[APPLY_FLOW] --- Passo ${step} ---`);
      await page.waitForTimeout(1_000);

      if (!(await this.ui.isVisible(page, SELECTORS.modal))) {
        if (await this.isSuccess(page)) {
          console.info(`[APPLY_FLOW] Modal não visível, mas painel de sucesso detectado.`);
          return this.submitted(jobUrl, step, startTs);
        }
        console.warn(`[APPLY_FLOW] Modal sumiu misteriosamente no passo ${step}. Abortando.`);
        return this.diagnostics.error(page, jobUrl, `Application modal disappeared at step ${step}.`, { reasonCode: 'infra_error', rejectedBy: 'apply', attempts: step, startTs });
      }

      const submit = await this.ui.findVisible(page, SELECTORS.submit);
      const next = await this.ui.findVisible(page, SELECTORS.nextOrReview);

      if (submit && (await this.ui.isEnabled(submit))) {
        const btnLabel = await this.getLocatorLabel(submit, 'Submit');
        console.info(`[APPLY_FLOW] Botão de submissão encontrado: "${btnLabel}"`);
        const result = await this.executeAction(page, submit, jobUrl, step, 'SUBMIT', startTs);
        if (result) return result;
        continue;
      }

      if (next && (await this.ui.isEnabled(next))) {
        const btnLabel = await this.getLocatorLabel(next, 'Next/Review');
        console.info(`[APPLY_FLOW] Botão de progressão encontrado: "${btnLabel}"`);
        const result = await this.executeAction(page, next, jobUrl, step, 'NEXT', startTs);
        if (result) return result;
        continue;
      }

      const fallbackButton = await this.ui.findVisible(page, [
        'footer button:has-text("Next")',
        'footer button:has-text("Review")',
        'footer button:has-text("Submit")',
        'footer button:has-text("Continue")',
        'button[aria-label="Continue to next step"]',
        'button[aria-label="Review your application"]',
        'button[aria-label="Submit application"]',
        'button:has-text("Next")',
        'button:has-text("Continue")',
        'button:has-text("Review")',
        'button:has-text("Submit application")',
        'button:has-text("Submit")',
      ]);

      if (fallbackButton && (await this.ui.isEnabled(fallbackButton))) {
        const fallbackText = await this.getLocatorLabel(fallbackButton, 'Fallback');
        console.info(`[APPLY_FLOW] Botão fallback genérico encontrado: "${fallbackText}"`);
        const action: ActionType = /submit/i.test(fallbackText) ? 'SUBMIT' : 'NEXT';
        const result = await this.executeAction(page, fallbackButton, jobUrl, step, action, startTs);
        if (result) return result;
        continue;
      }

      console.warn(`[APPLY_FLOW] Beco sem saída. Nenhum botão (Next, Review, Submit) foi localizado ou estão desabilitados no passo ${step}.`);
      return this.deadEnd(page, jobUrl, step, startTs);
    }

    console.error(`[APPLY_FLOW] Falha. Máximo de passos de aplicação (${CONFIG.retry.maxSteps}) excedido.`);
    return this.diagnostics.error(page, jobUrl, 'Maximum application step limit exceeded.', { reasonCode: 'apply_error', rejectedBy: 'apply', startTs });
  }

  private async executeAction(page: Page, button: Locator, jobUrl: string, step: number, action: ActionType, startTs: number): Promise<ApplyResult | null> {
    if (!(await this.ui.isEnabled(button))) {
      console.warn(`[APPLY_FLOW] Ação ${action} requerida, mas botão está presente e desabilitado.`);
      return this.validationFailure(page, jobUrl, step, startTs, 'Action button is present but disabled.');
    }

    console.info(`[APPLY_FLOW] Executando clique de ação: ${action}`);
    const click = await this.ui.click(page, button, CONFIG.retry.click);
    if (!click.ok) {
      console.error(`[APPLY_FLOW] Falha crítica ao clicar no botão ${action}.`);
      return this.diagnostics.error(page, jobUrl, `Failed to click ${action} at step ${step}.`, { reasonCode: 'infra_error', rejectedBy: 'apply', attempts: click.attempts, lastError: click.lastError, startTs });
    }

    console.info(`[APPLY_FLOW] Passo concluído: ${action} executado. Aguardando transição...`);
    await this.ui.waitForTransition(page);
    await page.waitForTimeout(400);

    try { await this.ui.handleSaveApplicationModal(page); } catch (e) { if (DEBUG) console.warn('[APPLY] handleSaveApplicationModal falhou', e); }

    const confirmDialog = await this.ui.findVisible(page, ['[role="dialog"]', '.jobs-easy-apply-modal', '.artdeco-modal']);
    if (confirmDialog) {
      const discardBtn = await this.ui.findVisible(page, ['button:has-text("Discard")', 'button:has-text("Discard application")', 'button:has-text("Descartar")', 'button:has-text("Não salvar")']);
      const saveBtn = await this.ui.findVisible(page, ['button:has-text("Save")', 'button:has-text("Save application")', 'button:has-text("Salvar")']);
      if (discardBtn && (await this.ui.isEnabled(discardBtn))) {
        const clickDiscard = await this.ui.click(page, discardBtn, 3);
        if (clickDiscard.ok) await this.ui.waitForTransition(page);
      } else if (saveBtn && (await this.ui.isEnabled(saveBtn))) {
        const clickSave = await this.ui.click(page, saveBtn, 3);
        if (clickSave.ok) await this.ui.waitForTransition(page);
      } else {
        await this.ui.dismissOverlays(page);
      }
    }

    const errors = await this.inspector.errors(page);
    if (errors.length) {
      console.warn(`[APPLY_FLOW] Validação falhou. Formulário tem ${errors.length} erro(s) pendentes.`);
      return this.validationFailure(page, jobUrl, step, startTs, `Application validation blocked step ${step}.`, errors);
    }

    if (action === 'SUBMIT') {
      console.info(`[APPLY_FLOW] Submit executado, aguardando validação de sucesso na UI...`);
      await page.waitForTimeout(2_000);
      if ((await this.isSuccess(page)) || !(await this.ui.isVisible(page, SELECTORS.modal))) {
        return this.submitted(jobUrl, step, startTs);
      }
    }

    return null;
  }

  private async validationFailure(page: Page, jobUrl: string, step: number, startTs: number, details: string, errors?: FormError[]): Promise<ApplyResult> {
    const detected = errors ?? (await this.inspector.errors(page));
    await this.ui.dismissDiscard(page);
    const snippet = await this.diagnostics.snippet(page);
    const screenshotPath = await this.diagnostics.screenshot(page, `validation_step_${step}`);
    return {
      status: 'complex_form',
      details,
      skippedBy: 'apply',
      reasonCode: 'complex_form',
      metadata: { jobUrl, stepCount: step, errors: detected.length ? detected : [{ field: 'Unknown field', label: '', type: 'unknown', error: 'Required field could not be identified.' }], snippet, screenshotPath, elapsedMs: Date.now() - startTs },
    } as ApplyResult;
  }

  private async deadEnd(page: Page, jobUrl: string, step: number, startTs: number): Promise<ApplyResult> {
    // INJETADO: Aborta e descarta a candidatura antes de sair!
    await this.ui.dismissDiscard(page); 
    
    const snippet = await this.diagnostics.snippet(page);
    const screenshotPath = await this.diagnostics.screenshot(page, `dead_end_step_${step}`);
    return {
      status: 'complex_form',
      details: 'No enabled Next, Review, or Submit action was found.',
      skippedBy: 'apply',
      reasonCode: 'complex_form',
      metadata: { jobUrl, stepCount: step, snippet, screenshotPath, elapsedMs: Date.now() - startTs },
    } as ApplyResult;
  }

  private async isSuccess(page: Page): Promise<boolean> {
    return this.ui.isVisible(page, SELECTORS.success);
  }

  private submitted(jobUrl: string, step: number, startTs: number): ApplyResult {
    console.info('[APPLY_FLOW] 🎉 Submissão da Application encontrada com sucesso!', { jobUrl });
    return { status: 'submitted', details: 'Application submitted and confirmed through LinkedIn UI.', metadata: { jobUrl, stepsCompleted: step, elapsedMs: Date.now() - startTs } } as ApplyResult;
  }
}

/* -----------------------
 LinkedInApplyService
----------------------- */

export class LinkedInApplyService {
  private readonly ui = new PlaywrightUi();
  private readonly inspector = new FormInspector();
  private readonly diagnostics = new ApplyDiagnostics();
  private readonly workflow = new ApplicationWorkflow(this.ui, this.inspector, this.diagnostics);

  private async waitForPageReady(page: Page): Promise<void> {
    try {
      await page.waitForLoadState('domcontentloaded', { timeout: CONFIG.timeout.navigation }).catch(() => undefined);
      await page.waitForTimeout(300);
    } catch { /* ignore */ }
  }

  private async waitForApplication(page: Page, jobUrl: string): Promise<boolean> {
    // espera o modal abrir ou detecta se já estava aberto
    const deadline = Date.now() + CONFIG.timeout.modal;
    while (Date.now() < deadline) {
      // se modal visível, pronto
      if (await this.ui.isVisible(page, SELECTORS.modal)) return true;
      // se painel de sucesso apareceu, considerar como sucesso
      if (await this.ui.isVisible(page, SELECTORS.success)) return true;
      // tentar detectar se existe um diálogo "Save this application?" já aberto
      const dialog = await this.ui.findVisible(page, ['[role="dialog"]', '.jobs-easy-apply-modal', '.artdeco-modal']);
      if (dialog) {
        // se o diálogo for o modal de aplicação, considerar aberto
        const text = await dialog.evaluate((el) => (el.textContent || '').toLowerCase()).catch(() => '');
        if (text && /first name|email|phone|save this application|save your application|contact info/i.test(text)) return true;
      }
      await page.waitForTimeout(250);
    }
    return false;
  }

  async applyToJob(mainPage: Page, context: BrowserContext, jobUrl: string): Promise<ApplyResult> {
    const startTs = Date.now();
    let page = mainPage;
    let fallbackPage: Page | null = null;

    console.info('[APPLY_FLOW] Iniciando aplicação. Acessando a vaga:', { jobUrl });

    try {
      await this.waitForPageReady(page);
      await this.ui.dismissOverlays(page);
      await this.ui.dismissDiscard(page);
      await page.waitForTimeout(250);

      console.info('[APPLY_FLOW] Buscando botão Easy Apply...');
      let applyButton = await this.ui.findEasyApply(page);

      if (!applyButton) {
        console.info('[APPLY_FLOW] Easy Apply não encontrado na página principal. Abrindo vaga em nova aba fallback...');
        fallbackPage = await context.newPage();
        page = fallbackPage;
        await page.goto(jobUrl, { waitUntil: 'domcontentloaded', timeout: CONFIG.timeout.navigation });
        await this.waitForPageReady(page);
        await this.ui.dismissOverlays(page);
        await this.ui.dismissDiscard(page);
        await page.waitForTimeout(250);
        applyButton = await this.ui.findEasyApply(page);
      }

      if (!applyButton) {
        console.warn('[APPLY_FLOW] Botão Easy Apply ausente. Vaga não possui candidatura simplificada ou não está disponível.');
        return {
          status: 'no_easy_apply',
          details: 'Easy Apply button was not found.',
          skippedBy: 'system',
          rejectedBy: 'apply',
          reasonCode: 'no_easy_apply',
          metadata: { jobUrl, snippet: await this.diagnostics.snippet(page), elapsedMs: Date.now() - startTs },
        } as ApplyResult;
      }

      console.info('[APPLY_FLOW] Botão Easy Apply localizado. Aplicar clicado.');
      const click = await this.ui.click(page, applyButton, CONFIG.retry.click);
      if (!click.ok) {
        console.error('[APPLY_FLOW] Erro ao tentar clicar no botão Easy Apply.');
        return this.diagnostics.error(page, jobUrl, 'Failed to click Easy Apply.', { reasonCode: 'infra_error', rejectedBy: 'apply', attempts: click.attempts, lastError: click.lastError, startTs });
      }

      console.info('[APPLY_FLOW] Aguardando abertura do modal de formulário...');
      const opened = await this.waitForApplication(page, jobUrl);
      if (!opened) {
        // tentar lidar com modal já aberto ou overlays que bloqueiam
        await this.ui.dismissOverlays(page);
        // tentar novamente detectar modal
        if (!(await this.waitForApplication(page, jobUrl))) {
          return this.diagnostics.error(page, jobUrl, 'Application modal did not open after Easy Apply.', { reasonCode: 'modal_timeout', rejectedBy: 'apply', attempts: 1, startTs });
        }
      }

      // se modal aberto, iniciar workflow de preenchimento/next/submit
      const result = await this.workflow.run(page, jobUrl, startTs);
      return result;
    } catch (err) {
      const details = err instanceof Error ? err.message : String(err);
      return this.diagnostics.error(page, jobUrl, `Unhandled exception: ${details}`, { reasonCode: 'apply_error', rejectedBy: 'apply', startTs });
    } finally {
      try { if (fallbackPage) await fallbackPage.close().catch(() => undefined); } catch {}
    }
  }
}
