// packages/engine/scripts/runEngine.ts
import { LinkedInScraperService } from '../src/linkedinScraperService';
import type { EngineScrapeResult } from '../src/types';
import type { Profile } from '@autojobs/db';
import { config } from 'dotenv';
import path from 'node:path';
import fs from 'node:fs';
import { BrowserManager } from '../src/browser/browserManager';

config({ path: path.resolve(__dirname, '../../../.env') });

const WORKER_URL = process.env.WORKER_URL || 'http://localhost:8787';
const LOG_FILE = path.resolve(process.cwd(), 'engine-reports.txt');

function writeLog(message: string) {
  const timestamp = new Date().toLocaleString('pt-BR');
  const formattedMessage = `[${timestamp}] ${message}\n`;
  fs.appendFileSync(LOG_FILE, formattedMessage, 'utf-8');
}

function ensureArray(value: any, fallback: string[]): string[] {
  if (!value) return fallback;
  if (Array.isArray(value)) return value; 
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) return parsed;
    } catch (e) {
      return value.split(',').map(s => s.trim());
    }
  }
  return fallback;
}

async function run() {
  const startMsg = '🤖 [ENGINE LOCAL] Iniciando ciclo automático...';
  console.log(startMsg);
  writeLog('\n' + '='.repeat(50));
  writeLog(startMsg);

  try {
    const profilesResponse = await fetch(`${WORKER_URL}/profiles`);
    
    if (!profilesResponse.ok) {
      throw new Error(`Falha ao buscar profiles. Status: ${profilesResponse.status}`);
    }
    
    const profiles = (await profilesResponse.json()) as Profile[];
    
    if (!profiles || profiles.length === 0) {
      console.log('Nenhum perfil encontrado para processar.');
      return;
    }

    // =========================================================
    // 🛡️ CORREÇÃO CRÍTICA DA SESSÃO AQUI
    // =========================================================
    const localSessionPath = path.resolve(process.cwd(), 'linkedin-session.json');
    let sessionContentString: string | undefined = undefined;

    try {
      const sessionResponse = await fetch(`${WORKER_URL}/session-cookies`);

      if (sessionResponse.ok) {
        const sessionData = await sessionResponse.json();

        if (sessionData?.cookies) {

          let parsedSession;

          if (typeof sessionData.cookies === 'string') {
            parsedSession = JSON.parse(sessionData.cookies);
          } else {
            parsedSession = sessionData.cookies;
          }

          /**
           * Playwright storageState:
           * {
           *   cookies: Cookie[],
           *   origins: Origin[]
           * }
           */

          const normalizedSession = {
            cookies: Array.isArray(parsedSession.cookies)
              ? parsedSession.cookies
              : Array.isArray(parsedSession)
                ? parsedSession
                : [],

            origins: Array.isArray(parsedSession.origins)
              ? parsedSession.origins
              : []
          };

          const serializedSession = JSON.stringify(
            normalizedSession
          );

          fs.writeFileSync(
            localSessionPath,
            serializedSession,
            'utf-8'
          );

          sessionContentString = serializedSession;

          writeLog(
            '✅ Sessão normalizada via Worker e salva localmente.'
          );
        }
      }

    } catch (err) {

      console.warn(
        '⚠️ Não foi possível obter os cookies da API do Worker. Tentando fallback local...'
      );
    }

    // Fallback: Se a API falhar mas o arquivo manual que você acabou de gerar existir
    if (!sessionContentString && fs.existsSync(localSessionPath)) {
      // LÊ O CONTEÚDO DO ARQUIVO
      sessionContentString = fs.readFileSync(localSessionPath, 'utf-8'); 
      writeLog('✅ Usando fallback: Sessão local existente (linkedin-session.json).');
    }

    if (!sessionContentString) {
      writeLog('🚨 ALERTA: Nenhuma sessão injetada. O robô terá que iniciar do zero.');
    }
    // =========================================================

    const isHeadless = process.env.LINKEDIN_HEADLESS !== 'false';
    const scraper = new LinkedInScraperService(isHeadless);

    // Transforma a string em um objeto reconhecido pelo Playwright
    let parsedSessionObject = undefined;
    if (sessionContentString) {
      try {
        parsedSessionObject = JSON.parse(sessionContentString);
      } catch (e) {
        console.error('❌ Erro ao fazer parse da sessão JSON:', e);
      }
    }

    for (const profile of profiles) {
      const queries = ensureArray(profile.targetRoles, ['Desenvolvedor']);

      for (const query of queries) {
        writeLog(`🔍 INICIANDO BUSCA | Query: "${query}" | Perfil: [${profile.name}]`);
        console.log(`\n🔍 Pesquisando: "${query}" para [${profile.name}]`);

        const profileModalities = ensureArray(profile.allowedModalities, ["remoto", "híbrido"]);

        const locations = ensureArray(profile.searchLocation, ['Brasil']);
        const locationStr = locations[0] || 'Brasil';

        const scrapeResult: EngineScrapeResult = await scraper.scrape({
          profileName: profile.name, 
          profile: profile, 
          query: query,
          location: locationStr, 
          language: 'PT',
          maxResults: 20,
          storageState: parsedSessionObject,
          modalities: profileModalities // Agora sim passamos um Array de verdade!
        });
        writeLog(`📊 RESULTADO DA BUSCA: ${scrapeResult.jobs.length} vagas encontradas.`);

        scrapeResult.jobs.forEach((job: any, index) => {
          writeLog(`   [${index + 1}] Vaga: ${job.title} | ID: ${job.id}`);
          writeLog(`       Score: ${job.score} | EasyApply: ${job.easyApply ? 'SIM' : 'NÃO'}`);
          writeLog(`       Status Final: ${job.status}`);
          
          if (job.status === 'applied' || job.status === 'pending_review' || job.status === 'error') {
            writeLog(`       Detalhes da Aplicação: ${JSON.stringify(job.applyResult)}`);
          }
        });
        
        if (scrapeResult.jobs.length > 0) {
          const saveResponse = await fetch(`${WORKER_URL}/jobs`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(scrapeResult.jobs)
          });

          if (saveResponse.ok) {
            writeLog(`📦 Banco de dados de VAGAS atualizado com sucesso!`);
          } else {
            writeLog(`❌ ERRO ao salvar VAGAS no D1: ${await saveResponse.text()}`);
          }
        } 

        if (scrapeResult.manualReviews && scrapeResult.manualReviews.length > 0) {
          writeLog(`⚠️ Submetendo ${scrapeResult.manualReviews.length} vagas para REVISÃO MANUAL...`);
          
          const reviewResponse = await fetch(`${WORKER_URL}/reviews`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(scrapeResult.manualReviews)
          });

          if (reviewResponse.ok) {
            writeLog(`📌 Reviews manuais registradas no D1 com sucesso!`);
          } else {
            writeLog(`❌ ERRO ao salvar REVIEWS no D1: ${await reviewResponse.text()}`);
          }
        }

        writeLog(`⏳ Aguardando 15 segundos para não acionar o anti-bot do LinkedIn...`);
        await new Promise(resolve => setTimeout(resolve, 15000));
      }
    }
  } catch (error) {
    const shortError = error instanceof Error ? error.message : String(error).substring(0, 200);
    writeLog(`💥 ERRO FATAL: ${shortError}`);
    console.error('\n💥 Erro fatal durante a execução:', error);
  }
}

async function shutdown(code = 0) {
  console.log('🛑 Encerrando Engine...');

  try {
    await BrowserManager
      .getInstance()
      .close();
  } finally {
    process.exit(code);
  }
}

process.once('SIGINT', () => shutdown(0));
process.once('SIGTERM', () => shutdown(0));

run().catch(async error => {
    console.error('ENGINE ERROR', error);

    await shutdown(1);
});