// packages/db/src/repositories/jobsRepository.ts
import { eq } from 'drizzle-orm';
import type { DrizzleD1Database } from 'drizzle-orm/d1';
import { jobs } from '../schema';
import type { JobModel } from '../schema';
import { JobRecord } from '@autojobs/shared';

function safeStringify(obj: any): string | undefined {
  if (obj === undefined || obj === null) return undefined;
  try {
    return JSON.stringify(obj);
  } catch {
    try {
      // try to remove circular refs by serializing only enumerable primitives
      const cleaned: any = {};
      for (const k of Object.keys(obj)) {
        const v = obj[k];
        if (v === null) cleaned[k] = null;
        else if (['string', 'number', 'boolean'].includes(typeof v)) cleaned[k] = v;
        else cleaned[k] = String(v);
      }
      return JSON.stringify(cleaned);
    } catch {
      return undefined;
    }
  }
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

export class JobsRepository {
  constructor(private db: DrizzleD1Database<any>) {}

  async createJob(job: JobModel) {
    await this.db.insert(jobs).values(job);
  }

  async getJobById(id: string) {
    return this.db.select().from(jobs).where(eq(jobs.id, id)).get();
  }

  async getJobByUrl(url: string) {
    return this.db.select().from(jobs).where(eq(jobs.url, url)).get();
  }

  async getJobsByStatus(status: string) {
    return this.db.select().from(jobs).where(eq(jobs.status, status)).all();
  }

  async getAllJobs() {
    return this.db.select().from(jobs).all();
  }

  async upsertJob(job: JobRecord): Promise<void> {
    console.info('jobsRepository - upsertJob', {
      id: job.id,
      profileName: job.profileName,
      title: job.title
    });

    const now = new Date();

    await this.db
      .insert(jobs)
      .values({
        id: job.id,
        company: job.company,
        title: job.title,
        url: job.url,
        location: job.location,
        profileName: job.profileName,
        score: job.score ?? 0,
        status: job.status ?? 'found',
        modality: job.modality ?? 'Híbrido',
        easyApply: job.easyApply ?? false,
        language: job.language ?? 'PT',
        createdAt: job.createdAt ? new Date(job.createdAt) : now,
        updatedAt: job.updatedAt ? new Date(job.updatedAt) : now,
        applyResult: job.applyResult ? safeStringify(job.applyResult) : undefined,
        postedAt: job.postedAt,
        description: job.description
      })
      .onConflictDoUpdate({
        target: jobs.id,
        set: {
          company: job.company,
          title: job.title,
          url: job.url,
          location: job.location,
          profileName: job.profileName,
          score: job.score ?? 0,
          status: job.status ?? 'found',
          modality: job.modality ?? 'Híbrido',
          easyApply: job.easyApply ?? false,
          language: job.language ?? 'PT',
          updatedAt: now,
          applyResult: job.applyResult ? safeStringify(job.applyResult) : undefined,
          postedAt: job.postedAt,
          description: job.description
        }
      });
  }

  /**
   * upsertJobsBatch
   * - batchSize default 25
   * - retry exponential backoff with jitter
   * - on D1 limit-like errors, attempts to compact large fields and retry
   */
  async upsertJobsBatch(jobsList: JobRecord[], batchSize = 25): Promise<{ inserted: number; updated: number; errors: any[] }> {
    const result = { inserted: 0, updated: 0, errors: [] as any[] };
    const total = jobsList.length;
    console.info(`[jobsRepository] upsertJobsBatch start: total=${total} batchSize=${batchSize}`);

    for (let i = 0; i < jobsList.length; i += batchSize) {
      const batch = jobsList.slice(i, i + batchSize);
      let attempt = 0;
      const maxAttempts = 4;
      while (attempt < maxAttempts) {
        try {
          // Build and execute upserts sequentially to avoid D1 row limits per statement
          for (const job of batch) {
            await this.upsertJob(job);
            // metrics: easy_apply_found_rate hook
            if (job.easyApply) {
              console.info('[metrics] easy_apply_found_rate increment');
            }
          }
          // metrics: jobs_per_query hook
          console.info('[metrics] jobs_per_query', { batchCount: batch.length });
          break; // success -> break retry loop
        } catch (err: any) {
          attempt++;
          const errMsg = String(err?.message || err);
          console.warn(`[jobsRepository] upsert batch error attempt=${attempt} msg=${errMsg}`);

          // metrics: db_write_errors hook
          console.error('[metrics] db_write_errors', { message: errMsg });

          // If looks like D1 limit or row-size error, try compacting large fields and retry
          if (errMsg.toLowerCase().includes('d1') || errMsg.toLowerCase().includes('too many') || errMsg.toLowerCase().includes('sqlite')) {
            console.warn('[jobsRepository] Detected DB limit-like error; compacting batch and retrying');
            for (const job of batch) {
              if (job.description && job.description.length > 1000) job.description = job.description.slice(0, 800) + '...[truncated]';
              if (job.applyResult && typeof job.applyResult === 'object') {
                // keep only essential applyResult fields
                const ar = job.applyResult as any;
                job.applyResult = {
                  status: ar.status,
                  details: ar.details,
                  rejectedBy: ar.rejectedBy,
                  reasonCode: ar.reasonCode,
                  metadata: ar.metadata ? { note: 'truncated for DB limit' } : {}
                };
              }
            }
          }

          // exponential backoff with jitter
          const backoff = Math.min(2000 * Math.pow(2, attempt), 10000);
          const jitter = Math.floor(Math.random() * 300);
          await sleep(backoff + jitter);

          if (attempt >= maxAttempts) {
            console.error('[jobsRepository] Max attempts reached for batch; recording errors');
            result.errors.push({ batchIndex: i / batchSize, message: errMsg });
          }
        }
      }
    }

    // best-effort counts (we don't have direct inserted/updated counts from D1)
    result.inserted = total - result.errors.length;
    result.updated = 0;
    console.info('[jobsRepository] upsertJobsBatch finished', result);
    return result;
  }

  async updateJobStatus(id: string, status: string, applyResult?: string) {
    await this.db
      .update(jobs)
      .set({ status, applyResult, updatedAt: new Date() })
      .where(eq(jobs.id, id));
  }
}
