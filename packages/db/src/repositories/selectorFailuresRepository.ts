import type { DrizzleD1Database } from 'drizzle-orm/d1';
import { desc } from 'drizzle-orm';
import { selectorFailures } from '../schema';
import type { SelectorFailureModel } from '../schema';

export class SelectorFailuresRepository {
  constructor(private db: DrizzleD1Database<any>) {}

  async createFailure(entry: SelectorFailureModel) {
    await this.db.insert(selectorFailures).values(entry);
  }

  async getRecentFailures(limit = 50) {
    return this.db.select().from(selectorFailures).orderBy(desc(selectorFailures.timestamp)).limit(limit).all();
  }
}
