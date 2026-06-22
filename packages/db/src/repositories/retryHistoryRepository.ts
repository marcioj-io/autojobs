import { desc, eq } from 'drizzle-orm';
import type { DrizzleD1Database } from 'drizzle-orm/d1';
import { retryHistory } from '../schema';
import type { RetryHistoryModel } from '../schema';

export class RetryHistoryRepository {
  constructor(private db: DrizzleD1Database<any>) {}

  async createRetry(entry: RetryHistoryModel) {
    await this.db.insert(retryHistory).values(entry);
  }

  async getRetriesForRun(runId: string) {
    return this.db.select().from(retryHistory).where(eq(retryHistory.runId, runId)).all();
  }

  async getRecentRetries(limit = 50) {
    return this.db.select().from(retryHistory).orderBy(desc(retryHistory.timestamp)).limit(limit).all();
  }
}
