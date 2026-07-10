interface SchedulerConfig {
    cooldownMs: number;
    errorCooldownMs: number;
    minRandomDelayMs: number;
    maxRandomDelayMs: number;
}
export declare class Scheduler {
    private config;
    constructor(config: SchedulerConfig);
    getNextExecutionTime(now?: Date, cooldownUntil?: Date | null): Date;
    getCooldownTime(now?: Date): Date;
    getErrorCooldownTime(now?: Date): Date;
    shouldStart(now: Date, nextExecutionAt?: Date | null, cooldownUntil?: Date | null, currentState?: string): boolean;
}
export {};
