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
      // Seleciona o botão de forma agnóstica ao idioma e estrutura de divs
      const easyApplyBtn = page.getByRole('button', { name: /(easy apply|Easy Apply|candidatura simplificada|Candidatura Simplificada)/i }).first();
      
      // isVisible não dispara exceções nativamente, não é necessário usar .catch()
      const isEasyApplyVisible = await easyApplyBtn.isVisible();

      if (!isEasyApplyVisible) {
        console.log(`⚠️ [ApplyService] Sem Easy Apply. Redireciona para fora ou já aplicado.`);
        return { 
          status: 'no_easy_apply', 
          details: 'Botão Easy Apply não encontrado ou vaga redireciona para o site da empresa.' 
        };
      }

      await easyApplyBtn.click();
      await page.waitForTimeout(1500); // Tempo extra de segurança para a injeção do modal

      let stepCount = 0;
      let isSubmitted = false;

      while (stepCount < this.MAX_STEPS && !isSubmitted) {
        stepCount++;
        
        // Verifica se o modal desapareceu de forma inesperada
        const modal = page.locator('.jobs-easy-apply-modal');
        if (!(await modal.isVisible())) {
          isSubmitted = true;
          break;
        }

        // SELETORES BLINDADOS: Busca por fragmentos de texto (ex: pega "Continue", "Next Step" ou "Avançar")
        const submitBtn = page.getByRole('button', { name: /(enviar|Enviar|submit|Submit|Submit application)/i });
        const reviewBtn = page.getByRole('button', { name: /(revisar|Revisar|review|Review)/i });
        const nextBtn = page.getByRole('button', { name: /(avançar|Avançar|next|Next|continue)/i });

        // A ORDEM DE AVALIAÇÃO IMPORTA: Tenta sempre enviar -> depois revisar -> depois avançar
        if (await submitBtn.isVisible()) {
          console.log(`👆 [ApplyService] Passo ${stepCount}: Clicando em ENVIAR CANDIDATURA...`);
          await submitBtn.click();
          await page.waitForTimeout(2500); // Aguarda a requisição POST do LinkedIn
          isSubmitted = true;
          break;

        } else if (await reviewBtn.isVisible()) {
          console.log(`👆 [ApplyService] Passo ${stepCount}: Clicando em REVISAR...`);
          await reviewBtn.click();
          await page.waitForTimeout(1000);

        } else if (await nextBtn.isVisible()) {
          console.log(`👆 [ApplyService] Passo ${stepCount}: Clicando em AVANÇAR...`);
          await nextBtn.click();
          await page.waitForTimeout(1500); // Aguarda o DOM da próxima aba carregar

          // BLINDAGEM CONTRA TRAVAMENTO EM LOOP: Detecta validação do formulário (image_9630fa.png)
          const hasError = await page.locator('.artdeco-inline-feedback--error, [data-test-form-builder-error-message]').isVisible();
          
          if (hasError) {
            console.log(`❌ [ApplyService] Formulário exige preenchimento manual obrigatório. Abortando.`);
            await this.closeModal(page);
            return {
              status: 'complex_form',
              details: `Travou no passo ${stepCount}: O formulário exigiu respostas ou anexos manuais.`
            };
          }
        } else {
          console.log(`❌ [ApplyService] Nenhum botão de progressão mapeado encontrado. Abortando.`);
          await this.closeModal(page);
          return {
            status: 'error',
            details: `Modal em estado desconhecido no passo ${stepCount}. Botões não encontrados.`
          };
        }
      }

      if (isSubmitted) {
        console.log(`✅ [ApplyService] Candidatura realizada com sucesso após ${stepCount} passos!`);
        await this.closeModal(page); // Assegura o fechamento da janela de "Sucesso" ou "Done"
        return { status: 'submitted', details: 'Candidatura enviada via Easy Apply.' };
      } else {
        await this.closeModal(page);
        return { status: 'error', details: `Limite de ${this.MAX_STEPS} passos excedido no formulário.` };
      }

    } catch (error: any) {
      console.error(`🚨 [ApplyService] Erro fatal no Playwright:`, error.message);
      await this.closeModal(page).catch(() => {});
      return { status: 'error', details: `Exceção capturada: ${error.message}` };
    }
  }

  private async closeModal(page: Page): Promise<void> {
    try {
      // Cobre tanto o fechar no meio do processo quanto o "Done/Concluído" no final
      const dismissBtn = page.getByRole('button', { name: /(fechar|dismiss|close|concluído|done)/i }).first();
      
      if (await dismissBtn.isVisible({ timeout: 1500 })) {
        await dismissBtn.click();
        await page.waitForTimeout(500);
        
        // Cobre o popup de confirmação de descarte de rascunho
        const confirmDiscardBtn = page.getByRole('button', { name: /(descartar|discard)/i }).first();
        if (await confirmDiscardBtn.isVisible({ timeout: 1000 })) {
          await confirmDiscardBtn.click();
        }
      }
    } catch (e) {
      // Ignora silenciosamente, pois é apenas um método de limpeza (cleanup)
    }
  }
}