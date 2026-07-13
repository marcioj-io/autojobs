import type { DrizzleD1Database } from '@autojobs/db';
interface LimitsConfig {
    dailyApplyLimit: number;
    hourlyApplyLimit: number;
    applyCooldownMs: number;
    scrapeCooldownMs: number;
    allowAutoApply: boolean;
}
export declare class LimitsService {
    private config;
    private applicationsRepository;
    constructor(db: DrizzleD1Database<any>, config: LimitsConfig);
    getDailyLimit(): number;
    getHourlyLimit(): number;
    canAutoApply(): boolean;
    countAutoAppliesToday(): Promise<number>;
    countAutoAppliesLastHour(): Promise<number>;
    shouldPauseAfterApply(): Promise<boolean>;
    getApplyCooldownUntil(now?: Date): Date;
    getScrapeCooldownUntil(now?: Date): Date;
}
export {};
