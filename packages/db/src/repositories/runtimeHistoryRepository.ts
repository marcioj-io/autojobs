import type { DrizzleD1Database } from 'drizzle-orm/d1';
import { runtimeHistory } from '../schema';
import type { RuntimeHistoryModel } from '../schema';

export class RuntimeHistoryRepository {
  constructor(private db: DrizzleD1Database<any>) {}

  async createHistory(entry: RuntimeHistoryModel) {
    await this.db.insert(runtimeHistory).values(entry);
  }

  async getRecentHistory(limit = 20) {
    return this.db.select().from(runtimeHistory).limit(limit).all();
  }
}
