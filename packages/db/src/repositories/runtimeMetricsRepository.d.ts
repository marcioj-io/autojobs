import type { DrizzleD1Database } from 'drizzle-orm/d1';
import type { RuntimeMetricModel } from '../schema';
export declare class RuntimeMetricsRepository {
    private db;
    constructor(db: DrizzleD1Database<any>);
    createMetric(metric: RuntimeMetricModel): Promise<void>;
    getRecentMetrics(limit?: number): Promise<{
        id: string;
        recordedAt: Date;
        jobsPerDay: number;
        appliesPerDay: number;
        reviewsPerDay: number;
        applySuccessRate: number;
        uptimePercent: number;
        averageScore: number;
        averageDurationMs: number;
        createdAt: Date;
        updatedAt: Date;
    }[]>;
}
