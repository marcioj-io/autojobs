import type { DrizzleD1Database } from 'drizzle-orm/d1';
import type { RetryHistoryModel } from '../schema';
export declare class RetryHistoryRepository {
    private db;
    constructor(db: DrizzleD1Database<any>);
    createRetry(entry: RetryHistoryModel): Promise<void>;
    getRetriesForRun(runId: string): Promise<{
        id: string;
        runId: string;
        attempt: number;
        error: string;
        backoffMs: number;
        timestamp: Date;
    }[]>;
    getRecentRetries(limit?: number): Promise<{
        id: string;
        runId: string;
        attempt: number;
        error: string;
        backoffMs: number;
        timestamp: Date;
    }[]>;
}
