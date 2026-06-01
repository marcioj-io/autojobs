import type { DrizzleD1Database } from 'drizzle-orm/d1';
import type { AuditLogModel } from '../schema';
export declare class AuditLogsService {
    private repository;
    constructor(db: DrizzleD1Database<any>);
    recordAuditLog(entry: Omit<AuditLogModel, 'id' | 'createdAt'>): Promise<void>;
    getRecentAuditLogs(limit?: number): Promise<{
        id: string;
        eventType: string;
        action: string;
        message: string;
        source: string;
        metadata: string | null;
        severity: string;
        createdAt: Date;
    }[]>;
}
