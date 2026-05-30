import type { DrizzleD1Database } from 'drizzle-orm/d1';
import { desc } from 'drizzle-orm';
import { sessionHealth } from '../schema';
import type { SessionHealthModel } from '../schema';

export class SessionHealthRepository {
  constructor(private db: DrizzleD1Database<any>) {}

  async createHealthRecord(entry: SessionHealthModel) {
    await this.db.insert(sessionHealth).values(entry);
  }

  async getRecentHealth(limit = 20) {
    return this.db.select().from(sessionHealth).orderBy(desc(sessionHealth.createdAt)).limit(limit).all();
  }
}
