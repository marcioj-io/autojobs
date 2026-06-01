import type { DrizzleD1Database } from 'drizzle-orm/d1';
import type { LinkedInSessionModel } from '../schema';
export declare class LinkedInSessionsRepository {
    private db;
    constructor(db: DrizzleD1Database<any>);
    getSessionById(id: string): Promise<{
        id: string;
        profile: string;
        cookies: string;
        createdAt: Date;
        updatedAt: Date;
    } | undefined>;
    upsertSession(session: LinkedInSessionModel): Promise<void>;
    listAll(): Promise<{
        id: string;
        profile: string;
        cookies: string;
        createdAt: Date;
        updatedAt: Date;
    }[]>;
}
