// packages/engine/scripts/runEngine.ts
import { createHash, createCipheriv, createDecipheriv, randomBytes, randomUUID, scryptSync } from 'crypto';
import path from 'node:path';
import fs from 'node:fs';
import type { Profile } from '@autojobs/db';
import { config } from 'dotenv';
import { LinkedInScraperService } from '../src/linkedinScraperService';
import type { EngineScrapeResult } from '../src/types';

config({ path: path.resolve(__dirname, '../../../.env') });

/* -------------------------
   Config / defaults
   ------------------------- */
const WORKER_URL = process.env.NEXT_PUBLIC_WORKER_URL ?? process.env.WORKER_URL ?? 'http://localhost:3001';
const LOG_FILE = path.resolve(process.cwd(), process.env.ENGINE_LOG_FILE ?? 'engine-reports.jsonl');
const SESSION_FILE = path.resolve(process.cwd(), process.env.SESSION_FILE ?? 'linkedin-session.json.enc');
const SESSION_SECRET = process.env.SESSION_SECRET ?? '';
const MAX_FETCH_RETRIES = Number(process.env.FETCH_RETRIES ?? 3);
const FETCH_BACKOFF_MS = Number(process.env.FETCH_BACKOFF_MS ?? 500);
const APPLY_DEBUG_DIR = path.resolve(process.cwd(), process.env.APPLY_DEBUG_DIR ?? './apply-debug');
const MAX_LOG_VALUE = Number(process.env.MAX_LOG_VALUE ?? 2000);

/* -------------------------
   Ensure debug dir exists
   ------------------------- */
try {
  if (!fs.existsSync(APPLY_DEBUG_DIR)) fs.mkdirSync(APPLY_DEBUG_DIR, { recursive: true });
} catch {
  // best-effort
}

/* -------------------------
   Types
   ------------------------- */
type LogLevel = 'info' | 'warning' | 'error' | 'debug';

/* -------------------------
   Utilities
   ------------------------- */
const globalRunId = randomUUID();

function nowIso() {
  return new Date().toISOString();
}

function sanitizeValue(value: any, maxLen = MAX_LOG_VALUE): any {
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
      if (typeof v === 'string' && v.length > maxLen) return v.slice(0, maxLen) + '...[truncated]';
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
    entryId: meta?.jobId ?? randomUUID(),
    timestamp: nowIso(),
    level,
    message,
    ...meta
  };
  try {
    fs.appendFileSync(LOG_FILE, JSON.stringify(entry) + '\n', { encoding: 'utf-8', mode: 0o600 });
  } catch (err) {
    console.error('Falha ao gravar log em arquivo:', err);
    console[level === 'error' ? 'error' : 'log'](entry);
  }
}

/* -------------------------
   Network helper with retries/backoff
   ------------------------- */
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
      writeJsonLog('warning', `safeFetch attempt failed`, { url: String(input), attempt, error: String(err), backoffMs: backoff });
      await new Promise(r => setTimeout(r, backoff));
    }
  }
  throw lastErr;
}

/* -------------------------
   Session encryption helpers
   ------------------------- */
