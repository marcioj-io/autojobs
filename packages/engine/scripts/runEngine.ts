// packages/engine/scripts/runEngine.ts
import crypto from 'crypto';
import { LinkedInScraperService } from '../src/linkedinScraperService';
import type { EngineScrapeResult } from '../src/types/types';
import type { Profile } from '@autojobs/db';
import { config } from 'dotenv';
import path from 'node:path';
import fs from 'node:fs';

config({ path: path.resolve(__dirname, '../../../.env') });

/**
 * Config
 */
const WORKER_URL = process.env.WORKER_URL;
const LOG_FILE = path.resolve(process.cwd(), 'engine-reports.jsonl');
const SESSION_FILE = path.resolve(process.cwd(), 'linkedin-session.json.enc');
const SESSION_KEY = process.env.SESSION_KEY || '';
const MAX_FETCH_RETRIES = Number(process.env.FETCH_RETRIES ?? 3);
const FETCH_BACKOFF_MS = Number(process.env.FETCH_BACKOFF_MS ?? 500);

/**
 * Utilities
 */
type LogLevel = 'info' | 'warning' | 'error' | 'debug';

function nowIso() {
  return new Date().toISOString();
}

const globalRunId = crypto.randomUUID();

function sanitizeValue(value: any, maxLen = 2000): any {
  if (value === null || value === undefined) return null;
  if (typeof value === 'string') {
    return value.length > maxLen ? value.slice(0, maxLen) + '...[truncated]' : value;
  }
  if (typeof value === 'number' || typeof value === 'boolean') return value;
  try {
    const seen = new WeakSet();
    const str = JSON.stringify(value, function (k, v) {
      if (v && typeof v === 'object') {
        if (seen.has(v)) return '[Circular]';
        seen.add(v);
      }
      if (typeof v === 'string' && v.length > maxLen) return v.slice(0, maxLen) + '...';
      return v;
    });
    return str.length > maxLen ? str.slice(0, maxLen) + '... [truncated]' : JSON.parse(str);
  } catch {
    try {
      const s = String(value);
      return s.length > maxLen ? s.slice(0, maxLen) + '... [truncated]' : s;
    } catch {
      return '[unserializable]';
    }
  }
}

function writeJsonLog(level: LogLevel, message: string, meta: Record<string, any> = {}) {
  const entry = {
    runId: globalRunId,
    timestamp: nowIso(),
    level,
    message,
    ...meta
  };
  try {
    fs.appendFileSync(LOG_FILE, JSON.stringify(entry) + '\n', { encoding: 'utf-8', mode: 0o600 });
  } catch (err) {
    console.error('Falha ao gravar log:', err);
  }
}

function ensureArray(value: any, fallback: string[]): string[] {
  if (!value) return fallback;
  if (Array.isArray(value)) return value;
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) return parsed;
    } catch (e) {
      return value.split(',').map(s => s.trim()).filter(Boolean);
    }
  }
  return fallback;
}

async function safeFetch(input: RequestInfo, init?: RequestInit, retries = MAX_FETCH_RETRIES): Promise<Response> {
  let attempt = 0;
  let lastErr: any = null;
  while (attempt <= retries) {
    try {
      const res = await fetch(input, init);
      if (!res.ok && res.status >= 500 && attempt < retries) {
        throw new Error(`HTTP ${res.status}`);
      }
      return res;
    } catch (err) {
      lastErr = err;
      attempt++;
      const backoff = FETCH_BACKOFF_MS * Math.pow(2, attempt - 1);
      writeJsonLog('warning', `safeFetch attempt ${attempt} failed`, { url: String(input), error: String(err), backoffMs: backoff });
      await new Promise(r => setTimeout(r, backoff));
    }
  }
  throw lastErr;
}

/**
 * Session encryption helpers (optional)
 */
function encryptSession(plain: string): string {
  if (!SESSION_KEY) return plain;
  try {
    const key = Buffer.from(SESSION_KEY, 'base64');
    if (key.length !== 32) throw new Error('SESSION_KEY must be 32 bytes (base64)');
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
    const encrypted = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return Buffer.concat([iv, tag, encrypted]).toString('base64');
  } catch (err) {
    writeJsonLog('warning', 'Falha ao criptografar sessão; salvando em texto (inseguro).', { error: String(err) });
    return plain;
  }
}

function decryptSession(payload: string): string | null {
  if (!SESSION_KEY) return payload;
  try {
    const key = Buffer.from(SESSION_KEY, 'base64');
    if (key.length !== 32) throw new Error('SESSION_KEY must be 32 bytes (base64)');
    const data = Buffer.from(payload, 'base64');
    const iv = data.slice(0, 12);
    const tag = data.slice(12, 28);
    const encrypted = data.slice(28);
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(tag);
    const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
    return decrypted.toString('utf8');
  } catch (err) {
    writeJsonLog('error', 'Falha ao descriptografar sessão.', { error: String(err) });
    return null;
  }
}

