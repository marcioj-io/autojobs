// packages/engine/src/apply/applyService.ts
import type { Page, BrowserContext } from 'playwright';
import type { ApplyResult } from '@autojobs/shared';

export class LinkedInApplyService {
  // Seletores robustos e multilíngue
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

  async applyToJob(mainPage: Page, context: BrowserContext, jobUrl: string): Promise<ApplyResult> {
    let page = mainPage;
    let openedFallback = false;

    try {
      // 1) Tenta encontrar botão no contexto atual (página principal)
      await page.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => {});
      let btn = await page.$(this.EASY_APPLY_SELECTORS).catch(() => null);

      // 2) Fallback: abrir em nova aba dentro do mesmo context (garante cookies/CSRF iguais)
      if (!btn) {
        console.log(`[Apply] ⚠️ Botão Easy Apply não encontrado no card. Abrindo URL em nova aba para tentar novamente...`);
        page = await context.newPage();
        openedFallback = true;
        await page.goto(jobUrl, { waitUntil: 'domcontentloaded', timeout: 15000 }).catch(() => {});
        await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});
        btn = await page.$(this.EASY_APPLY_SELECTORS).catch(() => null);
      }

      if (!btn) {
        return {
          status: 'no_easy_apply',
          details: 'Botão "Candidatura Simplificada" não encontrado na interface principal e nem na aba de fallback.'
        };
      }

      // 3) Clicar e aguardar modal
      await btn.click().catch(() => {});
      await page.waitForSelector('.jobs-easy-apply-modal, .jobs-easy-apply-form', { state: 'visible', timeout: 8000 }).catch(() => null);
      await page.waitForTimeout(1000);

      // 4) Paginação e submissão com robustez
      return await this.processApplicationSteps(page);

    } catch (error: any) {
      return {
        status: 'error',
        details: `Exceção durante a inicialização da candidatura: ${error?.message ?? String(error)}`
      };
    } finally {
      if (openedFallback && page && !page.isClosed()) {
        await page.close().catch(() => {});
      }
    }
  }

  private async processApplicationSteps(page: Page): Promise<ApplyResult> {
    let stepCount = 0;
    const maxSteps = 14;

    while (stepCount < maxSteps) {
      stepCount++;
      await page.waitForTimeout(1200);

      // 1) Procurar botão Submit (última etapa)
      const submitBtn = await page.$(this.SUBMIT_BTN).catch(() => null);
      if (submitBtn) {
        const isEnabled = await submitBtn.isEnabled().catch(() => false);
        if (isEnabled) {
          await submitBtn.click().catch(() => {});
          // aguarda confirmação (pode ser toast ou redirecionamento)
          await page.waitForTimeout(2500);
          return { status: 'submitted', details: 'Candidatura enviada com sucesso.' };
        } else {
          const errorMsg = await this.extractFormErrors(page);
          return { status: 'complex_form', details: `Exigência de preenchimento manual no Submit final. Etapa ${stepCount}. Motivo detectado: [${errorMsg}]` };
        }
      }

      // 2) Procurar botão Next/Continue
      const nextBtn = await page.$(this.NEXT_BTN).catch(() => null);
      if (nextBtn) {
        const isEnabled = await nextBtn.isEnabled().catch(() => false);
        if (isEnabled) {
          await nextBtn.click().catch(() => {});
          await page.waitForTimeout(900);
          continue;
        } else {
          const errorMsg = await this.extractFormErrors(page);
          return { status: 'complex_form', details: `Travado no botão Avançar. Etapa ${stepCount}. Perguntas pendentes: [${errorMsg}]` };
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

      return { status: 'error', details: `Sem botões de ação claros (Next/Submit) na etapa ${stepCount}.` };
    }

    return { status: 'error', details: 'Limite máximo de passos excedido. Processo abortado por segurança.' };
  }

  private async extractFormErrors(page: Page): Promise<string> {
    try {
      const errorTexts = await page.locator(this.ERROR_TEXT_LOCATORS).allInnerTexts().catch(() => []);
      const cleanErrors = errorTexts.map(t => t.replace(/\n/g, ' ').trim()).filter(Boolean);
      if (cleanErrors.length > 0) {
        const uniqueErrors = [...new Set(cleanErrors)];
        return uniqueErrors.join(' | ');
      }
      return 'Campos obrigatórios sem label clara ou erro de UI do LinkedIn.';
    } catch {
      return 'Não foi possível ler as labels de erro do DOM.';
    }
  }
}
