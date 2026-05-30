import { eq } from 'drizzle-orm';
import type { DrizzleD1Database } from 'drizzle-orm/d1';
import { jobs } from '../schema';
import type { JobModel } from '../schema';

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

  async upsertJob(job: JobModel) {
    const existing = await this.getJobByUrl(job.url);
    if (existing) {
      await this.db
        .update(jobs)
        .set({
          company: job.company,
          title: job.title,
          location: job.location,
          score: job.score,
          status: job.status,
          modality: job.modality,
          easyApply: job.easyApply,
          language: job.language,
          profile: job.profile,
          updatedAt: new Date(),
          applyResult: job.applyResult ?? null,
          postedAt: job.postedAt ?? null,
          description: job.description ?? null
        })
        .where(eq(jobs.url, job.url));
    } else {
      await this.createJob(job);
    }
  }

  async updateJobStatus(id: string, status: string, applyResult?: string) {
    await this.db
      .update(jobs)
      .set({ status, applyResult, updatedAt: new Date() })
      .where(eq(jobs.id, id));
  }
}
