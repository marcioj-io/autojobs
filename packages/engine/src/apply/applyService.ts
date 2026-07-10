import { Page } from 'playwright';

export interface ApplyResult {
  status: 'submitted' | 'no_easy_apply' | 'complex_form' | 'error';
  details: string;
}

export class LinkedInApplyService {
  private readonly MAX_STEPS = 10;
  private profile: any;
  private language: string;

  // Resolvendo o erro de construtor no seu scrape()
  constructor(config?: { profile?: any; language?: string }) {
    this.profile = config?.profile || {};
    this.language = config?.language || 'en-US';
  }

  public async applyToJob(page: Page, jobUrl: string, applyParams?: any): Promise<ApplyResult> {
    console.log(`\n🤖 [ApplyService] Iniciando candidatura para: ${jobUrl}`);
    
    try {
      const easyApplyBtn = page.locator('.jobs-apply-button button').filter({ 
        hasText: /(Easy Apply|Candidatura simplificada)/i 
      }).first();

      const isEasyApplyVisible = await easyApplyBtn.isVisible({ timeout: 4000 }).catch(() => false);

      if (!isEasyApplyVisible) {
        console.log(`⚠️ [ApplyService] Sem Easy Apply. Redireciona para fora ou já aplicado.`);
        return { 
          status: 'no_easy_apply', 
          details: 'Botão Easy Apply não encontrado ou vaga redireciona para site da empresa.' 
        };
      }

      await easyApplyBtn.click();
      await page.waitForTimeout(1000);

      let stepCount = 0;
      let isSubmitted = false;

      while (stepCount < this.MAX_STEPS && !isSubmitted) {
        stepCount++;
        
        const modal = page.locator('.jobs-easy-apply-modal');
        if (!(await modal.isVisible().catch(() => false))) {
          isSubmitted = true;
          break;
        }

        const submitBtn = page.locator('button[aria-label="Submit application"], button[aria-label="Enviar candidatura"]').first();
        const reviewBtn = page.locator('button[aria-label="Review your application"], button[aria-label="Revisar candidatura"]').first();
        const nextBtn = page.locator('button[aria-label="Continue to next step"], button[aria-label="Avançar para a próxima etapa"]').first();

        if (await submitBtn.isVisible().catch(() => false)) {
          console.log(`👆 [ApplyService] Passo ${stepCount}: Clicando em ENVIAR CANDIDATURA...`);
          await submitBtn.click();
          await page.waitForTimeout(2000);
          isSubmitted = true;
          break;

        } else if (await reviewBtn.isVisible().catch(() => false)) {
          console.log(`👆 [ApplyService] Passo ${stepCount}: Clicando em REVISAR...`);
          await reviewBtn.click();
          await page.waitForTimeout(1000);

        } else if (await nextBtn.isVisible().catch(() => false)) {
          console.log(`👆 [ApplyService] Passo ${stepCount}: Clicando em AVANÇAR...`);
          await nextBtn.click();
          await page.waitForTimeout(1000);

          const hasError = await page.locator('.artdeco-inline-feedback--error').isVisible().catch(() => false);
          if (hasError) {
            console.log(`❌ [ApplyService] Formulário exige preenchimento manual obrigatório. Abortando.`);
            await this.closeModal(page);
            return {
              status: 'complex_form',
              details: 'O formulário exigiu dados manuais (perguntas customizadas da empresa).'
            };
          }
        } else {
          console.log(`❌ [ApplyService] Nenhum botão de progressão encontrado. Abortando.`);
          await this.closeModal(page);
          return {
            status: 'error',
            details: 'Fluxo desconhecido no modal de candidatura.'
          };
        }
      }

      if (isSubmitted) {
        console.log(`✅ [ApplyService] Candidatura realizada com sucesso!`);
        await this.closeModal(page);
        return { status: 'submitted', details: 'Candidatura enviada via Easy Apply.' };
      } else {
        await this.closeModal(page);
        return { status: 'error', details: 'Limite de passos excedido no formulário.' };
      }

    } catch (error: any) {
      console.error(`🚨 [ApplyService] Erro fatal no Playwright:`, error.message);
      await this.closeModal(page).catch(() => {});
      return { status: 'error', details: `Exceção: ${error.message}` };
    }
  }

  private async closeModal(page: Page): Promise<void> {
    try {
      const dismissBtn = page.locator('button[aria-label="Dismiss"], button[aria-label="Fechar"]').first();
      if (await dismissBtn.isVisible({ timeout: 1000 })) {
        await dismissBtn.click();
        await page.waitForTimeout(500);
        
        const confirmDiscardBtn = page.locator('button[data-control-name="discard_application_confirm_btn"]').first();
        if (await confirmDiscardBtn.isVisible({ timeout: 1000 })) {
          await confirmDiscardBtn.click();
        }
      }
    } catch (e) {
      // Ignora de forma segura
    }
  }
}