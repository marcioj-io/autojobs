import { eq, gte, and, count } from 'drizzle-orm';
import type { DrizzleD1Database } from 'drizzle-orm/d1';
import { applications } from '../schema';
import type { ApplicationModel } from '../schema';

export class ApplicationsRepository {
  constructor(private db: DrizzleD1Database<any>) {}

  async createApplication(application: ApplicationModel) {
    await this.db.insert(applications).values(application);
  }

  async listAll() {
    return this.db.select().from(applications).all();
  }

  async getById(id: string) {
    return this.db.select().from(applications).where(eq(applications.id, id)).get();
  }

  async getApplicationsByJob(jobId: string) {
    return this.db.select().from(applications).where(eq(applications.jobId, jobId)).all();
  }

  async countApplicationsSince(since: Date, status?: string) {
    const condition = status
      ? and(gte(applications.appliedAt, since), eq(applications.status, status))
      : gte(applications.appliedAt, since);
    const result = await this.db
      .select({ count: count(applications.id).as('count') })
      .from(applications)
      .where(condition)
      .get();

    return Number(result?.count ?? 0);
  }
}
