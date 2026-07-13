// packages\db\src\repositories\jobsRepository.ts
import { eq } from 'drizzle-orm';
import type { DrizzleD1Database } from 'drizzle-orm/d1';
import { jobs } from '../schema';
import type { JobModel } from '../schema';
import { JobRecord } from '@autojobs/shared';

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
    console.log('jobsRepository - upsertJob', {
      id: job.id,
      profileName: job.profileName,
      title: job.title,
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

        easyApply: job.easyApply,
        language: job.language,

        createdAt: job.createdAt
          ? new Date(job.createdAt)
          : now,

        updatedAt: job.updatedAt
          ? new Date(job.updatedAt)
          : now,

        applyResult: job.applyResult
          ? JSON.stringify(job.applyResult)
          : undefined,

        postedAt: job.postedAt,

        description: job.description,
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

          easyApply: job.easyApply,
          language: job.language,

          updatedAt: now,

          applyResult: job.applyResult
            ? JSON.stringify(job.applyResult)
            : undefined,

          postedAt: job.postedAt,

          description: job.description,
        },
      });
  }

  async updateJobStatus(id: string, status: string, applyResult?: string) {
    await this.db
      .update(jobs)
      .set({ status, applyResult, updatedAt: new Date() })
      .where(eq(jobs.id, id));
  }
}
