import type { DrizzleD1Database } from 'drizzle-orm/d1';
import { runtimeMetrics } from '../schema';
import type { RuntimeMetricModel } from '../schema';

export class RuntimeMetricsRepository {
  constructor(private db: DrizzleD1Database<any>) {}

  async createMetric(metric: RuntimeMetricModel) {
    await this.db.insert(runtimeMetrics).values(metric);
  }

  async getRecentMetrics(limit = 20) {
    return this.db.select().from(runtimeMetrics).limit(limit).all();
  }
}
