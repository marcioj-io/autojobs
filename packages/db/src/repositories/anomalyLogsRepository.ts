import type { DrizzleD1Database } from 'drizzle-orm/d1';
import { desc } from 'drizzle-orm';
import { anomalyLogs } from '../schema';
import type { AnomalyLogModel } from '../schema';

export class AnomalyLogsRepository {
  constructor(private db: DrizzleD1Database<any>) {}

  async createAnomaly(entry: AnomalyLogModel) {
    await this.db.insert(anomalyLogs).values(entry);
  }

  async getRecentAnomalies(limit = 50) {
    return this.db.select().from(anomalyLogs).orderBy(desc(anomalyLogs.timestamp)).limit(limit).all();
  }
}
