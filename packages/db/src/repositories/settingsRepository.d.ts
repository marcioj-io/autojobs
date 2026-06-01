import type { DrizzleD1Database } from 'drizzle-orm/d1';
import type { SettingsModel } from '../schema';
export declare class SettingsRepository {
    private db;
    constructor(db: DrizzleD1Database<any>);
    getSettings(id: string): Promise<{
        id: string;
        minScore: number;
        maxDailyApplications: number;
        autoApply: boolean;
        preferredLocation: string;
        blacklist: string;
    } | undefined>;
    upsertSettings(entry: SettingsModel): Promise<void>;
}
