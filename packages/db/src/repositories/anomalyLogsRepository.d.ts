import type { DrizzleD1Database } from 'drizzle-orm/d1';
import type { AnomalyLogModel } from '../schema';
export declare class AnomalyLogsRepository {
    private db;
    constructor(db: DrizzleD1Database<any>);
    createAnomaly(entry: AnomalyLogModel): Promise<void>;
    getRecentAnomalies(limit?: number): Promise<{
        id: string;
        type: string;
        message: string;
        details: string | null;
        severity: string;
        timestamp: Date;
    }[]>;
}
