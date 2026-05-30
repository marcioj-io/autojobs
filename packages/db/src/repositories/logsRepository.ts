import type { DrizzleD1Database } from 'drizzle-orm/d1';
import { logs } from '../schema';
import type { LogModel } from '../schema';

export class LogsRepository {
  constructor(private db: DrizzleD1Database<any>) {}

  async createLog(entry: LogModel) {
    await this.db.insert(logs).values(entry);
  }

  async getRecentLogs(limit = 50) {
    return this.db.select().from(logs).limit(limit).all();
  }
}