function encryptSession(plain: string): string {
  if (!SESSION_SECRET || SESSION_SECRET.length < 16) {
    writeJsonLog('warning', 'SESSION_SECRET ausente ou muito curto; salvando sessão em texto (INSEGURO).');
    return plain;
  }
  try {
    const iv = randomBytes(16);
    const key = scryptSync(SESSION_SECRET, 'salt', 32);
    const cipher = createCipheriv('aes-256-cbc', key, iv);
    let encrypted = cipher.update(plain, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return `${iv.toString('hex')}:${encrypted}`;
  } catch (err) {
    writeJsonLog('warning', 'Falha ao criptografar sessão; salvando em texto (inseguro).', { error: String(err) });
    return plain;
  }
}

function decryptSession(payload: string): string | null {
  if (!SESSION_SECRET || SESSION_SECRET.length < 16) {
    return payload;
  }
  try {
    if (!payload.includes(':')) return payload;
    const [ivHex, encryptedHex] = payload.split(':');
    if (!ivHex || !encryptedHex) return null;
    const iv = Buffer.from(ivHex, 'hex');
    const key = scryptSync(SESSION_SECRET, 'salt', 32);
    const decipher = createDecipheriv('aes-256-cbc', key, iv);
    let decrypted = decipher.update(encryptedHex, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch (err) {
    writeJsonLog('error', 'Falha ao descriptografar sessão com SESSION_SECRET.', { error: String(err) });
    return null;
  }
}

function isValidStorageState(obj: any): obj is { cookies: any[]; origins: any[] } {
  return obj && Array.isArray(obj.cookies) && Array.isArray(obj.origins);
}

/* -------------------------
   In-memory metrics (minimal)
   ------------------------- */
const metrics = {
  jobsProcessed: 0,
  jobsApplied: 0,
  jobsPendingReview: 0,
  llmTimeouts: 0,
  applyFailures: 0
};

/* -------------------------
   Helpers to normalize profile fields safely
   ------------------------- */
function ensureStringArray(value: unknown): string[] {
  if (!value) return [];
  if (Array.isArray(value)) return value.map(v => String(v).trim()).filter(Boolean);
  if (typeof value === 'string') return value.split(',').map(s => s.trim()).filter(Boolean);
  // fallback: try to stringify and split
  try {
    const parsed = JSON.parse(String(value));
    if (Array.isArray(parsed)) return parsed.map(p => String(p).trim()).filter(Boolean);
  } catch {
    // ignore
  }
  return [];
}

/* -------------------------
   Main run loop
   ------------------------- */
async function run() {
  writeJsonLog('info', 'Iniciando ciclo automático', { note: 'engine start' });

  try {
    // 1) fetch profiles
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

    // 2) fetch existing jobs (normalize to array of ids)
    let existingJobs: string[] = [];
    try {
      const jobsRes = await safeFetch(`${WORKER_URL}/jobs`);
      if (!jobsRes.ok) {
        writeJsonLog('warning', 'Falha ao buscar jobs do Worker', { status: jobsRes.status });
      } else {
        const existingJobsRaw = (await jobsRes.json().catch(() => [])) as any[];
        existingJobs = existingJobsRaw
          .map((j: any) => (typeof j === 'string' ? j : (j?.id ?? j?.jobId ?? null)))
          .filter(Boolean);
      }
    } catch (err) {
      writeJsonLog('warning', 'Erro ao recuperar existingJobs do Worker', { error: String(err) });
    }

    // 3) obtain session from worker (optional)
    let sessionContentString: string | undefined = undefined;
    try {
      const sessionRes = await safeFetch(`${WORKER_URL}/session-cookies`);
      if (sessionRes.ok) {
        const sessionData = await sessionRes.json().catch(() => null);
        if (sessionData?.cookies) {
          let rawCookiesString: string;
          if (typeof sessionData.cookies === 'string') rawCookiesString = sessionData.cookies;
          else rawCookiesString = JSON.stringify(sessionData.cookies);

          const maybeDecrypted = decryptSession(rawCookiesString);
          let normalizedSessionString: string | null = null;

          if (maybeDecrypted) normalizedSessionString = maybeDecrypted;
          else {
            try {
              JSON.parse(rawCookiesString);
              normalizedSessionString = rawCookiesString;
            } catch {
              normalizedSessionString = null;
            }
          }

          if (normalizedSessionString) {
            try {
              const parsed = JSON.parse(normalizedSessionString);
              const normalized = {
                cookies: Array.isArray(parsed.cookies) ? parsed.cookies : Array.isArray(parsed) ? parsed : [],
                origins: Array.isArray(parsed.origins) ? parsed.origins : []
              };
              const serialized = JSON.stringify(normalized);
              const payloadToSave = encryptSession(serialized);
              try {
                fs.writeFileSync(SESSION_FILE, payloadToSave, { encoding: 'utf-8', mode: 0o600 });
              } catch (err) {
                writeJsonLog('warning', 'Falha ao salvar SESSION_FILE localmente', { error: String(err) });
              }
              sessionContentString = serialized;
              writeJsonLog('info', 'Sessão normalizada via Worker e salva localmente (criptografada se SESSION_SECRET presente).');
            } catch (err) {
              writeJsonLog('warning', 'Falha ao normalizar sessão recebida do Worker', { error: String(err) });
            }
          } else {
            writeJsonLog('warning', 'Sessão recebida do Worker não pôde ser decodificada ou não é JSON.');
          }
        }
      } else {
        writeJsonLog('warning', 'Worker retornou não-ok ao buscar session-cookies', { status: sessionRes.status });
      }
    } catch (err) {
      writeJsonLog('warning', 'Não foi possível obter cookies da API do Worker; tentando fallback local', { error: String(err) });
    }

    // 4) fallback: read local session file (try decrypt)
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
        if (isValidStorageState(parsed)) parsedSessionObject = parsed;
        else writeJsonLog('warning', 'StorageState inválido após parse; será ignorado.', { sample: sanitizeValue(parsed, 1000) });
      } catch (err) {
        writeJsonLog('error', 'Erro ao parsear sessão JSON; ignorando.', { error: String(err) });
      }
    }

    // instantiate scraper
    const isHeadless = process.env.LINKEDIN_HEADLESS !== 'false';
    const scraper = new LinkedInScraperService(isHeadless);

    // iterate profiles and queries
    for (const profile of profiles) {
      // normalize targetRoles into array of strings safely
      const rawTargetRoles = (profile as any)?.targetRoles;
      const queries = Array.from(new Set(
        ensureStringArray(rawTargetRoles)
          .map((q: any) => String(q || '').trim())
          .filter(Boolean)
      ));
      if (queries.length === 0) queries.push('Desenvolvedor');

      for (const query of queries) {
        writeJsonLog('info', `Pesquisando: "${query}" para [${profile.name}]`);
        console.log(`\n🔍 Pesquisando: "${query}" para [${profile.name}]`);

        // normalize modalities and locations safely
        const profileModalities = ensureStringArray((profile as any)?.allowedModalities);
        const modalities = profileModalities.length > 0 ? profileModalities : ['remoto', 'híbrido'];

        const locationsArr = ensureStringArray((profile as any)?.searchLocation);
        const locationStr = locationsArr.length > 0 ? locationsArr[0] : 'Brasil';

        // call scraper with validated storageState and processedJobIds as array of ids
        let scrapeResult: EngineScrapeResult = { jobs: [], applications: [], manualReviews: [] };
        try {
          scrapeResult = await scraper.scrape({
            profileName: profile.name,
            profile,
            query,
            location: locationStr,
            language: 'PT',
            maxResults: Number(process.env.SCRAPER_MAX_RESULTS ?? 40),
            storageState: parsedSessionObject,
            modalities,
            processedJobIds: existingJobs
          });
        } catch (err) {
          writeJsonLog('error', 'Erro ao executar scraper.scrape', { profileName: profile.name, query, error: String(err) });
          continue;
        }

        // update metrics
        metrics.jobsProcessed += (scrapeResult.jobs?.length ?? 0);

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

          if (aiMetadata) writeJsonLog('debug', 'JOB_AI_METADATA', { aiMetadata: sanitizeValue(aiMetadata, 8000) });
          if (applyResult) writeJsonLog('info', 'JOB_APPLY_RESULT', { applyResult: sanitizeValue(applyResult, 8000) });
        });

        // Persist jobs one-by-one with retry + detailed per-job logs
        if (scrapeResult.jobs.length > 0) {
          for (const job of scrapeResult.jobs) {
            const normalized = (() => {
              try {
                return {
                  ...job,
                  id: job.id ?? createHash('sha256').update(String(job.url || job.title || Date.now())).digest('hex'),
                  company: job.company ?? '',
                  title: job.title ?? 'Sem título',
                  url: job.url ?? `unknown://${Date.now()}`,
                  location: job.location ?? 'Indefinida',
                  profileName: profile.name,
                  createdAt: job.createdAt ?? new Date().toISOString(),
                  updatedAt: new Date().toISOString()
                };
              } catch { return job; }
            })();

            let attempt = 0;
            const maxAttempts = 4;
            while (attempt < maxAttempts) {
              attempt++;
              try {
                const saveRes = await safeFetch(`${WORKER_URL}/jobs`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify(normalized)
                });
                if (saveRes.ok) {
                  writeJsonLog('info', 'JOB_SAVED', { jobId: normalized.id, profileName: profile.name, title: normalized.title });
                  break;
                } else {
                  const text = await saveRes.text().catch(() => '<no-body>');
                  writeJsonLog('warning', 'JOB_SAVE_FAILED', { jobId: normalized.id, status: saveRes.status, body: sanitizeValue(text, 2000), attempt });
                  if (attempt >= maxAttempts) {
                    writeJsonLog('error', 'JOB_SAVE_GAVE_UP', { jobId: normalized.id, attempts: attempt });
                  } else {
                    await new Promise(r => setTimeout(r, 300 * attempt));
                  }
                }
              } catch (err) {
                writeJsonLog('error', 'JOB_SAVE_ERROR', { jobId: normalized.id, error: String(err), attempt });
                if (attempt >= maxAttempts) break;
                await new Promise(r => setTimeout(r, 300 * attempt));
              }
            }
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
        writeJsonLog('info', 'Delay anti-bot', { waitMs: Number(process.env.ENGINE_DELAY_MS ?? 15000) });
        await new Promise(r => setTimeout(r, Number(process.env.ENGINE_DELAY_MS ?? 15000)));
      }
    }

    writeJsonLog('info', 'Ciclo finalizado com sucesso', { metrics });
  } catch (error: any) {
    const shortError = error instanceof Error ? error.message : String(error).substring(0, 200);
    writeJsonLog('error', 'ERRO FATAL', { error: shortError });
    console.error('\n💥 Erro fatal durante a execução:', error);
  }
}

/* -------------------------
   Shutdown handling
   ------------------------- */
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

run().then(async () => {
    await shutdown(0);
  })
  .catch(async (error) => {
    writeJsonLog('error', 'Unhandled run error', { error: String(error) });
    console.error('ENGINE ERROR', error);
    await shutdown(1);
  });
