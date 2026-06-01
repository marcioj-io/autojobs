import type { DrizzleD1Database } from 'drizzle-orm/d1';
import type { LogModel } from '../schema';
export declare class LogsRepository {
    private db;
    constructor(db: DrizzleD1Database<any>);
    createLog(entry: LogModel): Promise<void>;
    getRecentLogs(limit?: number): Promise<{
        id: string;
        type: string;
        message: string;
        source: string;
        timestamp: Date;
        level: string;
    }[]>;
}
