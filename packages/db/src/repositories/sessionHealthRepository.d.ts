import type { DrizzleD1Database } from 'drizzle-orm/d1';
import type { SessionHealthModel } from '../schema';
export declare class SessionHealthRepository {
    private db;
    constructor(db: DrizzleD1Database<any>);
    createHealthRecord(entry: SessionHealthModel): Promise<void>;
    getRecentHealth(limit?: number): Promise<{
        id: string;
        sessionId: string;
        healthScore: number;
        status: string;
        reason: string | null;
        lastValidatedAt: Date;
        cooldownUntil: Date | null;
        createdAt: Date;
        updatedAt: Date;
    }[]>;
}
