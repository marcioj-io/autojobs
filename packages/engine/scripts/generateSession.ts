import { chromium } from 'playwright';
import fs from 'fs';
import readline from 'readline';

// Cria a interface para ler o terminal
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

async function generate() {
  console.log('🌐 Abrindo o navegador...');
  
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();
  
  // Vai para a tela de login
  await page.goto('https://www.linkedin.com/login');

  console.log('\n======================================================');
  console.log('🛑 PAUSA! A automação está aguardando você.');
  console.log('1. Vá até a janela do Chrome que acabou de abrir.');
  console.log('2. Faça o login normalmente, preencha PIN, CAPTCHA, etc.');
  console.log('3. Quando você estiver vendo o seu Feed do LinkedIn...');
  console.log('4. VOLTE AQUI NO TERMINAL E APERTE A TECLA "ENTER"!');
  console.log('======================================================\n');

  // Pausa o script até você apertar ENTER no terminal
  await new Promise<void>((resolve) => {
    rl.question('Pressione ENTER quando estiver logado para salvar os cookies... ', () => {
      resolve();
    });
  });

  console.log('\n✅ Comando recebido! Salvando cookies de sessão...');
  
  const storageState = await context.storageState();
  fs.writeFileSync('linkedin-session.json', JSON.stringify(storageState, null, 2));
  
  console.log('💾 Arquivo "linkedin-session.json" gerado com sucesso!');

  // Fecha tudo com segurança
  await browser.close();
  rl.close();
}

generate();