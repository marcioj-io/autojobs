import { HealthStatus, RuntimeStateType } from "@autojobs/shared";
interface HealthOptions {
    maxConsecutiveFailures: number;
    blockedStates: RuntimeStateType[];
}
export declare class HealthService {
    private options;
    constructor(options?: HealthOptions);
    determineHealth(state: RuntimeStateType, consecutiveFailures: number, sessionStatus?: string | null): HealthStatus;
}
export {};
