import type { DrizzleD1Database } from 'drizzle-orm/d1';
import type { Profile } from '../schema';
export declare class ProfilesRepository {
    private db;
    constructor(db: DrizzleD1Database<any>);
    createProfile(profile: Profile): Promise<void>;
    getProfileByName(name: string): Promise<{
        name: string;
        searches: string;
        keywords: string;
        negativeKeywords: string;
        minScore: number;
        dailyLimit: number;
        seniority: string;
        stackPriority: string;
        cv: string;
        createdAt: Date;
        updatedAt: Date;
    } | undefined>;
    getAllProfiles(): Promise<{
        name: string;
        searches: string;
        keywords: string;
        negativeKeywords: string;
        minScore: number;
        dailyLimit: number;
        seniority: string;
        stackPriority: string;
        cv: string;
        createdAt: Date;
        updatedAt: Date;
    }[]>;
}