function isValidStorageState(obj: any): obj is { cookies: any[]; origins: any[] } {
  return obj && Array.isArray(obj.cookies) && Array.isArray(obj.origins);
}

/**
 * Main run loop
 */
async function run() {
  writeJsonLog('info', 'Iniciando ciclo automático', { note: 'engine start' });

  try {
    // fetch profiles
    const profilesRes = await safeFetch(`${WORKER_URL}/profiles`);
    if (!profilesRes.ok) {
      throw new Error(`Falha ao buscar profiles. Status: ${profilesRes.status}`);
    }
    const profiles = (await profilesRes.json()) as Profile[];
    if (!profiles || profiles.length === 0) {
      writeJsonLog('info', 'Nenhum perfil encontrado para processar.');
      return;
    }
    writeJsonLog('info', 'Profiles carregados', { count: profiles.length });

    // obtain session from worker (optional)
    let sessionContentString: string | undefined = undefined;
    try {
      const sessionRes = await safeFetch(`${WORKER_URL}/session-cookies`);
      if (sessionRes.ok) {
        const sessionData = await sessionRes.json();
        if (sessionData?.cookies) {
          let parsedSession: any;
          if (typeof sessionData.cookies === 'string') {
            parsedSession = JSON.parse(sessionData.cookies);
          } else {
            parsedSession = sessionData.cookies;
          }

          const normalizedSession = {
            cookies: Array.isArray(parsedSession.cookies) ? parsedSession.cookies : Array.isArray(parsedSession) ? parsedSession : [],
            origins: Array.isArray(parsedSession.origins) ? parsedSession.origins : []
          };

          const serialized = JSON.stringify(normalizedSession);
          const payload = encryptSession(serialized);
          try {
            fs.writeFileSync(SESSION_FILE, payload, { encoding: 'utf-8', mode: 0o600 });
          } catch (err) {
            writeJsonLog('warning', 'Falha ao salvar SESSION_FILE localmente', { error: String(err) });
          }
          sessionContentString = serialized;
          writeJsonLog('info', 'Sessão normalizada via Worker e salva localmente (criptografada se SESSION_KEY presente).');
        }
      } else {
        writeJsonLog('warning', 'Worker retornou não-ok ao buscar session-cookies', { status: sessionRes.status });
      }
    } catch (err) {
      writeJsonLog('warning', 'Não foi possível obter cookies da API do Worker; tentando fallback local', { error: String(err) });
    }

    // fallback: read local session file (try decrypt)
    if (!sessionContentString && fs.existsSync(SESSION_FILE)) {
      try {
        const raw = fs.readFileSync(SESSION_FILE, 'utf-8');
        const maybeDecrypted = decryptSession(raw);
        if (maybeDecrypted) {
          sessionContentString = maybeDecrypted;
          writeJsonLog('info', 'Usando fallback: Sessão local existente (descriptografada).');
        } else {
          try {
            JSON.parse(raw);
            sessionContentString = raw;
            writeJsonLog('info', 'Usando fallback: Sessão local existente (texto).');
          } catch {
            writeJsonLog('warning', 'Arquivo de sessão local inválido ou corrompido.');
          }
        }
      } catch (err) {
        writeJsonLog('warning', 'Erro ao ler arquivo de sessão local.', { error: String(err) });
      }
    }

    if (!sessionContentString) {
      writeJsonLog('warning', 'Nenhuma sessão injetada. O robô terá que iniciar do zero.');
    }

    // parse session object if present and validate
    let parsedSessionObject: any = undefined;
    if (sessionContentString) {
      try {
        const parsed = JSON.parse(sessionContentString);
        if (isValidStorageState(parsed)) {
          parsedSessionObject = parsed;
        } else {
          writeJsonLog('warning', 'StorageState inválido após parse; será ignorado.', { sample: sanitizeValue(parsed, 1000) });
        }
      } catch (err) {
        writeJsonLog('error', 'Erro ao parsear sessão JSON; ignorando.', { error: String(err) });
      }
    }

    // instantiate scraper
    const isHeadless = process.env.LINKEDIN_HEADLESS !== 'false';
    const scraper = new LinkedInScraperService(isHeadless);

    // iterate profiles and queries
    for (const profile of profiles) {
      const queries = ensureArray(profile.targetRoles, ['Desenvolvedor']);
      for (const query of queries) {
        writeJsonLog('info', `Pesquisando: "${query}" para [${profile.name}]`);
        console.log(`\n🔍 Pesquisando: "${query}" para [${profile.name}]`);

        const profileModalities = ensureArray(profile.allowedModalities, ['remoto', 'híbrido']);
        const locations = ensureArray(profile.searchLocation, ['Brasil']);
        const locationStr = locations[0] || 'Brasil';

        // call scraper with validated storageState
        let scrapeResult: EngineScrapeResult = { jobs: [], applications: [], manualReviews: [] };
        try {
          scrapeResult = await scraper.scrape({
            profileName: profile.name,
            profile,
            query,
            location: locationStr,
            language: 'PT',
            maxResults: 20,
            storageState: parsedSessionObject,
            modalities: profileModalities
          });
        } catch (err) {
          writeJsonLog('error', 'Erro ao executar scraper.scrape', { profileName: profile.name, query, error: String(err) });
          // continue to next query/profile without crashing the whole run
          continue;
        }

        writeJsonLog('info', 'RESULTADO DA BUSCA', { profileName: profile.name, query, found: scrapeResult.jobs.length });

        // log each job (structured, detailed)
        scrapeResult.jobs.forEach((job: any, index) => {
          const aiReason = job.aiReason ?? job.ai_reason ?? null;
          const aiMetadata = job.aiMetadata ?? job.ai_metadata ?? null;
          const applyResult = job.applyResult ?? job.apply_result ?? null;

          const jobLog = {
            runId: globalRunId,
            profileName: profile.name,
            query,
            index: index + 1,
            jobId: job.id,
            title: job.title,
            score: job.score ?? null,
            status: job.status ?? null,
            easyApply: Boolean(job.easyApply),
            aiReason: sanitizeValue(aiReason, 1000),
            aiMetadata: sanitizeValue(aiMetadata, 2000),
            applyResult: sanitizeValue(applyResult, 2000),
            createdAt: job.createdAt ?? null,
            updatedAt: job.updatedAt ?? null
          };

          writeJsonLog('info', 'JOB', jobLog);

          if (aiMetadata) {
            writeJsonLog('debug', 'JOB_AI_METADATA', { aiMetadata: sanitizeValue(aiMetadata, 8000) });
          }

          if (applyResult) {
            writeJsonLog('info', 'JOB_APPLY_RESULT', { applyResult: sanitizeValue(applyResult, 8000) });
          }
        });

        // persist jobs to worker
        if (scrapeResult.jobs.length > 0) {
          try {
            const saveRes = await safeFetch(`${WORKER_URL}/jobs`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(scrapeResult.jobs)
            });
            if (saveRes.ok) {
              writeJsonLog('info', 'Banco de dados de VAGAS atualizado com sucesso', { profileName: profile.name, count: scrapeResult.jobs.length });
            } else {
              const text = await saveRes.text().catch(() => '<no-body>');
              writeJsonLog('error', 'Erro ao salvar VAGAS no Worker', { status: saveRes.status, body: sanitizeValue(text, 2000) });
            }
          } catch (err) {
            writeJsonLog('error', 'Erro ao enviar VAGAS ao Worker', { error: String(err) });
          }
        }

        // persist manual reviews
        if (scrapeResult.manualReviews && scrapeResult.manualReviews.length > 0) {
          try {
            const reviewRes = await safeFetch(`${WORKER_URL}/reviews`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(scrapeResult.manualReviews)
            });
            if (reviewRes.ok) {
              writeJsonLog('info', 'Reviews manuais registradas no Worker', { profileName: profile.name, count: scrapeResult.manualReviews.length });
            } else {
              const text = await reviewRes.text().catch(() => '<no-body>');
              writeJsonLog('error', 'Erro ao salvar REVIEWS no Worker', { status: reviewRes.status, body: sanitizeValue(text, 2000) });
            }
          } catch (err) {
            writeJsonLog('error', 'Erro ao enviar REVIEWS ao Worker', { error: String(err) });
          }
        }

        // polite delay to avoid anti-bot
        writeJsonLog('info', 'Delay anti-bot', { waitMs: 15000 });
        await new Promise(r => setTimeout(r, 15000));
      }
    }

    writeJsonLog('info', 'Ciclo finalizado com sucesso');
  } catch (error: any) {
    const shortError = error instanceof Error ? error.message : String(error).substring(0, 200);
    writeJsonLog('error', 'ERRO FATAL', { error: shortError });
    console.error('\n💥 Erro fatal durante a execução:', error);
  }
}

/**
 * Shutdown handling
 */
async function shutdown(code = 0) {
  writeJsonLog('info', 'Encerrando Engine (shutdown)', { code });
  console.log('🛑 Encerrando Engine...');
  try {
    try {
      const { BrowserManager } = await import('../src/browser/browserManager');
      await BrowserManager.getInstance().close();
      writeJsonLog('info', 'BrowserManager fechado com sucesso');
    } catch (err) {
      writeJsonLog('warning', 'Erro ao fechar BrowserManager (ou não disponível)', { error: String(err) });
    }
  } finally {
    process.exit(code);
  }
}

process.once('SIGINT', () => shutdown(0));
process.once('SIGTERM', () => shutdown(0));

run()
  .then(async () => {
    await shutdown(0);
  })
  .catch(async (error) => {
    writeJsonLog('error', 'Unhandled run error', { error: String(error) });
    console.error('ENGINE ERROR', error);
    await shutdown(1);
  });
