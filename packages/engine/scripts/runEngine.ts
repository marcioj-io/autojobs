// packages/engine/scripts/runEngine.ts
import { LinkedInScraperService } from '../src/linkedinScraperService';
import type { EngineScrapeResult } from '../src/types';
import type { Profile } from '@autojobs/db';
import { config } from 'dotenv';
import path from 'node:path';
import fs from 'node:fs';

config({ path: path.resolve(__dirname, '../../../.env.local') });

const WORKER_URL = process.env.WORKER_URL || 'http://localhost:8787';

// 🛠️ SETUP DO ARQUIVO DE LOG
const LOG_FILE = path.resolve(process.cwd(), 'engine-reports.txt');

function writeLog(message: string) {
  const timestamp = new Date().toLocaleString('pt-BR');
  const formattedMessage = `[${timestamp}] ${message}\n`;
  fs.appendFileSync(LOG_FILE, formattedMessage, 'utf-8');
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

    let storageState: string | undefined = undefined;

    try {
      const sessionResponse = await fetch(`${WORKER_URL}/session-cookies`);
      if (sessionResponse.ok) {
        const sessionData = (await sessionResponse.json()) as { cookies: string };
        if (sessionData && sessionData.cookies) {
          storageState = sessionData.cookies;
        }
      }
    } catch (err) {
      console.warn('⚠️ Não foi possível obter os cookies da API do Worker. Tentando fallback local...');
    }

    // Fallback para sessão local
    if (!storageState) {
      const sessionPath = path.resolve(process.cwd(), 'linkedin-session.json'); 
      if (fs.existsSync(sessionPath)) {
        storageState = fs.readFileSync(sessionPath, 'utf-8');
      }
    }

    const isHeadless = process.env.LINKEDIN_HEADLESS !== 'false';
    const scraper = new LinkedInScraperService(isHeadless);

    for (const profile of profiles) {
      const queries = (profile.searches ?? '')
        .split(',')
        .map((q: string) => q.trim())
        .filter(Boolean);

      for (const query of queries) {
        writeLog(`🔍 INICIANDO BUSCA | Query: "${query}" | Perfil: [${profile.name}]`);
        console.log(`\n🔍 Pesquisando: "${query}" para [${profile.name}]`);

        const scrapeResult: EngineScrapeResult = await scraper.scrape({
          profile: profile.name, 
          profileDefinition: profile, 
          query: query,
          location: profile.searchLocation || 'Brasil',
          language: 'PT',
          maxResults: 20,
          storageState: storageState
        });

        writeLog(`📊 RESULTADO DA BUSCA: ${scrapeResult.jobs.length} vagas encontradas.`);

        // 📝 LOG DETALHADO DE CADA VAGA
        scrapeResult.jobs.forEach((job: any, index) => {
          writeLog(`   [${index + 1}] Vaga: ${job.title} | ID: ${job.id}`);
          writeLog(`       Score: ${job.score} | EasyApply: ${job.easyApply ? 'SIM' : 'NÃO'}`);
          writeLog(`       ✅ Positivas Encontradas: [${job.matchedKeywords?.join(', ') || 'nenhuma'}]`);
          writeLog(`       ❌ Negativas Encontradas: [${job.matchedNegativeKeywords?.join(', ') || 'nenhuma'}]`);
          writeLog(`       Status Final: ${job.status}`);
          
          if (job.status === 'applied' || job.status === 'pending_review') {
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
            writeLog(`📦 Banco de dados (D1) atualizado com sucesso!`);
          } else {
            writeLog(`❌ ERRO ao salvar no D1: ${await saveResponse.text()}`);
          }
        } 

        // ⏳ DELAY ENTRE CONSULTAS (Respira fundo antes da próxima busca)
        writeLog(`⏳ Aguardando 15 segundos para não acionar o anti-bot do LinkedIn...`);
        await new Promise(resolve => setTimeout(resolve, 15000));
      }
    }
  } catch (error) {
    // Pegamos apenas a mensagem do erro, sem o rastro gigante
    const shortError = error instanceof Error ? error.message : String(error).substring(0, 200);
    writeLog(`💥 ERRO FATAL: ${shortError}`);
    console.error('\n💥 Erro fatal durante a execução:', error);
  }
}

run();