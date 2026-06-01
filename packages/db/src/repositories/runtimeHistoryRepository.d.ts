import type { DrizzleD1Database } from 'drizzle-orm/d1';
import type { RuntimeHistoryModel } from '../schema';
export declare class RuntimeHistoryRepository {
    private db;
    constructor(db: DrizzleD1Database<any>);
    createHistory(entry: RuntimeHistoryModel): Promise<void>;
    getRecentHistory(limit?: number): Promise<{
        id: string;
        runType: string;
        state: string;
        status: string;
        startedAt: Date;
        finishedAt: Date | null;
        durationMs: number | null;
        jobsProcessed: number;
        autoApplies: number;
        reviewsCreated: number;
        successRate: number | null;
        errorMessage: string | null;
        metadata: string | null;
        createdAt: Date;
        updatedAt: Date;
    }[]>;
}
