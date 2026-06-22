import { LinkedInScraperService } from '../src/linkedinScraperService';
import type { EngineScrapeResult } from '../src/types';
import { config } from 'dotenv';
import path from 'node:path';

config({
  path: path.resolve(__dirname, '../../../.env.local')
});

// Ajuste para a URL de produção quando for fazer deploy
const WORKER_URL = process.env.WORKER_URL || 'http://localhost:8787';


async function run() {
  console.log('🤖 [ENGINE LOCAL] Iniciando ciclo automático...');
  console.log("🚀 ~ WORKER_URL:", WORKER_URL)

  try {
    // 1. Busca os perfis/buscas cadastrados no D1 através do Worker
    const profilesResponse = await fetch(`${WORKER_URL}/profiles`);
    const profiles = await profilesResponse.json() as any[];

    if (!profiles || profiles.length === 0) {
      console.log('⚠️ [ENGINE LOCAL] Nenhum perfil encontrado no banco. Encerrando ciclo.');
      return;
    }

    // 2. Puxa os cookies atuais para não precisar logar toda vez
    const sessionResponse = await fetch(`${WORKER_URL}/session-cookies`);
    const sessionData = await sessionResponse.json() as any;
    let storageState = undefined;

    if (sessionData && sessionData.cookies) {
      storageState = JSON.parse(sessionData.cookies);
      console.log('🔑 [ENGINE LOCAL] Cookies carregados com sucesso do D1.');
    } else {
      console.log('⚠️ [ENGINE LOCAL] Nenhuma sessão encontrada. O motor tentará fazer o Bootstrap (Login).');
    }

    // 3. Instancia o seu Scraper Real!
    // Ele usa o que estiver no .env (false para você ver a tela, true para rodar oculto)
    const isHeadless = process.env.LINKEDIN_HEADLESS !== 'false';
    const scraper = new LinkedInScraperService(isHeadless);

    for (const profile of profiles) {
      const queries = (profile.searches ?? '').split(',').map((q: string) => q.trim()).filter(Boolean);

      for (const query of queries) {
        console.log(`\n🔍 [ENGINE LOCAL] Pesquisando: "${query}" para o perfil [${profile.name}]`);

        // 4. Executa a SUBSCRIÇÃO REAL da sua lógica
        const scrapeResult: EngineScrapeResult = await scraper.scrape({
          profile: profile.name,
          query: query,
          location: 'Brasil', // Pode virar dinâmico depois (ex: profile.location)
          language: 'pt',
          maxResults: 20,
          storageState: storageState
        });

        console.log(`✅ [ENGINE LOCAL] ${scrapeResult.jobs.length} vagas processadas/pontuadas.`);

        // 5. Envia o resultado validado de volta para o Worker (D1)
        if (scrapeResult.jobs.length > 0) {
          const saveResponse = await fetch(`${WORKER_URL}/jobs`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(scrapeResult.jobs)
          });

          if (saveResponse.ok) {
            console.log(`📦 [ENGINE LOCAL] Vagas salvas no Cloudflare D1 com sucesso!`);
          } else {
            console.error(`❌ [ENGINE LOCAL] Falha ao salvar no Worker:`, await saveResponse.text());
          }
        }
      }
    }
    console.log('\n🏁 [ENGINE LOCAL] Ciclo finalizado com sucesso.');
  } catch (error) {
    console.error('\n💥 [ENGINE LOCAL] Erro fatal durante a execução:', error);
  }
}

// Inicia a execução
run();